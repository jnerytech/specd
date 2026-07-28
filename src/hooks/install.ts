import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { OperationalError } from "../core/operational.js";
import { requireProjectRoot } from "../core/root.js";
import { HOOK_EVENTS, type HookEvent } from "./protocol.js";
import {
  mergeHookEntries,
  readSettings,
  serialize,
  type DesiredEntry,
} from "./settings.js";

export const SETTINGS_PATH = join(".claude", "settings.json");

// Running the gate after a read or a search would cost time and tell nobody
// anything: only a write can move code away from an anchor.
export const WRITE_TOOL_MATCHER = "Edit|MultiEdit|Write|NotebookEdit";

// How the hook invokes specd. Overridable because two real clients diverge:
// a project consuming the published package finds `specd` on PATH, and this
// repository has to run its own build output.
export const DEFAULT_EXECUTABLE = "specd";

export interface HookCommandOptions {
  event: HookEvent;
  fast: boolean;
  executable?: string;
}

// REQ-HOOK-007 — the fast gate on both events, by default.
//
// `--fast` skips exactly one layer, `project`, and `project` verifies nothing of
// specd's: it delegates to the project's own build command, which CI already
// runs. The five remaining layers are file reads, and the drift detection lives
// entirely in them.
//
// The argument is the asymmetry, not the cost. Whoever disables the hook because
// `dotnet test` takes four minutes loses the anchor check that took forty
// milliseconds along with it — the cheap part paying the price of the expensive
// one, and the cheap part is the whole differentiator.
//
// The flag is written into the command rather than read from `config.toml`, so
// the settings file says what actually runs.
export function hookCommand(options: HookCommandOptions): string {
  const executable = options.executable ?? DEFAULT_EXECUTABLE;
  return `${executable} hooks run ${options.event}${options.fast ? " --fast" : ""}`;
}

export interface InstallOptions {
  cwd?: string;
  // Writes the Stop command without `--fast`.
  fullOnStop?: boolean;
  force?: boolean;
  executable?: string;
}

export interface InstallResult {
  file: string;
  added: string[];
  unchanged: string[];
  replaced: string[];
  wrote: boolean;
}

export function desiredEntries(options: InstallOptions = {}): DesiredEntry[] {
  return HOOK_EVENTS.map((event) => ({
    event,
    ...(event === "post-tool-use" ? { matcher: WRITE_TOOL_MATCHER } : {}),
    command: hookCommand({
      event,
      fast: !(event === "stop" && options.fullOnStop === true),
      ...(options.executable === undefined
        ? {}
        : { executable: options.executable }),
    }),
  }));
}

// REQ-HOOK-001 / REQ-HOOK-002 — install by merging, and refuse when the existing
// entry disagrees with the one being written.
export function installHooks(options: InstallOptions = {}): InstallResult {
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const path = join(root, SETTINGS_PATH);
  const settings = readSettings(path);

  const outcome = mergeHookEntries(settings.raw, desiredEntries(options), {
    ...(options.force === undefined ? {} : { force: options.force }),
  });

  if (outcome.divergent.length > 0) {
    throw new OperationalError(
      `"${relative(root, path).split(sep).join("/")}" already holds a specd hook whose command differs from the one being installed:\n` +
        outcome.divergent
          .map(
            ({ entry, existing }) =>
              `  ${entry.event}\n    existing: ${existing}\n    wanted:   ${entry.command}`,
          )
          .join("\n") +
        "\nspecd does not choose between them. Run again with --force to replace, " +
        "or edit the file by hand.",
    );
  }

  const wrote = outcome.added.length > 0 || outcome.replaced.length > 0;
  if (wrote) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serialize(outcome.raw));
  }

  return {
    file: relative(root, path).split(sep).join("/"),
    added: outcome.added.map((entry) => entry.command),
    unchanged: outcome.unchanged.map((entry) => entry.command),
    replaced: outcome.replaced.map((entry) => entry.command),
    wrote,
  };
}

export function formatInstallResult(result: InstallResult): string {
  const lines: string[] = [];
  for (const command of result.added) lines.push(`  installed ${command}`);
  for (const command of result.replaced) lines.push(`  replaced  ${command}`);
  for (const command of result.unchanged) {
    lines.push(`  already installed ${command}`);
  }
  lines.unshift(
    result.wrote ? `Wrote ${result.file}` : `${result.file} unchanged`,
  );
  if (result.wrote) {
    lines.push("Nothing was staged — read the diff before it becomes history.");
  }
  return lines.join("\n");
}
