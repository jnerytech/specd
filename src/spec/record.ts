import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Anchor } from "../anchors/model.js";
import { resolveAnchor } from "../anchors/resolve.js";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig } from "../config/schema.js";
import { OperationalError } from "../core/operational.js";
import { requireProjectRoot } from "../core/root.js";
import { readOpenChanges } from "../verify/changes.js";
import { effectiveSpecs } from "../verify/effective.js";

export const RECORD_FILE = "propose.json";
export const RECORD_VERSION = 1;

export interface RecordedAnchor extends Anchor {
  // Whether the anchor resolved at the moment the record was written. This is
  // the field nothing else in the repository keeps: the gate report shows
  // today, and yesterday is not recoverable.
  resolved: boolean;
}

export interface RecordedRequirement {
  id: string;
  statement: string;
  acceptance: string[];
  anchors: RecordedAnchor[];
}

export interface ProposeRecord {
  version: number;
  change: string;
  requirements: RecordedRequirement[];
}

export interface ProposeRecordOptions {
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
}

// REQ-EFF-005 — The proposal record is computed, not transcribed.
//
// `resolved` comes from the resolver, never from a layer's report. No output of
// this CLI states that an anchor *resolves* — `verify --json` and `status --json`
// list the dangling ones — and deriving the rest by absence yields "everything
// resolved" whenever the `anchors` layer is switched off. That is inference from
// absence returning green, which is what absence-is-not-compliance refuses.
export function proposeRecord(
  change: string,
  options: ProposeRecordOptions = {},
): ProposeRecord {
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  const changes = readOpenChanges(root);
  const open = changes.find((candidate) => candidate.name === change);
  if (open === undefined) {
    throw new OperationalError(
      `No open change named "${change}" under .specd/changes/.\n` +
        (changes.length === 0
          ? "There are no open changes."
          : `Open: ${changes.map((c) => c.name).join(", ")}.`),
    );
  }

  // REQ-EFF-005: the window closes when the implementation starts. The rule
  // lived only in the skill's text and was broken at the first opportunity to
  // apply it — the command wrote the post-apply state without complaining, which
  // is exactly the empty cut it exists to prevent. A rule kept only in the layer
  // that forgets is a rule that will be forgotten.
  const started = open.tasks.filter((task) => task.status !== "pending");
  if (started.length > 0) {
    throw new OperationalError(
      `Change "${change}" has already started: ${started
        .map((task) => `${task.id} is ${task.status}`)
        .join(", ")}.\n` +
        `The proposal record is written before the implementation, and rewriting it now would ` +
        `record the post-apply state — which makes the archive review cut come out empty for a ` +
        `change where everything moved. Nothing was written.`,
    );
  }

  const effective = effectiveSpecs(root, { pathsRelativeTo: root, changes });

  return {
    version: RECORD_VERSION,
    change,
    // Only what this change declares: a requirement of another change, or one
    // already realized, is not what this record is about.
    requirements: effective.requirements
      .filter((entry) => entry.change === change)
      .map((entry) => ({
        id: entry.requirement.id,
        statement: entry.requirement.statement,
        acceptance: [...entry.requirement.acceptance],
        anchors: entry.requirement.anchors.map((declaration) => ({
          ...declaration.anchor,
          resolved:
            resolveAnchor(declaration.anchor, {
              root,
              defaultStrategy: config.anchors.default,
            }).outcome === "resolved",
        })),
      })),
  };
}

export function recordPath(root: string, change: string): string {
  return join(root, ".specd", "changes", change, RECORD_FILE);
}

// Writes the record where the change carries it, versioned with the work it
// describes — the same place and the same reason as the explore bundle.
export function writeProposeRecord(
  change: string,
  options: ProposeRecordOptions = {},
): { record: ProposeRecord; path: string } {
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const record = proposeRecord(change, { ...options, cwd: root });
  const path = recordPath(root, change);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { record, path };
}

export function formatProposeRecord(
  record: ProposeRecord,
  path: string,
): string {
  const lines = [
    `Recorded ${record.requirements.length === 1 ? "1 requirement" : `${record.requirements.length} requirements`} of ${record.change} in ${path}`,
  ];
  for (const requirement of record.requirements) {
    const dangling = requirement.anchors.filter((anchor) => !anchor.resolved);
    lines.push(
      `  ${requirement.id}${
        dangling.length === 0
          ? ""
          : ` — ${dangling.length} anchor${dangling.length === 1 ? "" : "s"} dangling`
      }`,
    );
  }
  return lines.join("\n");
}
