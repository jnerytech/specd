import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { REQ_ID_PATTERN } from "../parser/requirement-id.js";

export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export interface TaskRecord {
  id: string;
  // Repository-relative path of the task file.
  file: string;
  status: TaskStatus;
  // Requirement identifiers the task implements.
  req: string[];
  commits: string[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const STATUSES = new Set<TaskStatus>([
  "pending",
  "in_progress",
  "done",
  "blocked",
]);

// Reads the task files of a change.
//
// Deliberately not `src/parser/task.ts` (REQ-FMT-007), which validates the task
// frontmatter and is not part of Fatia 1. Putting a partial implementation at
// that requirement's anchor would make it resolve and report work as finished
// that has not been done. This reader tolerates what it does not understand;
// the validating parser will be the one that rejects it.
export function readTasks(changeDir: string): TaskRecord[] {
  const tasksDir = join(changeDir, "tasks");
  if (!existsSync(tasksDir)) return [];

  const tasks: TaskRecord[] = [];
  for (const name of readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const path = join(tasksDir, name);
    const front = frontmatterOf(readFileSync(path, "utf8"));
    if (front === undefined) continue;

    const status = front["status"];
    const evidence = front["evidence"] as { commits?: unknown } | undefined;
    tasks.push({
      id:
        typeof front["id"] === "string"
          ? front["id"]
          : name.replace(/\.md$/, ""),
      file: join("tasks", name),
      status:
        typeof status === "string" && STATUSES.has(status as TaskStatus)
          ? (status as TaskStatus)
          : "pending",
      req: stringList(front["req"]).filter((id) => REQ_ID_PATTERN.test(id)),
      commits: stringList(evidence?.commits),
    });
  }
  return tasks;
}

function frontmatterOf(source: string): Record<string, unknown> | undefined {
  const match = FRONTMATTER.exec(source);
  if (!match) return undefined;
  try {
    const parsed: unknown = parseYaml(match[1] as string);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
