import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ConfigFixture {
  cwd: string;
  globalPath: string;
  cleanup: () => void;
}

// Creates an isolated workspace + global config pair. Omitting a content
// argument leaves that file absent.
export function makeFixture(contents: {
  workspace?: string;
  global?: string;
}): ConfigFixture {
  const root = mkdtempSync(join(tmpdir(), "specd-config-"));
  const cwd = join(root, "workspace");
  mkdirSync(join(cwd, ".specd"), { recursive: true });
  const globalPath = join(root, "global", "config.toml");
  mkdirSync(join(root, "global"), { recursive: true });
  if (contents.workspace !== undefined) {
    writeFileSync(join(cwd, ".specd", "config.toml"), contents.workspace);
  }
  if (contents.global !== undefined) {
    writeFileSync(globalPath, contents.global);
  }
  return {
    cwd,
    globalPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
