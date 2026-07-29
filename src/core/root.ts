import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { OperationalError } from "./operational.js";

export const SPECD_DIRECTORY = ".specd";

// REQ-CFG-010 — Project root is the directory holding `.specd/`.
//
// Not the working directory, and not the git toplevel. Those were the two
// competing definitions living inside a single command: the ladder resolved
// anchor paths from the cwd while the fallback search listed files from the git
// toplevel. They agree in this repository and disagree exactly where the tool
// was first run against something else — a specd project inside a tree the
// parent repository ignores.
//
// A specd project is defined by having `.specd/`. That holds without git, and
// holds when a parent repository ignores the whole subtree.
export function findProjectRoot(from: string): string | undefined {
  let current = resolve(from);
  for (;;) {
    if (existsSync(join(current, SPECD_DIRECTORY))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

// Same lookup, but refusing to continue when there is no project.
//
// absence-is-not-compliance: "I am not in a specd project" is a third outcome, not a pass. Exit 2 —
// nothing was judged (REQ-CLI-004).
export function requireProjectRoot(from: string): string {
  const root = findProjectRoot(from);
  if (root !== undefined) return root;
  throw new OperationalError(
    `No ${SPECD_DIRECTORY}/ directory at or above ${resolve(from)}, so this is not a specd project. ` +
      `Run \`specd init\` to create one, or run from inside a project that already has it.`,
  );
}
