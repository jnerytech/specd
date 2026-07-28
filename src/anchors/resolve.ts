import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AnchorStrategy } from "../config/schema.js";
import type { Anchor } from "./model.js";
import { findSymbolInRepo, type SymbolMatch } from "./search.js";
import { strategyFor } from "./strategy.js";

export type AnchorOutcome =
  "resolved" | "dangling" | "dangling-with-suggestion";

export interface AnchorResolution {
  anchor: Anchor;
  outcome: AnchorOutcome;
  // Ladder step the resolution stopped at, 1 through 5 (REQ-ANC-002).
  step: LadderStep;
  // Present only for `dangling-with-suggestion`.
  suggestion?: SymbolMatch;
  // Strategy consulted, absent when the ladder stopped before choosing one.
  strategy?: AnchorStrategy;
}

export const LADDER_STEPS = {
  FILE_MISSING: 1,
  FILE_ONLY: 2,
  GREP: 3,
  TREESITTER: 4,
  REPO_SEARCH: 5,
} as const;

export type LadderStep = (typeof LADDER_STEPS)[keyof typeof LADDER_STEPS];

export interface ResolveContext {
  // Repository root; every anchor path is resolved from here (REQ-ANC-001).
  root: string;
  // `anchors.default` from the resolved configuration (REQ-ANC-004).
  defaultStrategy: AnchorStrategy;
}

// REQ-ANC-002: five ordered steps, first match wins. The same input always
// produces the same output — nothing here consults the clock, the network or a
// model.
//
// Step 4 (treesitter) is part of the ladder but unreachable in version 1:
// `strategyFor` raises a configuration error before it, by REQ-ANC-005.
export function resolveAnchor(
  anchor: Anchor,
  ctx: ResolveContext,
): AnchorResolution {
  const absolute = join(ctx.root, anchor.file);

  // Step 1 — the declared file is gone.
  if (!isFile(absolute)) {
    return {
      anchor,
      outcome: "dangling",
      step: LADDER_STEPS.FILE_MISSING,
    };
  }

  // Step 2 — a file-only anchor is satisfied by the file existing.
  if (anchor.symbol === undefined) {
    return { anchor, outcome: "resolved", step: LADDER_STEPS.FILE_ONLY };
  }

  // Steps 3 and 4 — ask the strategy that the file's extension selects.
  const strategy = strategyFor(anchor.file, ctx.defaultStrategy);
  const content = readTextFile(absolute);
  if (content !== undefined && strategy.matches(content, anchor.symbol)) {
    return {
      anchor,
      outcome: "resolved",
      step: LADDER_STEPS.GREP,
      strategy: strategy.name,
    };
  }

  // Step 5 — the symbol may have moved. Exactly one match elsewhere is a
  // suggestion; zero or several leave the anchor dangling without one, because
  // specd never guesses between candidates (REQ-ANC-003, REQ-CLI-003).
  const matches = findSymbolInRepo(anchor.symbol, {
    root: ctx.root,
    exclude: [anchor.file],
  });
  if (matches.length === 1) {
    return {
      anchor,
      outcome: "dangling-with-suggestion",
      step: LADDER_STEPS.REPO_SEARCH,
      suggestion: matches[0] as SymbolMatch,
      strategy: strategy.name,
    };
  }
  return {
    anchor,
    outcome: "dangling",
    step: LADDER_STEPS.REPO_SEARCH,
    strategy: strategy.name,
  };
}

export function isResolved(resolution: AnchorResolution): boolean {
  return resolution.outcome === "resolved";
}

function isFile(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readTextFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}
