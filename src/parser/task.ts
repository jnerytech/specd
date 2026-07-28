import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { error, type Diagnostic } from "./diagnostics.js";
import { readFrontmatter } from "./frontmatter.js";
import {
  REQ_ID_PATTERN_DESCRIPTION,
  isValidRequirementId,
} from "./requirement-id.js";

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "blocked",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  change: string;
  // Requirement identifiers this task implements.
  req: string[];
  status: TaskStatus;
  evidence: { commits: string[] };
  // Repository-relative path of the task file.
  file: string;
}

export interface ParsedTask {
  task?: Task;
  diagnostics: Diagnostic[];
}

// REQ-FMT-007 — Task frontmatter schema.
//
// Declared as data rather than as a chain of `if`s so that the error message
// can name every field the reader expected, which is what makes a rejected
// task fixable without opening the source.
export const TaskFrontmatterSchema = {
  required: ["id", "change", "req", "status", "evidence"] as const,
  statuses: TASK_STATUSES,
} as const;

export function parseTask(source: string, file: string): ParsedTask {
  const diagnostics: Diagnostic[] = [];

  const front = readFrontmatter(source, file, "task", diagnostics);
  if (front === undefined) return { diagnostics };

  const missing = TaskFrontmatterSchema.required.filter(
    (field) => front.fields[field] === undefined,
  );
  if (missing.length > 0) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          `Task frontmatter is missing ${missing.map((f) => `"${f}"`).join(", ")}. ` +
          `A task declares ${TaskFrontmatterSchema.required.join(", ")}.`,
      }),
    );
    return { diagnostics };
  }

  const id = front.fields["id"];
  const change = front.fields["change"];
  if (typeof id !== "string" || typeof change !== "string") {
    // Not coerced on purpose. `id: 001` is a YAML integer, and turning it into
    // a string would yield "1" — an identifier that silently stops matching the
    // file it names. Quoting is the author's decision to make, not ours.
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          '"id" and "change" must be strings. A numeric-looking identifier needs quotes — write `id: "001"`, ' +
          "since YAML reads 001 as the number 1 and the leading zeros would be lost.",
      }),
    );
    return { diagnostics };
  }

  const status = front.fields["status"];
  if (
    typeof status !== "string" ||
    !TASK_STATUSES.includes(status as TaskStatus)
  ) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: `"status" is ${JSON.stringify(status)}; it belongs to ${TASK_STATUSES.join(" | ")}.`,
      }),
    );
    return { diagnostics };
  }

  const req = readRequirementList(front.fields["req"], file, diagnostics);
  const commits = readCommits(front.fields["evidence"], file, diagnostics);
  if (req === undefined || commits === undefined) return { diagnostics };

  return {
    task: {
      id,
      change,
      req,
      status: status as TaskStatus,
      evidence: { commits },
      file,
    },
    diagnostics,
  };
}

export interface LoadedTasks {
  tasks: Task[];
  diagnostics: Diagnostic[];
}

// Reads `tasks/*.md` of a change directory, in stable name order.
//
// The layout is `tasks/NNN-name.md` rather than a single `tasks.md`: a change
// carries one file per task so that `evidence.commits` of one task is not
// rewritten when another advances.
export function loadTasks(
  changeDir: string,
  displayPrefix?: string,
): LoadedTasks {
  const tasksDir = join(changeDir, "tasks");
  if (!existsSync(tasksDir)) return { tasks: [], diagnostics: [] };

  const tasks: Task[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const name of readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const display =
      displayPrefix === undefined
        ? join(tasksDir, name)
        : `${displayPrefix}/tasks/${name}`;
    const parsed = parseTask(
      readFileSync(join(tasksDir, name), "utf8"),
      display,
    );
    diagnostics.push(...parsed.diagnostics);
    if (parsed.task) tasks.push(parsed.task);
  }
  return { tasks, diagnostics };
}

function readRequirementList(
  raw: unknown,
  file: string,
  diagnostics: Diagnostic[],
): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          '"req" must be a non-empty list of requirement identifiers; a task with no requirement is work the spec does not ask for.',
      }),
    );
    return undefined;
  }
  const ids: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !isValidRequirementId(entry)) {
      diagnostics.push(
        error({
          file,
          line: 1,
          message: `"req" contains ${JSON.stringify(entry)}, which is not a requirement identifier. Expected ${REQ_ID_PATTERN_DESCRIPTION}.`,
        }),
      );
      return undefined;
    }
    ids.push(entry);
  }
  return ids;
}

function readCommits(
  raw: unknown,
  file: string,
  diagnostics: Diagnostic[],
): string[] | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: '"evidence" must be a mapping declaring "commits".',
      }),
    );
    return undefined;
  }
  const commits = (raw as Record<string, unknown>)["commits"];
  if (!Array.isArray(commits)) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          '"evidence.commits" must be a list, possibly empty. An empty list is a legal declaration of "no evidence yet"; a missing one is a malformed task.',
      }),
    );
    return undefined;
  }
  const shas: string[] = [];
  for (const entry of commits) {
    if (typeof entry !== "string") {
      diagnostics.push(
        error({
          file,
          line: 1,
          message: `"evidence.commits" contains ${JSON.stringify(entry)}, which is not a commit identifier.`,
        }),
      );
      return undefined;
    }
    shas.push(entry);
  }
  return shas;
}
