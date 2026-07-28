import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ModuleGraph {
  // Every module reachable from the entry, absolute paths, in visit order.
  files: string[];
  // Specifier -> the modules that import it, for both local and bare imports.
  importers: Map<string, string[]>;
}

export interface ForbiddenMatch {
  specifier: string;
  importer: string;
  reason: string;
}

export interface ForbiddenRule {
  // Matched against the raw import specifier.
  pattern: RegExp;
  reason: string;
}

const LINE_COMMENT = /\/\/[^\n]*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const SPECIFIERS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']/g,
  /^\s*import\s+["']([^"']+)["']/gm,
];

// Walks the import graph from `entry`, following local modules only. Bare
// specifiers are recorded but not followed: what matters is that verify never
// names them, not what they contain.
export function collectImportGraph(entry: string): ModuleGraph {
  const files: string[] = [];
  const importers = new Map<string, string[]>();
  const queue = [resolve(entry)];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) continue;
    files.push(file);

    for (const specifier of importsOf(file)) {
      importers.set(specifier, [...(importers.get(specifier) ?? []), file]);
      if (!specifier.startsWith(".")) continue;
      const target = resolveLocal(dirname(file), specifier);
      if (target !== undefined) queue.push(target);
    }
  }

  return { files, importers };
}

export function findForbidden(
  graph: ModuleGraph,
  rules: readonly ForbiddenRule[],
): ForbiddenMatch[] {
  const matches: ForbiddenMatch[] = [];
  for (const [specifier, importedBy] of graph.importers) {
    for (const rule of rules) {
      if (!rule.pattern.test(specifier)) continue;
      for (const importer of importedBy) {
        matches.push({ specifier, importer, reason: rule.reason });
      }
    }
  }
  return matches;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
  const found = new Set<string>();
  for (const pattern of SPECIFIERS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      found.add(match[1] as string);
    }
  }
  return [...found];
}

// TypeScript ESM imports name the emitted `.js`; the source next to it is
// `.ts`. Both are tried so the walk works on sources and on build output.
function resolveLocal(from: string, specifier: string): string | undefined {
  const base = join(from, specifier);
  const candidates = [
    base.replace(/\.js$/, ".ts"),
    base,
    `${base}.ts`,
    join(base, "index.ts"),
  ];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile());
}
