import type { AnchorDeclaration } from "../../anchors/model.js";
import { resolveAnchor, type AnchorResolution } from "../../anchors/resolve.js";
import type { AnchorPolicy } from "../../config/schema.js";
import { error, warning, type Diagnostic } from "../../parser/diagnostics.js";
import type { Requirement } from "../../parser/requirement.js";
import type { ActiveChange } from "../active-change.js";
import { resultFrom, type VerifyLayer } from "./types.js";

export interface AnchorPolicyContext {
  policy: AnchorPolicy;
  activeChange?: ActiveChange;
}

// REQ-ANC-006 — Graduated policy.
//
// `graduated` is the interesting case: an anchor that dangles because the
// requirement is being implemented right now is a warning, while an anchor that
// dangles outside any declared work is a real regression and an error. Without
// the active change there is no "right now", so everything is an error.
export function applyAnchorPolicy(
  resolution: AnchorResolution,
  requirement: Requirement,
  declaration: AnchorDeclaration,
  ctx: AnchorPolicyContext,
): Diagnostic | undefined {
  if (resolution.outcome === "resolved") return undefined;

  const finding = {
    file: requirement.file,
    line: declaration.line,
    requirementId: requirement.id,
    message: describe(resolution, requirement),
  };

  if (ctx.policy === "lenient") return warning(finding);
  if (ctx.policy === "strict") return error(finding);

  const inFlight = ctx.activeChange?.inFlight.has(requirement.id) ?? false;
  return inFlight ? warning(finding) : error(finding);
}

export const anchorsLayer: VerifyLayer = {
  name: "anchors",
  run(ctx) {
    const violations: Diagnostic[] = [];
    const policyContext: AnchorPolicyContext = {
      policy: ctx.config.verify.anchors.policy,
      ...(ctx.activeChange === undefined
        ? {}
        : { activeChange: ctx.activeChange }),
    };

    for (const capability of ctx.specs.capabilities) {
      for (const requirement of capability.requirements) {
        for (const declaration of requirement.anchors) {
          const resolution = resolveAnchor(declaration.anchor, {
            root: ctx.root,
            defaultStrategy: ctx.config.anchors.default,
          });
          const finding = applyAnchorPolicy(
            resolution,
            requirement,
            declaration,
            policyContext,
          );
          if (finding) violations.push(finding);
        }
      }
    }

    return Promise.resolve(resultFrom(violations));
  },
};

function describe(
  resolution: AnchorResolution,
  requirement: Requirement,
): string {
  const { anchor } = resolution;
  const target =
    anchor.symbol === undefined
      ? `"${anchor.file}"`
      : `"${anchor.symbol}" in "${anchor.file}"`;
  const head = `Anchor of ${requirement.id} no longer resolves: ${target} (ladder step ${resolution.step}).`;

  if (
    resolution.outcome === "dangling-with-suggestion" &&
    resolution.suggestion
  ) {
    // REQ-CLI-003: the suggestion is reported, never applied.
    return (
      `${head} The symbol was found at ${resolution.suggestion.file}:${resolution.suggestion.line}. ` +
      `Update the anchor or move the code back; specd does not rewrite it for you.`
    );
  }
  if (resolution.step === 1) {
    return `${head} The declared file does not exist.`;
  }
  return `${head} The symbol was not found anywhere in the repository, or matched in more than one place.`;
}
