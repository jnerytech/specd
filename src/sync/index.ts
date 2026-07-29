import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig } from "../config/schema.js";
import { requireProjectRoot } from "../core/root.js";
import type { Requirement } from "../parser/requirement.js";
import type { Task } from "../parser/task.js";
import type { Capability } from "../parser/capability.js";
import { readOpenChanges, type OpenChange } from "../verify/changes.js";
import { effectiveSpecs } from "../verify/effective.js";
import type {
  BoardAdapter,
  BoardItemContent,
  BoardItemRef,
  BoardItemSnapshot,
} from "./adapter.js";
import { createAdapter } from "./adapters/index.js";
import {
  SyncError,
  UndeclaredOrphanError,
  type OrphanReport,
} from "./errors.js";
import { loadFieldBindings, valuesFor, type FieldBinding } from "./fields.js";
import { normalizeProjection, projectContent, syncedHash } from "./hash.js";
import {
  mergeThreeWay,
  type FieldConflict,
  type MergeOutcome,
} from "./merge.js";
import { readBoardLinks, writeBoardLinks, type BoardLink } from "./link.js";
import { planBoardItems, type PlannedItem, type SpecNode } from "./mapping.js";

export interface SyncOptions {
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
  // Plan and report without writing to the board or to the spec.
  dryRun?: boolean;
  // Fixed instant for `synced_at`; defaults to now.
  now?: Date;
  // Pre-built adapter, for tests that supply a double.
  adapter?: BoardAdapter;
}

export interface SyncItemState {
  item: PlannedItem;
  // The spec-owned content as the spec has it now.
  content: BoardItemContent;
  // Absent means never synced — which is not the same as synced and unchanged.
  link?: BoardLink;
  // Absent means the item is not on the board, either never created or deleted.
  snapshot?: BoardItemSnapshot;
}

// REQ-SYNC-003: `closed` is not a merge outcome. It is what happens to a board
// item whose requirement left the spec — the archived case, and the single
// sanctioned status write.
//
// REQ-SYNC-016: `retiring` is not a write at all. It is the report of an item
// deliberately left alone, and it exists because staying silent about it would
// be P8 by the definition — checked, found something, said nothing.
export type SyncOutcome = MergeOutcome | "closed" | "retiring";

export interface SyncAction {
  key: string;
  capability: string;
  level: string;
  type: string;
  outcome: SyncOutcome;
  oursHash: string;
  theirsHash?: string;
  conflicts: FieldConflict[];
  ref?: BoardItemRef;
}

export interface SyncReport {
  provider: string;
  project?: string;
  dryRun: boolean;
  actions: SyncAction[];
  counts: Record<SyncOutcome, number>;
}

// What the spec says about the death of the requirement behind an orphaned
// link, and the three answers are genuinely three.
//
// `declared` — REQ-SYNC-014: the identifier is listed as `retired` in the
// capability frontmatter. `archive` writes it there for every identifier under
// REMOVED, so this is a death that already happened.
//
// `proposed` — REQ-SYNC-016: the identifier is under REMOVED of a change that
// is still open. The death is planned and has not happened; the board item is
// left alone until `archive` turns the proposal into a fact.
//
// `none` — nothing in the spec says the requirement died, and the link is an
// accident until somebody says otherwise.
export type DeathSignal = "declared" | "proposed" | "none";

export interface OrphanedLink {
  capability: string;
  key: string;
  link: BoardLink;
  death: DeathSignal;
}

// REQ-SYNC-014 — a link whose item is no longer in the spec, and whether its
// death was declared.
//
// The earlier version of this function returned every orphan and the caller
// closed all of them. That was P9 violated by the product itself: a mistyped
// identifier closed a client's card, and the card carried a comment, an
// attachment and somebody's logged hours that the spec has no idea exist.
//
// The signal was already in the model and went unread. `retired` says "this
// requirement is gone", `archive` populates it from every REMOVED identifier,
// and comparing linked keys against planned keys and calling every difference a
// death was the tool ignoring its own model.
//
// REQ-SYNC-016 reads the second map. `buildSpecTree` already loaded the open
// changes to build the task level and threw away `delta.removed` — the same
// shape as the defect above, one signal later: a fact was on disk and nobody
// asked for it.
export function findOrphanedLinks(
  planned: readonly PlannedItem[],
  links: Map<string, Record<string, BoardLink>>,
  retiredByCapability: ReadonlyMap<string, readonly string[]>,
  retiringByCapability: ReadonlyMap<string, readonly string[]> = new Map(),
): OrphanedLink[] {
  const live = new Set(planned.map((item) => item.key));
  const orphans: OrphanedLink[] = [];
  for (const [capability, entries] of links) {
    const retired = retiredByCapability.get(capability) ?? [];
    const retiring = retiringByCapability.get(capability) ?? [];
    for (const [key, link] of Object.entries(entries)) {
      if (live.has(key)) continue;
      // Declared outranks proposed, and the tie it breaks is one `buildSpecTree`
      // cannot produce: `collectRetiring` only names identifiers that are still
      // live requirement headings, and the parser refuses a heading whose
      // identifier is already in `retired`, so the two lists are disjoint by
      // construction. The order is here for a caller that builds the maps by
      // hand, and declared is the safer default — an archive that happened is a
      // fact, an open change is not. `spec-tree.test.ts` pins the invariant so
      // it is checked rather than assumed.
      const death: DeathSignal = retired.includes(key)
        ? "declared"
        : retiring.includes(key)
          ? "proposed"
          : "none";
      orphans.push({ capability, key, link, death });
    }
  }
  return orphans;
}

// REQ-SYNC-015: the body is the part of an item that survives a rename, so it
// is what the candidate search compares. Normalized first, for the same reason
// the hash is — a round trip through the board is not a content change.
export function bodyKey(body: string): string {
  return syncedHash(normalizeProjection({ body }));
}

// REQ-SYNC-012 — Running twice changes nothing.
//
// Pure on purpose: state in, actions out, nothing written. That is what makes
// the decision testable without a board, and what lets `sync` see every
// conflict before it performs the first write (REQ-SYNC-005).
export function planActions(
  states: readonly SyncItemState[],
  boundIds: readonly number[],
): SyncAction[] {
  return states.map((state) => {
    const ours = projectContent(state.content);
    // Only bound fields take part. A custom field the configuration never named
    // belongs to whoever set it, and comparing it would make every item differ
    // forever.
    const theirs =
      state.snapshot === undefined
        ? undefined
        : projectContent(restrictFields(state.snapshot.content, boundIds));

    const merge = mergeThreeWay({
      item: state.item.key,
      ...(state.link === undefined ? {} : { base: state.link.synced_hash }),
      ours,
      ...(theirs === undefined ? {} : { theirs }),
    });

    const ref = state.snapshot?.ref;
    return {
      key: state.item.key,
      capability: state.item.capability,
      level: state.item.level,
      type: state.item.type,
      outcome: merge.outcome,
      oursHash: merge.oursHash,
      ...(merge.theirsHash === undefined
        ? {}
        : { theirsHash: merge.theirsHash }),
      conflicts: merge.conflicts,
      ...(ref === undefined ? {} : { ref }),
    };
  });
}

// REQ-SYNC-001 — Sync is manual and never runs from a hook.
//
// A hook runs with nobody watching. Writing into somebody else's system with
// nobody watching is how another person's afternoon gets erased and discovered
// a week later. The gate is mandatory because it reads; this is manual because
// it writes.
//
// Nothing here is reachable from `src/hooks/run.ts` — there is an architecture
// test for it, in the same family as the ones guarding P1 and P3.
export async function sync(options: SyncOptions = {}): Promise<SyncReport> {
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  const adapter = options.adapter ?? createAdapter(config);
  const bindings = await loadFieldBindings(adapter, config.board.fields);
  const boundIds = bindings.map((binding) => binding.id);

  const tree = buildSpecTree(root);
  const planned = planBoardItems(tree.roots, config.board.mapping);

  // Every capability on disk, not only the ones with planned items: a
  // capability whose requirements were all removed still holds the links whose
  // cards have to be dealt with.
  const links = readLinksByCapability(root, [
    ...new Set([
      ...tree.retired.keys(),
      ...tree.retiring.keys(),
      ...planned.map((i) => i.capability),
    ]),
  ]);
  const states = await readStates(planned, links, bindings, adapter);
  const orphans = findOrphanedLinks(
    planned,
    links,
    tree.retired,
    tree.retiring,
  );
  const classified = await classifyOrphans(orphans, states, adapter);

  // REQ-SYNC-015: raised before the conflict check and before any write, so an
  // orphan specd was not told to close never costs a card while the rest of the
  // run reports success around it.
  assertNoUnsanctionedOrphans(classified);

  const actions = [
    ...planActions(states, boundIds),
    // REQ-SYNC-014: only deaths that are declared *and* unambiguous become
    // `closed`. REQ-SYNC-016: a proposed death becomes `retiring`, which is
    // reported and never written.
    ...classified
      .filter((entry) => entry.disposition !== "refuse")
      .map(({ orphan, disposition }): SyncAction => ({
        key: orphan.key,
        capability: orphan.capability,
        level: "",
        type: "",
        outcome: disposition === "close" ? "closed" : "retiring",
        oursHash: "",
        conflicts: [],
        ref: { id: orphan.link.ref, url: orphan.link.url },
      })),
  ];

  // REQ-SYNC-005: every conflict is raised before the first write, and nothing
  // is written — not even the items that would have been fine. A half-applied
  // sync leaves the board in a state neither side describes, and nobody can
  // tell which half landed.
  assertNoConflicts(actions);

  const report: SyncReport = {
    provider: adapter.provider,
    ...(config.board.project === undefined
      ? {}
      : { project: config.board.project }),
    dryRun: options.dryRun ?? false,
    actions,
    counts: countOutcomes(actions),
  };
  if (options.dryRun) return report;

  await applyActions({
    root,
    adapter,
    bindings,
    planned,
    states,
    actions,
    links,
    now: options.now ?? new Date(),
  });

  return report;
}

// What `sync` may do with an orphaned link.
export type OrphanDisposition = "close" | "refuse" | "leave";

export interface ClassifiedOrphan {
  orphan: OrphanedLink;
  // Planned items with no link yet whose body matches the board item's.
  candidates: string[];
  disposition: OrphanDisposition;
}

// REQ-SYNC-014 / REQ-SYNC-015 — the two conditions for closing, decided in one
// place, and the evidence handed over rather than a verdict.
//
// Every orphan costs one board read, the declared ones included. That is not
// negotiable and it is not the network being asked for out of convenience: the
// requirement that died has left the spec, so the only surviving copy of its
// body is the card. Without reading it there is no way to tell a death from a
// rename, which is the whole question.
//
// A card that cannot be read has no body to reappear. `read` returns undefined
// only for a 404 — every other failure throws — so this is a verified absence,
// not an unverified one, and the disposition falls back to the declaration
// exactly as before.
export async function classifyOrphans(
  orphans: readonly OrphanedLink[],
  states: readonly SyncItemState[],
  adapter: BoardAdapter,
): Promise<ClassifiedOrphan[]> {
  if (orphans.length === 0) return [];

  // Only items that are not linked to anything yet can be the other end of a
  // rename; one that already has its own card is a different item.
  const unlinked = states.filter((state) => state.link === undefined);

  const classified: ClassifiedOrphan[] = [];
  for (const orphan of orphans) {
    const snapshot = await adapter.read({
      id: orphan.link.ref,
      url: orphan.link.url,
    });
    const remoteBody =
      snapshot === undefined ? undefined : bodyKey(snapshot.content.body);
    // Exact equality of the normalized body, and it has to stay exact. A looser
    // comparison — fuzzy, prefix, similarity above some threshold — would turn
    // this from evidence into a judgement, and the branch it feeds decides
    // whether somebody's card closes. P1: where the write cannot be undone, the
    // tool detects and refuses; it does not estimate.
    const candidates =
      remoteBody === undefined
        ? []
        : unlinked
            .filter((state) => bodyKey(state.content.body) === remoteBody)
            .map((state) => state.item.key);
    classified.push({
      orphan,
      candidates,
      disposition: dispose(orphan, candidates),
    });
  }
  return classified;
}

// The four branches, in the order that makes them disjoint. The order is the
// design, not an implementation detail:
//
//   corpo reaparece      -> refuse   a body under two identifiers is the most
//                                    ambiguous pair in the model, not the least
//   morte proposta       -> leave    proposed is not declared; closing here
//                                    would lose the card of an abandoned change
//   morte declarada      -> close    the only sanctioned status write
//   nada                 -> refuse   an accident until somebody says otherwise
//
// A reappearing body outranks a declaration because the author who renames an
// already realized requirement has to write `REMOVED` plus `ADDED` — the delta
// offers no other words — so the declaration cannot distinguish the readings.
function dispose(
  orphan: OrphanedLink,
  candidates: readonly string[],
): OrphanDisposition {
  if (candidates.length > 0) return "refuse";
  if (orphan.death === "proposed") return "leave";
  return orphan.death === "declared" ? "close" : "refuse";
}

// REQ-SYNC-015 — refuse before anything is written, and name both ends.
export function assertNoUnsanctionedOrphans(
  classified: readonly ClassifiedOrphan[],
): void {
  const refused = classified.filter((entry) => entry.disposition === "refuse");
  if (refused.length === 0) return;

  const reports: OrphanReport[] = refused.map((entry) => ({
    key: entry.orphan.key,
    ref: entry.orphan.link.ref,
    url: entry.orphan.link.url,
    declared: entry.orphan.death === "declared",
    candidates: entry.candidates,
  }));
  throw new UndeclaredOrphanError(reports);
}

export function assertNoConflicts(actions: readonly SyncAction[]): void {
  const conflicted = actions.filter((action) => action.outcome === "conflict");
  if (conflicted.length === 0) return;

  const lines: string[] = [];
  for (const action of conflicted) {
    lines.push(`${action.key} (${action.type})`);
    for (const conflict of action.conflicts) {
      lines.push(
        `    ${conflict.field}: spec has ${render(conflict.ours)}, board has ${render(conflict.theirs)}`,
      );
    }
  }
  throw new SyncError(
    `Both sides changed since the last sync, and specd does not choose between them.\n` +
      lines.map((line) => `  ${line}`).join("\n") +
      `\nNothing was written, to either side. Reconcile the item and run again.`,
  );
}

interface ApplyContext {
  root: string;
  adapter: BoardAdapter;
  bindings: readonly FieldBinding[];
  planned: readonly PlannedItem[];
  states: readonly SyncItemState[];
  actions: SyncAction[];
  links: Map<string, Record<string, BoardLink>>;
  now: Date;
}

// Parents before children, because a child's parent reference is only known
// once the parent exists. The hash stored for an item is computed from the
// content actually sent, so the next run sees `unchanged` instead of a phantom
// update caused by a parent that was unknown the first time.
async function applyActions(ctx: ApplyContext): Promise<void> {
  const refs = new Map<string, BoardItemRef>();
  for (const [key, links] of ctx.links) {
    void key;
    for (const [item, link] of Object.entries(links)) {
      refs.set(item, { id: link.ref, url: link.url });
    }
  }

  const byKey = new Map(ctx.states.map((state) => [state.item.key, state]));
  const touched = new Set<string>();

  for (const action of ctx.actions) {
    // REQ-SYNC-016: the death is proposed and not declared, so the item is
    // left exactly as it is — no status write, and the link stays in the
    // frontmatter so `archive` finds it there.
    if (action.outcome === "retiring") continue;

    // REQ-SYNC-003: the requirement left the spec, so the board item stops
    // asking to be worked on. This is the single status write, and the adapter
    // reads back to confirm it landed.
    if (action.outcome === "closed") {
      const ref = action.ref as BoardItemRef;
      await ctx.adapter.close(
        ref,
        `${action.key} is no longer declared in the spec; closed by specd sync.`,
      );
      const links = ctx.links.get(action.capability) ?? {};
      delete links[action.key];
      ctx.links.set(action.capability, links);
      touched.add(action.capability);
      continue;
    }

    const state = byKey.get(action.key);
    if (state === undefined) continue;

    if (action.outcome === "unchanged" || action.outcome === "converged") {
      // REQ-SYNC-012: `synced_at` records when content was synced, not when
      // somebody ran the command. Rewriting it here would dirty the diff on
      // every run and teach people to stop reading diffs.
      if (action.outcome === "converged") {
        recordLink(ctx, action, state, refs, touched, action.oursHash);
      }
      continue;
    }

    const parentRef =
      state.item.parentKey === undefined
        ? undefined
        : refs.get(state.item.parentKey);
    const content: BoardItemContent = {
      ...state.content,
      ...(parentRef === undefined ? {} : { parent: parentRef }),
    };

    if (action.outcome === "create") {
      const ref = await ctx.adapter.create({ ...content, type: action.type });
      refs.set(action.key, ref);
      action.ref = ref;
      recordLink(
        ctx,
        action,
        state,
        refs,
        touched,
        syncedHash(projectContent(content)),
      );
      continue;
    }

    // push and restore both write the spec's version. They are separate
    // outcomes because `restore` overwrites somebody's board edit, and a
    // destructive write that reads as "updated" in the report is one nobody
    // notices (REQ-SYNC-003).
    const ref = action.ref ?? refs.get(action.key);
    if (ref === undefined) {
      throw new SyncError(
        `${action.key}: no board reference to update, and the merge did not ask for a create. This is a bug.`,
      );
    }
    await ctx.adapter.update(ref, content);
    refs.set(action.key, ref);
    action.ref = ref;
    recordLink(
      ctx,
      action,
      state,
      refs,
      touched,
      syncedHash(projectContent(content)),
    );
  }

  for (const capability of touched) {
    const file = capabilityFile(ctx.root, capability);
    const source = readFileSync(file, "utf8");
    const links = ctx.links.get(capability) ?? {};
    writeFileSync(file, writeBoardLinks(source, links, file), "utf8");
  }
}

function recordLink(
  ctx: ApplyContext,
  action: SyncAction,
  state: SyncItemState,
  refs: Map<string, BoardItemRef>,
  touched: Set<string>,
  hash: string,
): void {
  const ref = refs.get(action.key);
  if (ref === undefined) return;
  const links = ctx.links.get(state.item.capability) ?? {};
  links[action.key] = {
    ref: ref.id,
    url: ref.url,
    synced_at: ctx.now.toISOString(),
    synced_hash: hash,
  };
  ctx.links.set(state.item.capability, links);
  touched.add(state.item.capability);
}

async function readStates(
  planned: readonly PlannedItem[],
  links: Map<string, Record<string, BoardLink>>,
  bindings: readonly FieldBinding[],
  adapter: BoardAdapter,
): Promise<SyncItemState[]> {
  const states: SyncItemState[] = [];
  for (const item of planned) {
    const link = links.get(item.capability)?.[item.key];
    const parentLink =
      item.parentKey === undefined
        ? undefined
        : links.get(item.capability)?.[item.parentKey];

    const content: BoardItemContent = {
      title: item.title,
      body: item.body,
      ...(parentLink === undefined
        ? {}
        : { parent: { id: parentLink.ref, url: parentLink.url } }),
      fields: valuesFor(bindings, {
        capability: item.capability,
        requirementId: item.key,
        title: item.title,
        level: item.level,
      }),
    };

    const snapshot =
      link === undefined
        ? undefined
        : await adapter.read({ id: link.ref, url: link.url });

    states.push({
      item,
      content,
      ...(link === undefined ? {} : { link }),
      ...(snapshot === undefined ? {} : { snapshot }),
    });
  }
  return states;
}

function restrictFields(
  content: BoardItemContent,
  boundIds: readonly number[],
): BoardItemContent {
  return {
    ...content,
    fields: content.fields.filter((field) => boundIds.includes(field.id)),
  };
}

function readLinksByCapability(
  root: string,
  capabilities: readonly string[],
): Map<string, Record<string, BoardLink>> {
  const links = new Map<string, Record<string, BoardLink>>();
  for (const capability of capabilities) {
    const file = capabilityFile(root, capability);
    if (!existsSync(file)) continue;
    links.set(capability, readBoardLinks(readFileSync(file, "utf8"), file));
  }
  return links;
}

function capabilityFile(root: string, capability: string): string {
  return join(root, ".specd", "specs", `${capability}.md`);
}

// The spec tree `sync` projects onto the board.
//
// Three levels: capability, requirement, and the tasks of open changes that
// name the requirement. Tasks are here because the collapse rule has to have
// something to collapse — a mapping whose lowest level is always mapped never
// exercises the rule that keeps a board readable.
export interface SpecTree {
  roots: SpecNode[];
  // Capability name -> the identifiers its frontmatter declares retired.
  // REQ-SYNC-014 reads this to tell a declared death from an accident.
  retired: Map<string, readonly string[]>;
  // Capability name -> the identifiers open changes propose to remove.
  // REQ-SYNC-016 reads this to tell a proposed death from a declared one.
  retiring: Map<string, readonly string[]>;
}

export function buildSpecTree(root: string): SpecTree {
  // One read of the open changes, shared. Reading them twice would let the
  // overlay that decides `roots` and the list that decides `retiring` come from
  // two different observations of the same directory, and the disagreement
  // between them would be a card closed or a card refused for no visible
  // reason.
  const changes = readOpenChanges(root);
  const effective = effectiveSpecs(root, { pathsRelativeTo: root, changes });
  const tasks = changes.flatMap((change) => change.tasks);

  const retired = new Map<string, readonly string[]>(
    effective.capabilities.map((capability) => [
      capability.name,
      capability.retired,
    ]),
  );
  const retiring = collectRetiring(changes, effective.capabilities);
  const byCapability = new Map<string, SpecNode>();
  for (const entry of effective.requirements) {
    const capability = entry.capability;
    let node = byCapability.get(capability);
    if (node === undefined) {
      node = {
        key: capability,
        level: "capability",
        title: capability,
        body: "",
        capability,
        children: [],
      };
      byCapability.set(capability, node);
    }
    node.children.push(requirementNode(entry.requirement, capability, tasks));
  }
  return { roots: [...byCapability.values()], retired, retiring };
}

// REQ-SYNC-016 — which capability owns an identifier an open change proposes to
// remove.
//
// The requirement has already left the effective spec, so the answer is not
// there. It is still in the capability file on disk, which is exactly what
// `archive` will rewrite later, and that file is the only place that knows.
//
// An identifier that no capability claims is skipped rather than guessed:
// `effectiveSpecs` already reports it as "REMOVED but exists nowhere", and a
// second, quieter opinion about it here would be the tool arguing with itself.
function collectRetiring(
  changes: readonly OpenChange[],
  capabilities: readonly Capability[],
): Map<string, readonly string[]> {
  const owners = new Map<string, string>();
  for (const capability of capabilities) {
    for (const requirement of capability.requirements) {
      owners.set(requirement.id, capability.name);
    }
  }

  const retiring = new Map<string, string[]>();
  for (const change of changes) {
    for (const id of change.delta?.removed ?? []) {
      const owner = owners.get(id);
      if (owner === undefined) continue;
      const list = retiring.get(owner) ?? [];
      list.push(id);
      retiring.set(owner, list);
    }
  }
  return retiring;
}

function requirementNode(
  requirement: Requirement,
  capability: string,
  tasks: readonly Task[],
): SpecNode {
  return {
    key: requirement.id,
    level: "requirement",
    title: `${requirement.id} — ${requirement.title}`,
    body: requirementBody(requirement),
    capability,
    children: tasks
      .filter((task) => task.req.includes(requirement.id))
      .map((task) => ({
        key: `${task.change}/${task.id}`,
        level: "task" as const,
        title: task.id,
        body: "",
        capability,
        children: [],
      })),
  };
}

function requirementBody(requirement: Requirement): string {
  const lines = [requirement.statement];
  if (requirement.acceptance.length > 0) {
    lines.push("", "Acceptance:");
    for (const criterion of requirement.acceptance)
      lines.push(`- ${criterion}`);
  }
  return lines.join("\n");
}

function countOutcomes(
  actions: readonly SyncAction[],
): Record<SyncOutcome, number> {
  const counts: Record<SyncOutcome, number> = {
    create: 0,
    unchanged: 0,
    push: 0,
    restore: 0,
    converged: 0,
    conflict: 0,
    closed: 0,
    retiring: 0,
  };
  for (const action of actions) counts[action.outcome]++;
  return counts;
}

function render(value: unknown): string {
  if (value === undefined) return "(absent)";
  return JSON.stringify(value);
}

export function formatSyncReport(report: SyncReport): string {
  const lines = [
    `sync ${report.dryRun ? "(dry run) " : ""}via ${report.provider}${
      report.project === undefined ? "" : ` -> ${report.project}`
    }`,
  ];
  for (const action of report.actions) {
    lines.push(
      `  ${action.outcome.padEnd(9)} ${action.key} [${action.type}]${
        action.ref === undefined ? "" : ` ${action.ref.url}`
      }`,
    );
  }
  const summary = Object.entries(report.counts)
    .filter(([, count]) => count > 0)
    .map(([outcome, count]) => `${count} ${outcome}`)
    .join(", ");
  lines.push(summary.length > 0 ? summary : "nothing to do");
  return lines.join("\n");
}
