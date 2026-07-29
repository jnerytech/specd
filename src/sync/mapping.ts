import type { SpecLevel, SpecdConfig } from "../config/schema.js";
import { SPEC_LEVELS } from "../config/schema.js";
import { SyncError } from "./errors.js";

// One node of the spec tree, in the shape the mapping cares about. The tree is
// built in `index.ts`; nothing here knows what a requirement is.
export interface SpecNode {
  // Stable key the link block is filed under: a requirement identifier, or a
  // capability name. The two can never collide — requirement identifiers match
  // `REQ-…` and capability names do not.
  key: string;
  level: SpecLevel;
  title: string;
  body: string;
  capability: string;
  children: SpecNode[];
}

export interface PlannedItem {
  key: string;
  level: SpecLevel;
  // Board item type the level maps to.
  type: string;
  title: string;
  body: string;
  // Key of the nearest mapped ancestor, absent at the top.
  parentKey?: string;
  capability: string;
}

export type LevelMapping = SpecdConfig["board"]["mapping"];

// REQ-SYNC-006 — Spec level maps to item type, with an explicit collapse rule.
//
// Collapse is the difference between a readable board and three hundred
// one-line cards. That it is configurable is P5 met for real rather than by
// assertion: two actual clients diverge because one plans by capability and the
// other by requirement.
//
// A level that is neither mapped nor collapsed is an error, not a default. The
// silent alternatives are both wrong — dropping the level loses work, and
// inventing a type writes something nobody asked for. Absence of a rule is not
// a rule (P8).
export function planBoardItems(
  roots: readonly SpecNode[],
  mapping: LevelMapping,
): PlannedItem[] {
  assertEveryLevelDecided(roots, mapping);

  const planned: PlannedItem[] = [];
  for (const root of roots) {
    visit(root, undefined, mapping, planned);
  }
  return planned;
}

function visit(
  node: SpecNode,
  parentKey: string | undefined,
  mapping: LevelMapping,
  planned: PlannedItem[],
): void {
  const type = typeFor(node.level, mapping);

  // Collapsed: the node contributes its content to the nearest mapped ancestor
  // and its children keep looking upward for the same ancestor.
  if (type === undefined) {
    for (const child of node.children)
      visit(child, parentKey, mapping, planned);
    return;
  }

  const collapsed = collectCollapsed(node, mapping);
  planned.push({
    key: node.key,
    level: node.level,
    type,
    title: node.title,
    body: collapsed.length === 0 ? node.body : foldInto(node.body, collapsed),
    ...(parentKey === undefined ? {} : { parentKey }),
    capability: node.capability,
  });

  for (const child of node.children) visit(child, node.key, mapping, planned);
}

// Every collapsed descendant reachable without crossing another mapped item.
function collectCollapsed(node: SpecNode, mapping: LevelMapping): SpecNode[] {
  const found: SpecNode[] = [];
  const walk = (current: SpecNode): void => {
    for (const child of current.children) {
      if (typeFor(child.level, mapping) !== undefined) continue;
      found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
}

function foldInto(body: string, collapsed: readonly SpecNode[]): string {
  const lines = collapsed.map((node) => `- ${node.key} — ${node.title}`);
  return `${body.trimEnd()}\n\n${lines.join("\n")}\n`;
}

function typeFor(level: SpecLevel, mapping: LevelMapping): string | undefined {
  if ((mapping.collapse ?? []).includes(level)) return undefined;
  return mapping[level];
}

// REQ-SYNC-006: refuse before writing anything, and name every undecided level
// at once rather than one per run.
export function assertEveryLevelDecided(
  roots: readonly SpecNode[],
  mapping: LevelMapping,
): void {
  const present = new Set<SpecLevel>();
  const walk = (node: SpecNode): void => {
    present.add(node.level);
    for (const child of node.children) walk(child);
  };
  for (const root of roots) walk(root);

  const undecided = [...present].filter(
    (level) =>
      mapping[level] === undefined && !(mapping.collapse ?? []).includes(level),
  );
  if (undecided.length === 0) return;

  throw new SyncError(
    `No board mapping for spec level${undecided.length === 1 ? "" : "s"} ` +
      `${undecided.map((level) => `"${level}"`).join(", ")}, and ${undecided.length === 1 ? "it is" : "they are"} not listed under collapse.\n` +
      `Set [board.mapping] ${undecided.map((level) => `${level} = "<item type>"`).join(", ")}, ` +
      `or add ${undecided.map((level) => `"${level}"`).join(", ")} to [board.mapping] collapse.\n` +
      `Levels specd knows: ${SPEC_LEVELS.join(", ")}. ` +
      `An undecided level is not a default — dropping it loses work and inventing a type writes what nobody asked for.`,
  );
}
