import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadCapabilities,
  type Capability,
  type LoadedCapabilities,
} from "../parser/capability.js";
import { error, type Diagnostic } from "../parser/diagnostics.js";
import type { Requirement } from "../parser/requirement.js";
import { readOpenChanges, type OpenChange } from "./changes.js";

export type RequirementOrigin = "specs" | "delta";

export interface EffectiveRequirement {
  requirement: Requirement;
  // Where the text being checked came from. `specs` means realized truth, so a
  // dangling anchor is drift; `delta` means work in flight, so it is pending.
  origin: RequirementOrigin;
  capability: string;
  // Set when origin is `delta`.
  change?: string;
}

export interface EffectiveSpecs {
  requirements: EffectiveRequirement[];
  // Capabilities as written on disk, before the overlay. `archive` needs the
  // unmodified files to apply a delta to them.
  capabilities: Capability[];
  changes: OpenChange[];
  diagnostics: Diagnostic[];
}

export interface EffectiveOptions {
  // Report paths relative to this root.
  pathsRelativeTo?: string;
  changes?: OpenChange[];
}

// The effective spec: `.specd/specs/` with the deltas of open changes applied
// on top.
//
//   specs ⊕ ADDED ⊕ MODIFIED ⊖ REMOVED
//
// `verify` runs its layers over the result and `archive` persists it, so the
// application logic is written once and exercised on every run of the gate.
// The failure mode "archive wrote something different from what verify
// validated" cannot exist.
//
// A requirement under MODIFIED shadows its `specs/` copy rather than
// coexisting with it. Without that, a change moving a symbol would break the
// old copy's anchor and hold the gate red for its whole duration.
export function effectiveSpecs(
  root: string,
  options: EffectiveOptions = {},
): EffectiveSpecs {
  const specsDir = join(root, ".specd", "specs");
  const loaded: LoadedCapabilities = existsSync(specsDir)
    ? loadCapabilities(specsDir, {
        ...(options.pathsRelativeTo === undefined
          ? {}
          : { pathsRelativeTo: options.pathsRelativeTo }),
      })
    : { capabilities: [], diagnostics: [] };

  const changes = options.changes ?? readOpenChanges(root);
  const diagnostics: Diagnostic[] = [...loaded.diagnostics];
  for (const change of changes) diagnostics.push(...change.diagnostics);

  // Insertion order is preserved so the report reads in file order, with
  // requirements a change adds appearing after the realized ones.
  const effective = new Map<string, EffectiveRequirement>();
  for (const capability of loaded.capabilities) {
    for (const requirement of capability.requirements) {
      effective.set(requirement.id, {
        requirement,
        origin: "specs",
        capability: capability.name,
      });
    }
  }

  // Which change last touched an identifier, so a second change touching it is
  // reported as a conflict instead of silently winning (P4).
  const claimedBy = new Map<string, string>();

  for (const change of changes) {
    if (change.delta === undefined) continue;

    for (const entry of change.delta.added) {
      if (claimConflict(claimedBy, entry.requirement.id, change, diagnostics)) {
        continue;
      }
      const existing = effective.get(entry.requirement.id);
      if (existing !== undefined && existing.origin === "specs") {
        diagnostics.push(
          error({
            file: change.delta.file,
            line: entry.requirement.line,
            requirementId: entry.requirement.id,
            message:
              `Requirement ${entry.requirement.id} is ADDED by ${change.name} but already exists in ` +
              `${existing.requirement.file}. ADDED means the requirement does not exist yet; ` +
              `to change one that does, put it under MODIFIED.`,
          }),
        );
        continue;
      }
      effective.set(entry.requirement.id, {
        requirement: entry.requirement,
        origin: "delta",
        capability: entry.capability ?? "",
        change: change.name,
      });
    }

    for (const entry of change.delta.modified) {
      if (claimConflict(claimedBy, entry.requirement.id, change, diagnostics)) {
        continue;
      }
      const existing = effective.get(entry.requirement.id);
      if (existing === undefined) {
        diagnostics.push(
          error({
            file: change.delta.file,
            line: entry.requirement.line,
            requirementId: entry.requirement.id,
            message:
              `Requirement ${entry.requirement.id} is MODIFIED by ${change.name} but exists nowhere. ` +
              `MODIFIED replaces a section that is already realized; to introduce one, use ADDED.`,
          }),
        );
        continue;
      }
      effective.set(entry.requirement.id, {
        requirement: entry.requirement,
        origin: "delta",
        capability: entry.capability ?? existing.capability,
        change: change.name,
      });
    }

    for (const id of change.delta.removed) {
      if (claimConflict(claimedBy, id, change, diagnostics)) continue;
      if (!effective.delete(id)) {
        diagnostics.push(
          error({
            file: change.delta.file,
            line: 1,
            requirementId: id,
            message: `Requirement ${id} is REMOVED by ${change.name} but exists nowhere.`,
          }),
        );
      }
    }
  }

  return {
    requirements: [...effective.values()],
    capabilities: loaded.capabilities,
    changes,
    diagnostics,
  };
}

function claimConflict(
  claimedBy: Map<string, string>,
  id: string,
  change: OpenChange,
  diagnostics: Diagnostic[],
): boolean {
  const first = claimedBy.get(id);
  if (first !== undefined) {
    diagnostics.push(
      error({
        file: change.delta?.file ?? change.display,
        line: 1,
        requirementId: id,
        message:
          `Requirement ${id} is claimed by both ${first} and ${change.name}. ` +
          `Two open changes editing the same requirement is a conflict specd will not resolve.`,
      }),
    );
    return true;
  }
  claimedBy.set(id, change.name);
  return false;
}
