import { spawnSync } from "node:child_process";
import type { EffectiveSpecs } from "../verify/effective.js";
import type { OpenChange } from "../verify/changes.js";

export interface OpenChangeSummary {
  change: string;
  // Days since `delta.md` first appeared in the history; absent when the
  // history cannot answer.
  ageInDays?: number;
  // REQ-CFG-009: how many of the change's requirements hold a dangling anchor.
  warningDebt: number;
  requirements: number;
}

// REQ-CFG-008 — Open change age is reported.
//
// Measured from the first appearance of `delta.md` in the history rather than
// from a `created` field, so nothing has to be maintained by hand and nothing
// can drift. An unavailable history yields an unknown age rather than an
// error: status informs, it never judges (REQ-CFG-006).
export function changeAge(
  change: OpenChange,
  root: string,
): number | undefined {
  const result = spawnSync(
    "git",
    [
      "log",
      "--diff-filter=A",
      "--follow",
      "-1",
      "--format=%ct",
      "--",
      `${change.display}/delta.md`,
    ],
    { cwd: root, shell: false, encoding: "utf8" },
  );
  if (result.status !== 0) return undefined;
  const seconds = Number.parseInt(result.stdout.trim(), 10);
  if (!Number.isFinite(seconds)) return undefined;

  const now = spawnSync("git", ["log", "-1", "--format=%ct"], {
    cwd: root,
    shell: false,
    encoding: "utf8",
  });
  const reference = Number.parseInt(now.stdout.trim(), 10);
  if (!Number.isFinite(reference)) return undefined;
  return Math.max(0, Math.floor((reference - seconds) / 86_400));
}

// REQ-CFG-009 — Warning debt per open change is reported.
//
// A change holding requirements nobody is implementing downgrades every one of
// them to a warning, which is exactly how a stale delta hides real work.
// Reporting age and debt together makes stalling visible without the tool
// deciding what counts as too long.
export function warningDebt(
  change: OpenChange,
  danglingRequirementIds: ReadonlySet<string>,
): number {
  let debt = 0;
  for (const id of change.inFlight) {
    if (danglingRequirementIds.has(id)) debt++;
  }
  return debt;
}

export function summarizeOpenChanges(
  effective: EffectiveSpecs,
  danglingRequirementIds: ReadonlySet<string>,
  root: string,
): OpenChangeSummary[] {
  return effective.changes.map((change) => {
    const age = changeAge(change, root);
    return {
      change: change.name,
      ...(age === undefined ? {} : { ageInDays: age }),
      warningDebt: warningDebt(change, danglingRequirementIds),
      requirements: change.inFlight.size,
    };
  });
}
