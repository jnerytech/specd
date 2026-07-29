import { existsSync, readdirSync, statSync, type Stats } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { OperationalError } from "../core/operational.js";
import { SPECD_DIRECTORY } from "../core/root.js";
import { ARCHIVE_DIRECTORY, readOpenChanges } from "../verify/changes.js";

// A file picked for reading, already in the order it will be heard.
//
// Ordering happens here rather than in the consumer so that REQ-READ-003's
// determinism has one place to hold. A document builder that re-sorted would be
// a second opinion about order, and two opinions drift.
export interface ReadFile {
  absolutePath: string;
  // Relative to the root the collection was made from, forward slashes.
  displayPath: string;
}

const MARKDOWN = ".md";

// Not a `.gitignore` reader. `.specd/` is tracked, and an arbitrary folder only
// needs the two directories that would otherwise dominate the walk. Reading
// ignore files would buy a dependency for a case nobody has asked for
// (config-only-on-divergence).
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

// REQ-READ-001 — The default selection leaves the archive out.
//
// Two thirds of this repository's `.specd/` by volume is tasks of closed
// changes: 29.662 words against 13.745 of capabilities. Read aloud that is over
// three hours between the listener and what they came for, so the archive is
// reachable rather than default.
export function collectDefault(
  root: string,
  options: { all: boolean },
): ReadFile[] {
  const files: ReadFile[] = [];

  const specsDirectory = join(root, SPECD_DIRECTORY, "specs");
  if (existsSync(specsDirectory)) {
    files.push(...markdownUnder(root, specsDirectory));
  }

  // `readOpenChanges` already excludes ARCHIVE_DIRECTORY, so the exclusion has
  // one implementation. Restating it here would be a second place for it to
  // diverge, which is the defect REQ-CFG-011 and REQ-CLI-009 both exist to stop.
  for (const change of readOpenChanges(root)) {
    files.push(...markdownUnder(root, change.directory));
  }

  if (options.all) {
    const archive = join(root, SPECD_DIRECTORY, "changes", ARCHIVE_DIRECTORY);
    if (existsSync(archive)) files.push(...markdownUnder(root, archive));
  }

  return assertNotEmpty(files, `${join(root, SPECD_DIRECTORY)}`);
}

// REQ-READ-002 — Explicit paths replace the default selection.
export function collectPaths(
  cwd: string,
  paths: readonly string[],
): ReadFile[] {
  const files: ReadFile[] = [];

  // In the order they were written. Someone naming three files is describing a
  // reading order, and sorting them would discard it.
  for (const path of paths) {
    const absolute = isAbsolute(path) ? path : resolve(cwd, path);
    const stats = describe(absolute, path);

    if (stats.isDirectory()) {
      files.push(...markdownUnder(cwd, absolute));
      continue;
    }
    if (!absolute.endsWith(MARKDOWN)) {
      throw new OperationalError(
        `\`specd read\` reads Markdown, and ${path} is not a ${MARKDOWN} file. ` +
          `Name a ${MARKDOWN} file, or a directory to read every ${MARKDOWN} inside it.`,
      );
    }
    files.push({ absolutePath: absolute, displayPath: display(cwd, absolute) });
  }

  return assertNotEmpty(files, paths.join(", "));
}

// absence-is-not-compliance, in the form the listener would meet it: serving a
// blank page answers "here it is" to a question the tool could not answer, and
// an empty document reads exactly like an empty directory. Whoever pointed at
// the wrong folder has to be told they pointed at the wrong folder.
function assertNotEmpty(files: ReadFile[], where: string): ReadFile[] {
  if (files.length > 0) return files;
  throw new OperationalError(
    `No ${MARKDOWN} files found in ${where}, so there is nothing to read. ` +
      `Name a path that contains Markdown, or run \`specd read --all\` to include archived changes.`,
  );
}

function markdownUnder(base: string, directory: string): ReadFile[] {
  const files: ReadFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      files.push(...markdownUnder(base, absolute));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(MARKDOWN)) continue;
    files.push({
      absolutePath: absolute,
      displayPath: display(base, absolute),
    });
  }
  return files;
}

// The path is named in the error because a path that does not resolve is the
// one thing the reader can act on, and `ENOENT` alone does not say which of
// three arguments was wrong.
function describe(absolute: string, asWritten: string): Stats {
  if (!existsSync(absolute)) {
    throw new OperationalError(
      `No such file or directory: ${asWritten} (looked at ${absolute}).`,
    );
  }
  try {
    return statSync(absolute);
  } catch (cause) {
    throw new OperationalError(
      `Cannot read ${asWritten}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

function display(base: string, absolute: string): string {
  const path = relative(base, absolute);
  return path === "" ? absolute : path.split(sep).join("/");
}
