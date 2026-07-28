import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { resolveAnchor } from "../anchors/resolve.js";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig } from "../config/schema.js";
import type { Task } from "../parser/task.js";
import type { OpenChange } from "../verify/changes.js";
import { effectiveSpecs } from "../verify/effective.js";
import { summarizeOpenChanges, type OpenChangeSummary } from "./changes.js";
import { locateAll, type RequirementLocation } from "./locate.js";

export interface DanglingAnchor {
  requirementId: string;
  capability: string;
  file: string;
  symbol?: string;
  suggestion?: string;
  // Where the requirement is written. Only a `specs` one is drift.
  origin: "specs" | "delta";
}

export interface OversizedMemory {
  file: string;
  lines: number;
  limit: number;
}

export interface ChangeStatus {
  change: string;
  // Requirements the change declares that no task references (REQ-VER-004's
  // subject, reported here without failing anything).
  requirementsWithoutTasks: string[];
  // Tasks marked done whose `evidence.commits` is empty (REQ-VER-005's).
  doneTasksWithoutEvidence: string[];
  danglingAnchors: DanglingAnchor[];
  oversizedMemory: OversizedMemory[];
  tasks: { total: number; done: number };
  summary: OpenChangeSummary;
}

export interface StatusReport {
  changes: ChangeStatus[];
  // Dangling anchors of requirements no open change claims. These are drift:
  // nothing is being built that would resolve them.
  unclaimedDanglingAnchors: DanglingAnchor[];
  locations: RequirementLocation[];
  totals: {
    capabilities: number;
    requirements: number;
    danglingAnchors: number;
  };
}

export interface StatusOptions {
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
}

// REQ-CFG-006 — Status reports drift and pending work.
//
// It informs; it does not judge. The caller always exits 0 — a command that
// summarises the state must be safe to run in any hook or prompt, and only
// `verify` is allowed to fail a build (REQ-CLI-001).
export async function status(
  options: StatusOptions = {},
): Promise<StatusReport> {
  const root = options.cwd ?? process.cwd();
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  const effective = effectiveSpecs(root, { pathsRelativeTo: root });

  const dangling: DanglingAnchor[] = [];
  for (const entry of effective.requirements) {
    for (const declaration of entry.requirement.anchors) {
      const resolution = resolveAnchor(declaration.anchor, {
        root,
        defaultStrategy: config.anchors.default,
      });
      if (resolution.outcome === "resolved") continue;
      dangling.push({
        requirementId: entry.requirement.id,
        capability: entry.capability,
        file: declaration.anchor.file,
        origin: entry.origin,
        ...(declaration.anchor.symbol === undefined
          ? {}
          : { symbol: declaration.anchor.symbol }),
        ...(resolution.suggestion === undefined
          ? {}
          : {
              suggestion: `${resolution.suggestion.file}:${resolution.suggestion.line}`,
            }),
      });
    }
  }

  const danglingIds = new Set(dangling.map((anchor) => anchor.requirementId));
  const summaries = summarizeOpenChanges(effective, danglingIds, root);
  const changes = effective.changes.map((change, index) =>
    statusOf(
      change,
      dangling,
      summaries[index] as OpenChangeSummary,
      config,
      root,
    ),
  );

  const claimed = new Set(
    effective.changes.flatMap((change) => [...change.inFlight]),
  );

  return {
    changes,
    unclaimedDanglingAnchors: dangling.filter(
      (anchor) => !claimed.has(anchor.requirementId),
    ),
    locations: locateAll(effective),
    totals: {
      capabilities: effective.capabilities.length,
      requirements: effective.requirements.length,
      danglingAnchors: dangling.length,
    },
  };
}

function statusOf(
  change: OpenChange,
  dangling: readonly DanglingAnchor[],
  summary: OpenChangeSummary,
  config: SpecdConfig,
  root: string,
): ChangeStatus {
  const covered = new Set(change.tasks.flatMap((task) => task.req));

  return {
    change: change.name,
    requirementsWithoutTasks: [...change.inFlight]
      .filter((id) => !covered.has(id))
      .sort(),
    doneTasksWithoutEvidence: change.tasks
      .filter(
        (task) => task.status === "done" && task.evidence.commits.length === 0,
      )
      .map((task) => task.id),
    danglingAnchors: dangling.filter((anchor) =>
      change.inFlight.has(anchor.requirementId),
    ),
    oversizedMemory: oversizedMemory(change, config, root),
    tasks: { total: change.tasks.length, done: doneCount(change.tasks) },
    summary,
  };
}

function doneCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status === "done").length;
}

// `change.md` carries the change-level notes; every other memory file belongs
// to a task. The limits are advisory: specd reports, it never truncates.
function oversizedMemory(
  change: OpenChange,
  config: SpecdConfig,
  root: string,
): OversizedMemory[] {
  const memoryDir = join(change.directory, "memory");
  if (!config.memory.enabled || !existsSync(memoryDir)) return [];

  const oversized: OversizedMemory[] = [];
  for (const name of readdirSync(memoryDir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const path = join(memoryDir, name);
    const limit =
      name === "change.md"
        ? config.memory.change_limit_lines
        : config.memory.task_limit_lines;
    const lines = readFileSync(path, "utf8").split("\n").length;
    if (lines > limit) {
      oversized.push({
        file: relative(root, path).split(sep).join("/"),
        lines,
        limit,
      });
    }
  }
  return oversized;
}

export function formatStatus(report: StatusReport): string {
  const lines = [
    `${report.totals.capabilities} capabilities, ${report.totals.requirements} requirements, ` +
      `${report.totals.danglingAnchors} dangling anchor${report.totals.danglingAnchors === 1 ? "" : "s"}`,
    "",
  ];

  if (report.changes.length === 0) {
    lines.push("No open changes under .specd/changes/.");
  }

  for (const change of report.changes) {
    const age =
      change.summary.ageInDays === undefined
        ? "age unknown"
        : `open ${change.summary.ageInDays} day${change.summary.ageInDays === 1 ? "" : "s"}`;
    lines.push(
      `${change.change} — ${change.tasks.done}/${change.tasks.total} tasks done, ${age}, ` +
        `${change.summary.warningDebt} of ${change.summary.requirements} requirements still dangling`,
    );
    section(
      lines,
      "dangling anchors (in flight)",
      change.danglingAnchors.map(describe),
    );
    section(
      lines,
      "requirements without a task",
      change.requirementsWithoutTasks,
    );
    section(
      lines,
      "tasks done without evidence",
      change.doneTasksWithoutEvidence,
    );
    section(
      lines,
      "memory files over their limit",
      change.oversizedMemory.map(
        (m) => `${m.file} (${m.lines} lines, limit ${m.limit})`,
      ),
    );
    lines.push("");
  }

  // The distinction this report exists to make: an anchor dangling under an
  // open change is pending work; one dangling with nobody building it is drift.
  if (report.unclaimedDanglingAnchors.length > 0) {
    lines.push("drift — dangling with no open change claiming it");
    section(
      lines,
      "dangling anchors",
      report.unclaimedDanglingAnchors.map(describe),
    );
  }

  return lines.join("\n").trimEnd();
}

function section(lines: string[], title: string, items: string[]): void {
  if (items.length === 0) return;
  lines.push(`  ${title}:`);
  for (const item of items) lines.push(`    ${item}`);
}

function describe(anchor: DanglingAnchor): string {
  const target =
    anchor.symbol === undefined
      ? anchor.file
      : `${anchor.file} :: ${anchor.symbol}`;
  const hint = anchor.suggestion ? ` (found at ${anchor.suggestion})` : "";
  return `${anchor.requirementId} -> ${target}${hint}`;
}
