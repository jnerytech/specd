import { existsSync, readFileSync } from "node:fs";
import { OperationalError } from "../core/operational.js";
import { HOST_EVENT_NAME, type HookEvent } from "./protocol.js";

// The settings file is the host's, and specd owns a few entries inside it. The
// shapes below are the parts specd needs to understand; everything else is
// carried through untouched as `unknown`.
export interface HookCommand {
  type?: string;
  command?: string;
  [key: string]: unknown;
}

export interface MatcherGroup {
  matcher?: string;
  hooks: HookCommand[];
  [key: string]: unknown;
}

export type SettingsObject = Record<string, unknown>;

export interface Settings {
  path: string;
  existed: boolean;
  raw: SettingsObject;
}

// Every command specd writes carries this. Recognising our own entries by the
// command they run — rather than by position, order or a marker key we would
// have to keep in sync — is what makes uninstall safe next to third-party hooks.
export const SPECD_HOOK_MARKER = "specd hooks run";

export function isSpecdHook(entry: HookCommand): boolean {
  return typeof entry.command === "string"
    ? entry.command.includes(SPECD_HOOK_MARKER)
    : false;
}

// REQ-HOOK-003 — a settings file specd cannot read is never overwritten.
//
// Exit 2 and stop. `--force` authorises replacing configuration we could read;
// forcing a write over an unreadable file destroys configuration nobody can name
// afterwards, including us. That is not a knob, it is data loss with a flag on it.
export function readSettings(path: string): Settings {
  if (!existsSync(path)) return { path, existed: false, raw: {} };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new OperationalError(
      `Cannot read "${path}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new OperationalError(
      `"${path}" is not valid JSON and was left untouched: ` +
        `${cause instanceof Error ? cause.message : String(cause)}. ` +
        "Fix the file by hand; specd will not rewrite a settings file it cannot read.",
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OperationalError(
      `"${path}" was left untouched: expected a JSON object at the top level, found ${shapeOf(parsed)}.`,
    );
  }

  const raw = parsed as SettingsObject;
  assertHooksShape(raw, path);
  return { path, existed: true, raw };
}

// The `hooks` key is the only part specd navigates, so it is the only part whose
// shape has to be checked. An unexpected shape is a refusal, never a repair: a
// tool that "fixes" a structure it did not understand is guessing (P4).
function assertHooksShape(raw: SettingsObject, path: string): void {
  const hooks = raw["hooks"];
  if (hooks === undefined) return;
  if (hooks === null || typeof hooks !== "object" || Array.isArray(hooks)) {
    throw new OperationalError(
      `"${path}" was left untouched: "hooks" must be an object, found ${shapeOf(hooks)}.`,
    );
  }

  for (const [event, groups] of Object.entries(hooks as SettingsObject)) {
    if (!Array.isArray(groups)) {
      throw new OperationalError(
        `"${path}" was left untouched: "hooks.${event}" must be an array, found ${shapeOf(groups)}.`,
      );
    }
    for (const [index, group] of groups.entries()) {
      if (group === null || typeof group !== "object" || Array.isArray(group)) {
        throw new OperationalError(
          `"${path}" was left untouched: "hooks.${event}[${index}]" must be an object, found ${shapeOf(group)}.`,
        );
      }
      const inner = (group as MatcherGroup).hooks;
      if (inner !== undefined && !Array.isArray(inner)) {
        throw new OperationalError(
          `"${path}" was left untouched: "hooks.${event}[${index}].hooks" must be an array, found ${shapeOf(inner)}.`,
        );
      }
    }
  }
}

function shapeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

export interface DesiredEntry {
  event: HookEvent;
  // Absent means the group matches every tool the event fires for.
  matcher?: string;
  command: string;
}

export interface MergeOutcome {
  raw: SettingsObject;
  added: DesiredEntry[];
  // Entries already present with exactly the command we would write.
  unchanged: DesiredEntry[];
  // Entries present with a different command. Not written unless `force`.
  divergent: { entry: DesiredEntry; existing: string }[];
  replaced: DesiredEntry[];
}

export interface MergeOptions {
  force?: boolean;
}

// REQ-HOOK-001 — merge, never rewrite.
//
// The settings file belongs to the user. Reading the keys specd understands and
// replacing the whole document with them is the same disease as an `archive`
// that overwrites a capability: the tool assuming that what it knows how to
// write is everything that was there.
//
// REQ-HOOK-002 — "idempotent or abort" is a false dichotomy. An identical entry
// is a no-op because there is nothing to decide; a divergent entry is two
// possible states with no basis for choosing between them, which is P4.
export function mergeHookEntries(
  raw: SettingsObject,
  desired: readonly DesiredEntry[],
  options: MergeOptions = {},
): MergeOutcome {
  const next: SettingsObject = { ...raw };
  const hooks: SettingsObject = {
    ...((next["hooks"] as SettingsObject) ?? {}),
  };
  const outcome: MergeOutcome = {
    raw: next,
    added: [],
    unchanged: [],
    divergent: [],
    replaced: [],
  };

  for (const entry of desired) {
    const eventName = HOST_EVENT_NAME[entry.event];
    const groups = [...((hooks[eventName] as MatcherGroup[]) ?? [])].map(
      (group) => ({ ...group, hooks: [...(group.hooks ?? [])] }),
    );

    const existing = locate(groups, entry.command);
    if (existing?.kind === "same") {
      outcome.unchanged.push(entry);
      hooks[eventName] = groups;
      continue;
    }
    if (existing?.kind === "different") {
      if (options.force !== true) {
        outcome.divergent.push({ entry, existing: existing.command });
        continue;
      }
      const group = groups[existing.group] as MatcherGroup;
      group.hooks[existing.index] = {
        ...group.hooks[existing.index],
        type: "command",
        command: entry.command,
      };
      outcome.replaced.push(entry);
      hooks[eventName] = groups;
      continue;
    }

    const target = groups.find((group) => group.matcher === entry.matcher);
    if (target === undefined) {
      groups.push({
        ...(entry.matcher === undefined ? {} : { matcher: entry.matcher }),
        hooks: [{ type: "command", command: entry.command }],
      });
    } else {
      target.hooks.push({ type: "command", command: entry.command });
    }
    outcome.added.push(entry);
    hooks[eventName] = groups;
  }

  // Only touch `hooks` when something was actually placed there: a refusal must
  // leave the document byte-identical, not merely equivalent.
  if (
    outcome.added.length > 0 ||
    outcome.replaced.length > 0 ||
    outcome.unchanged.length > 0
  ) {
    next["hooks"] = hooks;
  }
  return outcome;
}

type Located =
  | { kind: "same"; group: number; index: number; command: string }
  | { kind: "different"; group: number; index: number; command: string };

function locate(
  groups: readonly MatcherGroup[],
  command: string,
): Located | undefined {
  for (const [group, entry] of groups.entries()) {
    for (const [index, hook] of (entry.hooks ?? []).entries()) {
      if (!isSpecdHook(hook)) continue;
      const found = hook.command as string;
      return found === command
        ? { kind: "same", group, index, command: found }
        : { kind: "different", group, index, command: found };
    }
  }
  return undefined;
}

export function serialize(raw: SettingsObject): string {
  return `${JSON.stringify(raw, null, 2)}\n`;
}
