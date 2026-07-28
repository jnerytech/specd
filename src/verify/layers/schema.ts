import { error, type Diagnostic } from "../../parser/diagnostics.js";
import {
  resultFrom,
  type VerifyLayer,
  type VerifyLayerContext,
} from "./types.js";

// The schema layer reports what the parsers found across the whole effective
// spec: capability layout and delta format (REQ-FMT-*), EARS grammar
// (REQ-EARS-*), task frontmatter (REQ-FMT-007).
//
// It reads the deltas of open changes as well as `.specd/specs/`. Under Modelo
// B that is where new requirements are written, so a schema layer looking only
// at capabilities would be green because it was not looking.
export const schemaLayer: VerifyLayer = {
  name: "schema",
  run(ctx) {
    const violations: Diagnostic[] = [...ctx.effective.diagnostics];
    violations.push(...checkRetiredReuse(ctx));
    return Promise.resolve(resultFrom(violations));
  },
};

// REQ-FMT-004 — Retired identifiers are never reused.
//
// `parseCapability` already rejects a retired identifier reappearing as a
// section of its own capability. This catches what it cannot see: an open
// change adding an identifier some capability retired, and a capability
// reusing an identifier another capability retired.
export function checkRetiredReuse(ctx: VerifyLayerContext): Diagnostic[] {
  const retired = new Map<string, string>();
  for (const capability of ctx.effective.capabilities) {
    for (const id of capability.retired) retired.set(id, capability.name);
  }
  if (retired.size === 0) return [];

  const findings: Diagnostic[] = [];
  for (const entry of ctx.effective.requirements) {
    const owner = retired.get(entry.requirement.id);
    if (owner === undefined) continue;
    // A capability reusing its own retired identifier is already reported by
    // the capability parser; reporting it twice adds noise, not information.
    if (entry.origin === "specs" && owner === entry.capability) continue;
    findings.push(
      error({
        file: entry.requirement.file,
        line: entry.requirement.line,
        requirementId: entry.requirement.id,
        message:
          `Requirement ${entry.requirement.id} is listed as retired by capability "${owner}". ` +
          `A retired identifier is never reused — pick a new one, so a reference written before ` +
          `the retirement cannot silently resolve to different behaviour.`,
      }),
    );
  }
  return findings;
}
