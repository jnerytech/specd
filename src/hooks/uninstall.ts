import { writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { requireProjectRoot } from "../core/root.js";
import { SETTINGS_PATH } from "./install.js";
import {
  isSpecdHook,
  readSettings,
  serialize,
  type MatcherGroup,
  type SettingsObject,
} from "./settings.js";

export interface UninstallOptions {
  cwd?: string;
}

export interface UninstallResult {
  file: string;
  removed: string[];
  wrote: boolean;
}

// REQ-HOOK-004 — remove only what specd wrote.
//
// The rule that matters is in the two container cases: a container emptied *by
// this removal* is removed, and a container that was already empty beforehand is
// preserved. An empty array the user put there is their configuration, even
// though it configures nothing — and specd has no business tidying it.
export function uninstallHooks(
  options: UninstallOptions = {},
): UninstallResult {
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const path = join(root, SETTINGS_PATH);
  const file = relative(root, path).split(sep).join("/");
  const settings = readSettings(path);
  if (!settings.existed) return { file, removed: [], wrote: false };

  const raw: SettingsObject = { ...settings.raw };
  const hooks = raw["hooks"] as SettingsObject | undefined;
  if (hooks === undefined) return { file, removed: [], wrote: false };

  const removed: string[] = [];
  const nextHooks: SettingsObject = {};

  for (const [event, value] of Object.entries(hooks)) {
    const groups = value as MatcherGroup[];
    const keptGroups: MatcherGroup[] = [];

    for (const group of groups) {
      const entries = group.hooks ?? [];
      const kept = entries.filter((entry) => {
        if (!isSpecdHook(entry)) return true;
        removed.push(entry.command as string);
        return false;
      });
      // Emptied by us — drop it. Empty before us — keep it.
      if (kept.length === 0 && entries.length > 0) continue;
      keptGroups.push({ ...group, hooks: kept });
    }

    if (keptGroups.length === 0 && groups.length > 0) continue;
    nextHooks[event] = keptGroups;
  }

  if (removed.length === 0) return { file, removed: [], wrote: false };

  if (Object.keys(nextHooks).length === 0 && Object.keys(hooks).length > 0) {
    delete raw["hooks"];
  } else {
    raw["hooks"] = nextHooks;
  }

  writeFileSync(path, serialize(raw));
  return { file, removed, wrote: true };
}

export function formatUninstallResult(result: UninstallResult): string {
  if (!result.wrote) {
    return `${result.file} holds no specd hook — nothing to remove.`;
  }
  return [
    `Wrote ${result.file}`,
    ...result.removed.map((command) => `  removed ${command}`),
    "Nothing was staged — read the diff before it becomes history.",
  ].join("\n");
}
