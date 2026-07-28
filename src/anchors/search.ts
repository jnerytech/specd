import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { grepStrategy } from "./strategies/grep.js";

export interface SymbolMatch {
  // Path relative to the search root, with forward slashes.
  file: string;
  // 1-based line of the first occurrence inside that file.
  line: number;
}

export interface SearchOptions {
  // Repository root the search is scoped to.
  root: string;
  // Files skipped entirely, relative to root — normally the anchor's own file,
  // which has already been checked.
  exclude?: readonly string[];
}

// Files above this size are not spec anchors; reading them would only cost
// time. Chosen well above any hand-written source file.
const MAX_FILE_BYTES = 1024 * 1024;

// Directories skipped by the fallback walk used when git is unavailable.
const WALK_SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

// REQ-ANC-003: search the whole repository for a symbol that was not found in
// its declared file. Results are sorted by path so that repeated runs over an
// unchanged tree report the same suggestion.
export function findSymbolInRepo(
  symbol: string,
  options: SearchOptions,
): SymbolMatch[] {
  const excluded = new Set(options.exclude ?? []);
  const matches: SymbolMatch[] = [];

  for (const file of listFiles(options.root)) {
    if (excluded.has(file)) continue;
    const content = readTextFile(join(options.root, file));
    if (content === undefined) continue;
    const line = grepStrategy.find(content, symbol);
    if (line !== undefined) matches.push({ file, line });
  }

  return matches.sort((a, b) =>
    a.file < b.file ? -1 : a.file > b.file ? 1 : 0,
  );
}

// REQ-ANC-003: the search respects `.gitignore`. Asking git is both the exact
// definition of that rule and cheaper than reimplementing it; the manual walk
// is only a fallback for trees that are not git repositories.
export function listFiles(root: string): string[] {
  return listFilesWithGit(root) ?? walk(root, "");
}

function listFilesWithGit(root: string): string[] | undefined {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (
    result.error ||
    result.status !== 0 ||
    typeof result.stdout !== "string"
  ) {
    return undefined;
  }
  return result.stdout.split("\0").filter((entry) => entry.length > 0);
}

function walk(root: string, prefix: string): string[] {
  const files: string[] = [];
  let entries;
  try {
    entries = readdirSync(join(root, prefix), { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (WALK_SKIP.has(entry.name)) continue;
      files.push(...walk(root, join(prefix, entry.name)));
      continue;
    }
    if (entry.isFile()) {
      files.push(join(prefix, entry.name).split(sep).join("/"));
    }
  }
  return files;
}

function readTextFile(path: string): string | undefined {
  try {
    if (statSync(path).size > MAX_FILE_BYTES) return undefined;
    return readFileSync(path, "utf8");
  } catch {
    // Unreadable or binary content is not where a spec anchor points.
    return undefined;
  }
}

// Normalizes a path for comparison against the entries `listFiles` returns.
export function toRepoPath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}
