import { boardCardMode } from "../../config/schema.js";
import { error, type Diagnostic } from "../../parser/diagnostics.js";
import { ChangeFrontmatterSchema } from "../../parser/change.js";
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
    violations.push(...checkDeclaredCard(ctx));
    return Promise.resolve(resultFrom(violations));
  },
};

// REQ-FMT-011 / REQ-CFG-012 — a change declares the card it was born from,
// wherever the configuration says a card is required.
//
// The structural half of REQ-FMT-011 lives in the parser, which is where a
// missing `proposal.md` or a half-written `card` is caught. This half needs the
// configuration, and the configuration is the only thing allowed to answer it:
// a repository without a board is never asked for a card, and one that declares
// `card = "optional"` has answered for all of its changes at once.
export function checkDeclaredCard(ctx: VerifyLayerContext): Diagnostic[] {
  if (boardCardMode(ctx.config) !== "required") return [];

  const findings: Diagnostic[] = [];
  for (const change of ctx.effective.changes) {
    if (change.card !== undefined) continue;
    findings.push(
      error({
        file: `${change.display}/${ChangeFrontmatterSchema.file}`,
        line: 1,
        message:
          `Change "${change.name}" declares no board card, and [board] card = "required". ` +
          `Declare "card" with ${ChangeFrontmatterSchema.cardFields.join(" and ")} in the frontmatter, ` +
          `or set [board] card = "optional" for this repository.`,
      }),
    );
  }
  return findings;
}

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
