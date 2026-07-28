import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { resolveAnchor } from "../anchors/resolve.js";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig } from "../config/schema.js";
import { loadCapabilities } from "../parser/capability.js";
import { listChanges, type ActiveChange } from "../verify/active-change.js";
import { readTasks, type TaskRecord } from "./tasks.js";

export interface DanglingAnchor {
  requirementId: string;
  capability: string;
  file: string;
  symbol?: string;
  suggestion?: string;
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
}

export interface StatusReport {
  changes: ChangeStatus[];
  // Dangling anchors of requirements no active change claims.
  unclaimedDanglingAnchors: DanglingAnchor[];
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

  const specsDir = join(root, ".specd", "specs");
  const { capabilities } = existsSync(specsDir)
    ? loadCapabilities(specsDir, { pathsRelativeTo: root })
    : { capabilities: [] };

  const dangling: DanglingAnchor[] = [];
  let requirements = 0;
  for (const capability of capabilities) {
    for (const requirement of capability.requirements) {
      requirements++;
      for (const declaration of requirement.anchors) {
        const resolution = resolveAnchor(declaration.anchor, {
          root,
          defaultStrategy: config.anchors.default,
        });
        if (resolution.outcome === "resolved") continue;
        dangling.push({
          requirementId: requirement.id,
          capability: capability.name,
          file: declaration.anchor.file,
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
  }

  const changes = listChanges(root).map((change) =>
    statusOf(change, dangling, config, root),
  );
  const claimed = new Set(
    changes.flatMap((change) =>
      change.danglingAnchors.map((anchor) => anchor.requirementId),
    ),
  );

  return {
    changes,
    unclaimedDanglingAnchors: dangling.filter(
      (anchor) => !claimed.has(anchor.requirementId),
    ),
    totals: {
      capabilities: capabilities.length,
      requirements,
      danglingAnchors: dangling.length,
    },
  };
}

function statusOf(
  change: ActiveChange,
  dangling: readonly DanglingAnchor[],
  config: SpecdConfig,
  root: string,
): ChangeStatus {
  const tasks = readTasks(change.directory);
  const covered = new Set(tasks.flatMap((task) => task.req));

  return {
    change: change.name,
    requirementsWithoutTasks: [...change.inFlight]
      .filter((id) => !covered.has(id))
      .sort(),
    doneTasksWithoutEvidence: tasks
      .filter((task) => task.status === "done" && task.commits.length === 0)
      .map((task) => task.id),
    danglingAnchors: dangling.filter((anchor) =>
      change.inFlight.has(anchor.requirementId),
    ),
    oversizedMemory: oversizedMemory(change, config, root),
    tasks: { total: tasks.length, done: doneCount(tasks) },
  };
}

function doneCount(tasks: readonly TaskRecord[]): number {
  return tasks.filter((task) => task.status === "done").length;
}

// `change.md` carries the change-level notes; every other memory file belongs
// to a task. The limits are advisory: specd reports, it never truncates.
function oversizedMemory(
  change: ActiveChange,
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
    lines.push("No change directories under .specd/changes/.");
  }

  for (const change of report.changes) {
    lines.push(
      `${change.change} — ${change.tasks.done}/${change.tasks.total} tasks done`,
    );
    section(lines, "dangling anchors", change.danglingAnchors.map(describe));
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

  if (report.unclaimedDanglingAnchors.length > 0) {
    lines.push("outside any change");
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
