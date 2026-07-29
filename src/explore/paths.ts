import { join } from "node:path";

export const BUNDLE_DIRECTORY = "explore";
export const MANIFEST_FILE = "manifest.json";

// REQ-EXP-010 — the prose of the exploration, beside the machine collection.
//
// Same directory because they are the same exploration seen from two sides, and
// splitting by directory would separate things that are read together. Written
// by whoever explores, never by this command: `explore` collects sources, and
// the reasoning about them is not a source.
export const NOTES_FILE = "notes.md";

export function changePath(root: string, change: string): string {
  return join(root, ".specd", "changes", change);
}

// REQ-EXP-006 — Bundle is versioned.
//
// The bundle lives inside the change directory, so it is committed with the
// work it justifies. Nothing here writes to `~/` and nothing adds a `.gitignore`
// entry: context that cannot be reviewed in a diff is context nobody can audit.
export function bundlePath(root: string, change: string): string {
  return join(root, ".specd", "changes", change, BUNDLE_DIRECTORY);
}

export function manifestPath(root: string, change: string): string {
  return join(bundlePath(root, change), MANIFEST_FILE);
}

export function notesPath(root: string, change: string): string {
  return join(bundlePath(root, change), NOTES_FILE);
}

// Output file of one source inside the bundle.
export function sourcePath(
  root: string,
  change: string,
  sourceName: string,
): string {
  return join(bundlePath(root, change), `${sourceName}.json`);
}
