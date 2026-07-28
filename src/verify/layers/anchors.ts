import type { AnchorDeclaration } from "../../anchors/model.js";
import { resolveAnchor, type AnchorResolution } from "../../anchors/resolve.js";
import type { AnchorPolicy } from "../../config/schema.js";
import { error, warning, type Diagnostic } from "../../parser/diagnostics.js";
import type { Requirement } from "../../parser/requirement.js";
import type { RequirementOrigin } from "../effective.js";
import { resultFrom, type VerifyLayer } from "./types.js";

export interface AnchorPolicyContext {
  policy: AnchorPolicy;
  origin: RequirementOrigin;
  // Name of the change the requirement is in flight in, when origin is delta.
  change?: string;
}

// REQ-ANC-006 — Graduated policy.
//
// Severity comes from where the requirement is written, not from a lookup.
// `.specd/specs/` holds realized truth, so an anchor that stopped resolving
// there is drift: something moved and the spec no longer says where. A change
// delta holds work in flight, so the same anchor is pending work.
//
// This used to ask whether the identifier appeared in "the active change"
// delta, which meant picking one change out of several — guessing, by P4 — and
// silently downgraded real drift for every identifier a stale delta listed.
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
    message: describe(resolution, requirement, ctx),
  };

  if (ctx.policy === "lenient") return warning(finding);
  if (ctx.policy === "strict") return error(finding);
  return ctx.origin === "delta" ? warning(finding) : error(finding);
}

export const anchorsLayer: VerifyLayer = {
  name: "anchors",
  run(ctx) {
    const violations: Diagnostic[] = [];

    for (const entry of ctx.effective.requirements) {
      for (const declaration of entry.requirement.anchors) {
        const resolution = resolveAnchor(declaration.anchor, {
          root: ctx.root,
          defaultStrategy: ctx.config.anchors.default,
        });
        const finding = applyAnchorPolicy(
          resolution,
          entry.requirement,
          declaration,
          {
            policy: ctx.config.verify.anchors.policy,
            origin: entry.origin,
            ...(entry.change === undefined ? {} : { change: entry.change }),
          },
        );
        if (finding) violations.push(finding);
      }
    }

    return Promise.resolve(resultFrom(violations));
  },
};

function describe(
  resolution: AnchorResolution,
  requirement: Requirement,
  ctx: AnchorPolicyContext,
): string {
  const { anchor } = resolution;
  const target =
    anchor.symbol === undefined
      ? `"${anchor.file}"`
      : `"${anchor.symbol}" in "${anchor.file}"`;
  const head = `Anchor of ${requirement.id} does not resolve: ${target} (ladder step ${resolution.step}).`;
  const where =
    ctx.origin === "delta"
      ? ` In flight in ${ctx.change ?? "an open change"}, so this is pending work rather than drift.`
      : "";

  if (
    resolution.outcome === "dangling-with-suggestion" &&
    resolution.suggestion
  ) {
    // REQ-CLI-003: the suggestion is reported, never applied.
    return (
      `${head} The symbol was found at ${resolution.suggestion.file}:${resolution.suggestion.line}. ` +
      `Run \`specd anchor fix\` to rewrite it, or move the code back; specd does not decide for you.${where}`
    );
  }
  if (resolution.step === 1) {
    return `${head} The declared file does not exist.${where}`;
  }
  return `${head} The symbol was not found anywhere in the repository, or matched in more than one place.${where}`;
}
