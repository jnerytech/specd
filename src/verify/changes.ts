import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseDeltaFile, type Delta } from "../parser/delta.js";
import type { Diagnostic } from "../parser/diagnostics.js";
import { loadTasks, type Task } from "../parser/task.js";

// REQ-ARC-006: archived changes live under this directory. It sits inside
// `.specd/changes/` and is never itself a change — the old reader filtered only
// on `isDirectory()` and survived by the accident that "2" sorts before "a".
export const ARCHIVE_DIRECTORY = "archive";

export interface OpenChange {
  name: string;
  directory: string;
  // Repository-relative path, for diagnostics.
  display: string;
  // Absent when `delta.md` is missing or unparseable.
  delta?: Delta;
  tasks: Task[];
  diagnostics: Diagnostic[];
  // Identifiers the change declares under ADDED or MODIFIED.
  inFlight: Set<string>;
}

// Every unarchived change, in stable name order.
//
// Plural on purpose. The graduated anchor policy used to ask which single
// change was "active", and picking one from several was guessing (P4). Under
// Modelo B severity comes from where a requirement is written, so no consumer
// has to choose: `anchors` unions every open change, `coverage` and `evidence`
// iterate per change, and `archive` takes the change as an explicit argument.
export function readOpenChanges(root: string): OpenChange[] {
  const changesDir = join(root, ".specd", "changes");
  if (!existsSync(changesDir)) return [];

  const changes: OpenChange[] = [];
  for (const entry of readdirSync(changesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== ARCHIVE_DIRECTORY)
    .map((e) => e.name)
    .sort()) {
    changes.push(readChange(root, changesDir, entry));
  }
  return changes;
}

export function readChange(
  root: string,
  changesDir: string,
  name: string,
): OpenChange {
  const directory = join(changesDir, name);
  const display = relative(root, directory).split(sep).join("/");
  const diagnostics: Diagnostic[] = [];

  const deltaPath = join(directory, "delta.md");
  let delta: Delta | undefined;
  if (existsSync(deltaPath)) {
    const parsed = parseDeltaFile(deltaPath, `${display}/delta.md`);
    diagnostics.push(...parsed.diagnostics);
    delta = parsed.delta;
  }

  const loaded = loadTasks(directory, display);
  diagnostics.push(...loaded.diagnostics);

  const inFlight = new Set<string>();
  for (const entry of [...(delta?.added ?? []), ...(delta?.modified ?? [])]) {
    inFlight.add(entry.requirement.id);
  }

  return {
    name,
    directory,
    display,
    ...(delta === undefined ? {} : { delta }),
    tasks: loaded.tasks,
    diagnostics,
    inFlight,
  };
}

export function findOpenChange(
  root: string,
  name: string,
): OpenChange | undefined {
  return readOpenChanges(root).find((change) => change.name === name);
}
