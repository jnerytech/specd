import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAnchor } from "../anchors/resolve.js";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig } from "../config/schema.js";
import { OperationalError } from "../core/operational.js";
import {
  ARCHIVE_DIRECTORY,
  readOpenChanges,
  type OpenChange,
} from "../verify/changes.js";
import { effectiveSpecs } from "../verify/effective.js";
import { coverageLayer } from "../verify/layers/coverage.js";
import { evidenceLayer } from "../verify/layers/evidence.js";
import type { VerifyLayerContext } from "../verify/layers/types.js";
import { planApplication, type ApplicationPlan } from "./apply.js";

export interface ArchiveOptions {
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
}

export interface ArchiveResult {
  change: string;
  // Repository-relative destination.
  destination: string;
  // Capability files written, in write order.
  written: string[];
  // Requirements whose text was already present verbatim.
  alreadyApplied: string[];
}

// REQ-ARC-001 — Change is named explicitly.
//
// No inference from date, ordering or the number of open changes. With
// concurrent open changes, picking one is guessing, and P4 forbids it: the
// operation rewrites the contract, so the caller says which contract.
export async function archive(
  name: string | undefined,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  const root = options.cwd ?? process.cwd();
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  const open = readOpenChanges(root);
  if (name === undefined || name.length === 0) {
    throw new OperationalError(
      `\`specd archive\` needs the name of the change to archive.\n` +
        formatOpen(open),
    );
  }
  const change = open.find((candidate) => candidate.name === name);
  if (change === undefined) {
    throw new OperationalError(
      `No open change named "${name}" under .specd/changes/.\n` +
        formatOpen(open),
    );
  }
  if (change.delta === undefined) {
    throw new OperationalError(
      `Change "${name}" has no readable delta.md, so there is nothing to apply. ` +
        `Run \`specd verify\` to see why it did not parse.`,
    );
  }

  const effective = effectiveSpecs(root, {
    pathsRelativeTo: root,
    changes: open,
  });
  await assertArchivable(change, { root, config, fast: true, effective });

  const specsDir = join(root, ".specd", "specs");
  const plan: ApplicationPlan = planApplication(
    change.delta,
    effective.capabilities,
    specsDir,
  );

  const destinationDir = archiveDestination(root, change.name);
  if (existsSync(destinationDir)) {
    throw new OperationalError(
      `${relativeTo(root, destinationDir)} already exists. ` +
        `Archiving would overwrite a change that was already archived; specd will not choose between them.`,
    );
  }

  // REQ-ARC-009: every write is computed and validated above; the directory
  // move happens last, so a failure here leaves the change in place and
  // REQ-ARC-010 lets a rerun finish the job.
  const written: string[] = [];
  for (const write of plan.writes) {
    writeFileSync(write.path, write.content, "utf8");
    written.push(relativeTo(root, write.path));
  }

  mkdirSync(join(root, ".specd", "changes", ARCHIVE_DIRECTORY), {
    recursive: true,
  });
  // REQ-ARC-008: `memory/` travels with the change, because the move takes the
  // whole directory. Ephemeral by P6 means non-authoritative, not destroyed.
  renameSync(change.directory, destinationDir);

  return {
    change: change.name,
    destination: relativeTo(root, destinationDir),
    written,
    alreadyApplied: plan.alreadyApplied,
  };
}

// REQ-ARC-006 — Archive destination preserves the change name.
//
// No date prefix: specd change names already carry one, and prefixing would
// produce `2026-07-28-2026-07-fatia-1`.
export function archiveDestination(root: string, name: string): string {
  return join(root, ".specd", "changes", ARCHIVE_DIRECTORY, name);
}

// REQ-ARC-002 — Preconditions gate the operation.
//
// Exit 2, not 1: `archive` refusing because the change is not ready is a
// refusal to act, and exit 1 is reserved for the verdict of `specd verify`
// (REQ-CLI-001). The message names where the verdict lives.
export async function assertArchivable(
  change: OpenChange,
  ctx: VerifyLayerContext,
): Promise<void> {
  const problems = assertAllAnchorsResolved(change, ctx);

  const scoped: VerifyLayerContext = {
    ...ctx,
    effective: { ...ctx.effective, changes: [change] },
  };
  for (const layer of [coverageLayer, evidenceLayer]) {
    const result = await layer.run(scoped);
    for (const violation of result.violations) {
      if (violation.severity !== "error") continue;
      problems.push(`${layer.name}: ${violation.message}`);
    }
  }

  if (problems.length === 0) return;
  throw new OperationalError(
    `Cannot archive ${change.name} — it is not ready:\n` +
      problems.map((problem) => `  - ${problem}`).join("\n") +
      `\nNothing was written. Run \`specd verify\` for the full verdict.`,
  );
}

// REQ-ANC-007 — Archive tolerates nothing.
//
// Every anchor of every affected requirement must resolve, whatever policy the
// project configured. `graduated` and `lenient` exist so that work in progress
// does not block the gate; archiving is the moment the work stops being in
// progress. Writing a requirement into `.specd/specs/` asserts the code
// exists, and a dangling anchor says it does not.
//
// Returns the problems instead of throwing so the caller can report every
// reason the change is not ready in one run.
export function assertAllAnchorsResolved(
  change: OpenChange,
  ctx: VerifyLayerContext,
): string[] {
  const problems: string[] = [];
  for (const id of change.inFlight) {
    const entry = ctx.effective.requirements.find(
      (candidate) => candidate.requirement.id === id,
    );
    if (entry === undefined) continue;
    for (const declaration of entry.requirement.anchors) {
      const resolution = resolveAnchor(declaration.anchor, {
        root: ctx.root,
        defaultStrategy: ctx.config.anchors.default,
      });
      if (resolution.outcome === "resolved") continue;
      const target =
        declaration.anchor.symbol === undefined
          ? declaration.anchor.file
          : `${declaration.anchor.symbol} in ${declaration.anchor.file}`;
      problems.push(`${id}: anchor does not resolve — ${target}`);
    }
  }
  return problems;
}

function formatOpen(open: readonly OpenChange[]): string {
  if (open.length === 0) return "There are no open changes.";
  return `Open changes:\n${open.map((change) => `  - ${change.name}`).join("\n")}`;
}

function relativeTo(root: string, path: string): string {
  return path.startsWith(root)
    ? path
        .slice(root.length + 1)
        .split(/[\\/]/)
        .join("/")
    : path;
}
