import { syncedHash, type Projection, type ProjectionValue } from "./hash.js";

// REQ-SYNC-003 — Field ownership is declared, not negotiated.
//
// The split is the line between what is decided by writing and what is decided
// by working. Requirement content is a spec decision: the board has no context
// to rewrite it. Status and assignee are execution decisions: the spec has no
// way to know who picked the card up yesterday.
//
// There is no "both own it" category. That is the polite name for last-write-
// wins, and last-write-wins on a client's board is how someone's afternoon
// disappears.
//
// `close` writing a status is the single declared exception, and it happens
// only for an archived item — spelled out here so it never becomes precedent.
export const FIELD_OWNERSHIP = {
  spec: ["title", "body", "parent", "fields"],
  board: ["status", "assignee", "iteration"],
} as const;

export type MergeOutcome =
  "create" | "unchanged" | "push" | "restore" | "converged" | "conflict";

export interface FieldConflict {
  field: string;
  ours?: ProjectionValue;
  theirs?: ProjectionValue;
}

export interface MergeInput {
  // Human-facing identifier of the item, used in reports and conflict lists.
  item: string;
  // The `synced_hash` recorded at the last sync. Absent means never synced.
  base?: string;
  ours: Projection;
  // Absent means the item does not exist on the board.
  theirs?: Projection;
}

export interface MergeResult {
  item: string;
  outcome: MergeOutcome;
  oursHash: string;
  theirsHash?: string;
  conflicts: FieldConflict[];
}

// REQ-SYNC-005 — Both sides changed is a conflict, and conflicts are never
// resolved.
//
// Three hashes, five outcomes:
//
//   ours == base, theirs == base   -> unchanged
//   ours != base, theirs == base   -> push
//   ours == base, theirs != base   -> restore
//   ours != base, theirs != base, equal to each other -> converged
//   ours != base, theirs != base, different           -> conflict
//
// `restore` earns its own name instead of being reported as an update. Someone
// edited a spec-owned field on the board. Ownership decides, so it is not
// ambiguous and not no-guessing-on-conflict — but it is a destructive write, and a destructive write
// that reads as "updated" in the report is one nobody notices.
export function mergeThreeWay(input: MergeInput): MergeResult {
  const oursHash = syncedHash(input.ours);

  if (input.theirs === undefined) {
    return { item: input.item, outcome: "create", oursHash, conflicts: [] };
  }

  const theirsHash = syncedHash(input.theirs);
  const base = input.base;

  // No recorded base but the item exists remotely: two states and nothing to
  // choose between them. no-guessing-on-conflict — refuse rather than pick.
  if (base === undefined) {
    if (oursHash === theirsHash) {
      return {
        item: input.item,
        outcome: "converged",
        oursHash,
        theirsHash,
        conflicts: [],
      };
    }
    return {
      item: input.item,
      outcome: "conflict",
      oursHash,
      theirsHash,
      conflicts: fieldConflicts(input.ours, input.theirs),
    };
  }

  const oursChanged = oursHash !== base;
  const theirsChanged = theirsHash !== base;

  let outcome: MergeOutcome;
  if (!oursChanged && !theirsChanged) outcome = "unchanged";
  else if (oursChanged && !theirsChanged) outcome = "push";
  else if (!oursChanged && theirsChanged) outcome = "restore";
  else if (oursHash === theirsHash) outcome = "converged";
  else outcome = "conflict";

  return {
    item: input.item,
    outcome,
    oursHash,
    theirsHash,
    conflicts:
      outcome === "conflict" ? fieldConflicts(input.ours, input.theirs) : [],
  };
}

// Field-by-field difference, so the conflict list names what actually differs
// instead of two opaque digests.
export function fieldConflicts(
  ours: Projection,
  theirs: Projection,
): FieldConflict[] {
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])];
  const conflicts: FieldConflict[] = [];
  for (const field of keys.sort()) {
    const a = ours[field];
    const b = theirs[field];
    if (sameValue(a, b)) continue;
    conflicts.push({
      field,
      ...(a === undefined ? {} : { ours: a }),
      ...(b === undefined ? {} : { theirs: b }),
    });
  }
  return conflicts;
}

function sameValue(a?: ProjectionValue, b?: ProjectionValue): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return a === b;
}
