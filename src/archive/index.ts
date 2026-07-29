import { requireProjectRoot } from "../core/root.js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
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
import type { Delta } from "../parser/delta.js";
import type { BoardAdapter } from "../sync/adapter.js";
import { createAdapter } from "../sync/adapters/index.js";
import { readBoardLinks, type BoardLink } from "../sync/link.js";
import { sync, type SyncReport } from "../sync/index.js";
import { planApplication, type ApplicationPlan } from "./apply.js";

// REQ-ARC-011 — Archive syncs only when asked.
//
// REQ-SYNC-001 says the board is written only when a person invokes it
// directly. `archive` reconciling on its own would break that; `archive --sync`
// does not, because it is still somebody typing, and the external write stays
// declared (costly-ops-are-not-silent).
//
// There is no `--no-sync`. With `sync` opt-in the absence of the flag already
// is the no, and two flags for one boolean is a button without two real clients
// diverging (config-only-on-divergence).
export interface ArchiveOptions {
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
  // Reconcile the board after the capabilities have been written.
  sync?: boolean;
}

// REQ-ARC-012 — A failed sync never undoes the archive.
//
// The order is capabilities first, board second, and it is chosen rather than
// incidental: the spec ahead of the board is recoverable by one idempotent
// command, while the board ahead of the spec leaves cards for requirements the
// repository does not recognise.
//
// Undoing the archive would be worse than either. What it wrote is correct and
// sits outside the git index, within reach of review — undoing destroys good
// work because of a network failure, which is exactly the silent decision costly-ops-are-not-silent
// forbids.
export class ArchiveSyncError extends Error {
  readonly exitCode = 2;
  readonly result: ArchiveResult;

  constructor(result: ArchiveResult, cause: unknown) {
    super(
      `Archived ${result.change} to ${result.destination}, and the board was not updated.\n` +
        `${cause instanceof Error ? cause.message : String(cause)}\n\n` +
        `The spec moved ahead of the board. Nothing was undone: the capabilities are ` +
        `written and unstaged, and the change directory is archived.\n` +
        `Run \`specd sync\` to catch the board up — it is idempotent, so the archive ` +
        `is not repeated.`,
    );
    this.name = "ArchiveSyncError";
    this.result = result;
  }
}

export interface ArchiveResult {
  change: string;
  // Repository-relative destination.
  destination: string;
  // Capability files written, in write order.
  written: string[];
  // Requirements whose text was already present verbatim.
  alreadyApplied: string[];
  // REQ-ARC-011: set when `--sync` ran the reconciliation.
  synced?: SyncReport;
  // REQ-ARC-013: what stayed out of sync, when a board is configured and
  // `--sync` was not given. Absent when no board is configured.
  unsynced?: UnsyncedCount;
  // REQ-ARC-014: set when `--sync` ran. `status` is absent when no
  // `archived_status` is configured, and the empty list then means "nothing was
  // attempted" rather than "nothing needed moving".
  transitioned?: { status?: string; items: string[] };
}

export interface UnsyncedCount {
  total: number;
  // Archived identifiers the board has never seen.
  missing: string[];
  // Archived identifiers whose text this change rewrote, and whose card still
  // holds the old text.
  stale: string[];
}

// REQ-ARC-013 — Archive without the flag reports what stayed out of sync.
//
// Computed from the applied delta and the recorded links, without a single
// request. `archive` without `--sync` is a local operation, and a local
// operation that needs the network is one more place the tool stops working for
// a reason that is not its own — on a plane, in CI without egress, behind a
// client's proxy. Whoever does not need the network does not ask for it; gate-no-network is
// the strong instance of that rule, not the whole of it.
//
// The price is declared: this sees a link that is absent and a requirement this
// change rewrote. It does not see a card deleted on the board. Less precise on
// purpose.
export function countUnsyncedItems(
  delta: Delta,
  linkedKeys: ReadonlySet<string>,
): UnsyncedCount {
  const missing: string[] = [];
  const stale: string[] = [];

  const capabilities = new Set<string>();
  for (const entry of [...delta.added, ...delta.modified]) {
    if (entry.capability !== undefined) capabilities.add(entry.capability);
    const id = entry.requirement.id;
    if (!linkedKeys.has(id)) missing.push(id);
    else if (entry.section === "MODIFIED") stale.push(id);
  }
  for (const capability of capabilities) {
    if (!linkedKeys.has(capability)) missing.push(capability);
  }

  return { total: missing.length + stale.length, missing, stale };
}

// Every link recorded under `board:` across the capability files on disk.
export function recordedLinks(root: string): Map<string, BoardLink> {
  const specsDir = join(root, ".specd", "specs");
  const links = new Map<string, BoardLink>();
  if (!existsSync(specsDir)) return links;
  for (const name of readdirSync(specsDir).filter((f) => f.endsWith(".md"))) {
    const file = join(specsDir, name);
    for (const [key, link] of Object.entries(
      readBoardLinks(readFileSync(file, "utf8"), file),
    )) {
      links.set(key, link);
    }
  }
  return links;
}

// Every key recorded under `board:` across the capability files on disk.
export function recordedLinkKeys(root: string): Set<string> {
  return new Set(recordedLinks(root).keys());
}

// The link keys a change owns: its requirements, and the capabilities they are
// written into. The same set REQ-ARC-013 counts, because it is the same
// question asked at two moments.
export function changeLinkKeys(delta: Delta): string[] {
  const keys: string[] = [];
  const capabilities = new Set<string>();
  for (const entry of [...delta.added, ...delta.modified]) {
    keys.push(entry.requirement.id);
    if (entry.capability !== undefined) capabilities.add(entry.capability);
  }
  return [...keys, ...capabilities];
}

// REQ-ARC-014 — Archive hands the item over, it does not bury it.
//
// Scoped to the archived change on purpose. `sync` reconciles the whole
// effective spec, and that is right for content: two diverging sides are a
// conflict wherever they are. A transition is a different claim — it says that
// work finished — and only the change being archived finished.
export async function transitionArchivedItems(
  delta: Delta,
  root: string,
  adapter: BoardAdapter,
  status: string,
  notes: string,
): Promise<string[]> {
  const links = recordedLinks(root);
  const moved: string[] = [];
  for (const key of changeLinkKeys(delta)) {
    const link = links.get(key);
    if (link === undefined) continue;
    await adapter.transition({ id: link.ref, url: link.url }, status, notes);
    moved.push(key);
  }
  return moved;
}

// REQ-ARC-001 — Change is named explicitly.
//
// No inference from date, ordering or the number of open changes. With
// concurrent open changes, picking one is guessing, and no-guessing-on-conflict forbids it: the
// operation rewrites the contract, so the caller says which contract.
export async function archive(
  name: string | undefined,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  // REQ-CFG-010: the project is the directory holding `.specd/`, not the
  // working directory and not the git toplevel.
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  // REQ-ARC-011: `--sync` without a board is checked here, before anything is
  // applied. Failing on a misconfiguration that was knowable up front would
  // spend REQ-ARC-012's case — "the spec moved and the board did not" — on
  // something that never had to happen.
  if (options.sync === true && config.board.provider === undefined) {
    throw new OperationalError(
      "`specd archive --sync` needs a board, and [board] provider is not set. " +
        "Configure the board, or archive without --sync.",
    );
  }

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
  // whole directory. Ephemeral by memory-is-ephemeral means non-authoritative, not destroyed.
  renameSync(change.directory, destinationDir);

  const result: ArchiveResult = {
    change: change.name,
    destination: relativeTo(root, destinationDir),
    written,
    alreadyApplied: plan.alreadyApplied,
  };

  const boardConfigured = config.board.provider !== undefined;

  // REQ-ARC-011: opt-in, and only after the capabilities are on disk.
  if (options.sync === true) {
    try {
      result.synced = await sync({ cwd: root, config });

      // REQ-ARC-014: after the content is reconciled, so the transition lands
      // on items whose text the board already agrees with.
      const status = config.board.mapping.archived_status;
      result.transitioned =
        status === undefined
          ? { items: [] }
          : {
              status,
              items: await transitionArchivedItems(
                change.delta,
                root,
                createAdapter(config),
                status,
                `Archived by specd: change ${change.name}.`,
              ),
            };
    } catch (cause) {
      // REQ-ARC-012: nothing is undone. The archive is correct and unstaged.
      throw new ArchiveSyncError(result, cause);
    }
    return result;
  }

  // REQ-ARC-013: no board, nothing to report; a board, always a number, zero
  // included.
  if (boardConfigured) {
    result.unsynced = countUnsyncedItems(change.delta, recordedLinkKeys(root));
  }
  return result;
}

// REQ-ARC-014 — what the transition did, in one line.
//
// Absent status and empty list are different sentences on purpose: "nothing was
// attempted" and "nothing needed moving" are different facts, and one text for
// both is the collapse absence-is-not-compliance names.
export function formatTransition(
  transitioned: ArchiveResult["transitioned"],
): string {
  if (transitioned?.status === undefined) {
    return "No [board.mapping] archived_status is configured, so no item was moved.";
  }
  if (transitioned.items.length === 0) {
    return `No archived item is linked to the board, so none moved to "${transitioned.status}".`;
  }
  return (
    `Moved ${transitioned.items.length} item${transitioned.items.length === 1 ? "" : "s"} ` +
    `to "${transitioned.status}": ${transitioned.items.join(", ")}.`
  );
}

// REQ-ARC-006 — Archive destination preserves the change name.
//
// No date prefix: specd change names already carry one, and prefixing would
// produce `2026-07-28-2026-07-28-verify-gate-and-anchor-ladder`.
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
