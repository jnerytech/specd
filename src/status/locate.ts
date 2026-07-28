import type { EffectiveSpecs } from "../verify/effective.js";

export type RequirementPlacement =
  // Written in `.specd/specs/`: the code exists.
  | "realized"
  // Written only in a change delta: the code is not written yet.
  | "in-flight"
  // In `.specd/specs/` and being replaced by an open change.
  | "in-modification"
  | "unknown";

export interface RequirementLocation {
  id: string;
  placement: RequirementPlacement;
  // Capability file, when the requirement is realized or in modification.
  specsFile?: string;
  // Delta file, when a change carries it.
  deltaFile?: string;
  change?: string;
}

// REQ-CFG-007 — Requirement location is reported.
//
// Under Modelo B an identifier is stable and its address is not: a requirement
// is written in a delta, moves into a capability when the change is archived,
// and moves back into a delta whenever one modifies it. Without this, finding a
// requirement means searching two trees and knowing which answer to trust.
export function locateRequirement(
  id: string,
  effective: EffectiveSpecs,
): RequirementLocation {
  const inSpecs = effective.capabilities
    .flatMap((capability) => capability.requirements)
    .find((requirement) => requirement.id === id);

  for (const change of effective.changes) {
    if (change.delta === undefined) continue;
    for (const entry of [...change.delta.added, ...change.delta.modified]) {
      if (entry.requirement.id !== id) continue;
      return {
        id,
        placement: inSpecs === undefined ? "in-flight" : "in-modification",
        ...(inSpecs === undefined ? {} : { specsFile: inSpecs.file }),
        deltaFile: change.delta.file,
        change: change.name,
      };
    }
  }

  if (inSpecs !== undefined) {
    return { id, placement: "realized", specsFile: inSpecs.file };
  }
  // REQ-CFG-006: status informs, it never judges. An unknown identifier is
  // reported as unknown, not treated as an error.
  return { id, placement: "unknown" };
}

export function locateAll(effective: EffectiveSpecs): RequirementLocation[] {
  const ids = new Set<string>();
  for (const capability of effective.capabilities) {
    for (const requirement of capability.requirements) ids.add(requirement.id);
  }
  for (const change of effective.changes) {
    for (const id of change.inFlight) ids.add(id);
  }
  return [...ids].sort().map((id) => locateRequirement(id, effective));
}
