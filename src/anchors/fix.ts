import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig } from "../config/schema.js";
import { OperationalError } from "../core/operational.js";
import { effectiveSpecs } from "../verify/effective.js";
import { resolveAnchor } from "./resolve.js";

export interface FixOptions {
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
}

export interface FixedAnchor {
  requirementId: string;
  file: string;
  line: number;
  from: string;
  to: string;
}

export interface FixResult {
  fixed: FixedAnchor[];
}

// REQ-ANC-008 — Fix rewrites with review.
//
// Rewrites the anchor to the location the resolver suggested, and stops there:
// the file is modified on disk and left unstaged, so a person reads the diff
// before it becomes history. P4 — specd proposes, the repository accepts.
//
// Exit 2 and not 1 when there is no suggestion. "I have nothing to apply" is a
// refusal to act, not a verdict on quality, and exit 1 belongs to
// `specd verify` alone (REQ-CLI-001, P2).
export async function fixAnchor(
  requirementId: string | undefined,
  options: FixOptions = {},
): Promise<FixResult> {
  const root = options.cwd ?? process.cwd();
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  if (requirementId === undefined || requirementId.length === 0) {
    throw new OperationalError(
      "`specd anchor fix` needs a requirement identifier — it rewrites one requirement's anchors, never a whole tree.",
    );
  }

  const effective = effectiveSpecs(root, { pathsRelativeTo: root });
  const entry = effective.requirements.find(
    (candidate) => candidate.requirement.id === requirementId,
  );
  if (entry === undefined) {
    throw new OperationalError(
      `No requirement ${requirementId} in .specd/specs/ or in any open change delta.`,
    );
  }

  const fixed: FixedAnchor[] = [];
  const withoutSuggestion: string[] = [];

  for (const declaration of entry.requirement.anchors) {
    const resolution = resolveAnchor(declaration.anchor, {
      root,
      defaultStrategy: config.anchors.default,
    });
    if (resolution.outcome === "resolved") continue;
    if (
      resolution.outcome !== "dangling-with-suggestion" ||
      resolution.suggestion === undefined
    ) {
      const target =
        declaration.anchor.symbol === undefined
          ? declaration.anchor.file
          : `${declaration.anchor.symbol} in ${declaration.anchor.file}`;
      withoutSuggestion.push(target);
      continue;
    }
    fixed.push({
      requirementId,
      file: entry.requirement.file,
      line: declaration.line,
      from: declaration.anchor.file,
      to: resolution.suggestion.file,
    });
  }

  if (fixed.length === 0) {
    throw new OperationalError(
      withoutSuggestion.length === 0
        ? `Every anchor of ${requirementId} already resolves; there is nothing to fix.`
        : `No anchor of ${requirementId} carries a suggestion, so there is nothing to apply:\n` +
            withoutSuggestion.map((target) => `  - ${target}`).join("\n") +
            `\nThe resolver found the symbol in no place or in several. Point the anchor by hand — ` +
            `specd does not choose between candidates (REQ-CLI-003).`,
    );
  }

  applyRewrites(join(root, entry.requirement.file), fixed);
  return { fixed };
}

// Rewrites the `file:` line of each anchor in place.
//
// Line-level and not a YAML round trip on purpose: re-emitting the block would
// reformat comments and key order the author chose, and a spec file is read by
// people more often than by the parser.
function applyRewrites(path: string, fixed: readonly FixedAnchor[]): void {
  const lines = readFileSync(path, "utf8").split("\n");
  for (const anchor of fixed) {
    for (let i = anchor.line - 1; i < lines.length; i++) {
      const line = lines[i] as string;
      const match = /^(\s*-?\s*file:\s*)(\S.*?)(\s*)$/.exec(line);
      if (!match) continue;
      if ((match[2] as string).replace(/^["']|["']$/g, "") !== anchor.from) {
        continue;
      }
      lines[i] = `${match[1] as string}${anchor.to}`;
      break;
    }
  }
  writeFileSync(path, lines.join("\n"), "utf8");
}
