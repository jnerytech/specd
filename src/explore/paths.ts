import { join } from "node:path";

export const BUNDLE_DIRECTORY = "explore";
export const MANIFEST_FILE = "manifest.json";

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

// Output file of one source inside the bundle.
export function sourcePath(
  root: string,
  change: string,
  sourceName: string,
): string {
  return join(bundlePath(root, change), `${sourceName}.json`);
}
