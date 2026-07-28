import { describe, expect, it } from "vitest";
import { TaskFrontmatterSchema, parseTask } from "../../src/parser/task.js";

function front(fields: string): string {
  return `---\n${fields}\n---\n\n## Objetivo\n\nDo the thing.\n`;
}

const VALID = front(
  'id: "001-demo"\nchange: 2026-07-demo\nreq: [REQ-DEMO-001]\nstatus: done\nevidence:\n  commits: [abc1234]',
);

// REQ-FMT-007 — Task frontmatter schema
describe("task frontmatter", () => {
  it("declares the five required fields", () => {
    expect([...TaskFrontmatterSchema.required]).toEqual([
      "id",
      "change",
      "req",
      "status",
      "evidence",
    ]);
  });

  it("reads a complete task", () => {
    const { task, diagnostics } = parseTask(VALID, "001.md");
    expect(diagnostics).toEqual([]);
    expect(task).toMatchObject({
      id: "001-demo",
      change: "2026-07-demo",
      req: ["REQ-DEMO-001"],
      status: "done",
      evidence: { commits: ["abc1234"] },
    });
  });

  it("names every missing field at once", () => {
    const { diagnostics } = parseTask(front("id: x"), "001.md");
    expect(diagnostics[0]?.message).toContain(
      '"change", "req", "status", "evidence"',
    );
  });

  it("rejects a req list that is empty", () => {
    const source = VALID.replace("req: [REQ-DEMO-001]", "req: []");
    expect(parseTask(source, "001.md").diagnostics[0]?.message).toContain(
      "non-empty list",
    );
  });

  it("rejects an identifier outside the pattern", () => {
    const source = VALID.replace("REQ-DEMO-001", "REQ-demo-1");
    expect(parseTask(source, "001.md").diagnostics[0]?.message).toContain(
      "not a requirement identifier",
    );
  });

  it("rejects a status outside the four", () => {
    const source = VALID.replace("status: done", "status: finished");
    expect(parseTask(source, "001.md").diagnostics[0]?.message).toContain(
      "pending | in_progress | done | blocked",
    );
  });

  it("accepts an empty commits list", () => {
    const source = VALID.replace("commits: [abc1234]", "commits: []");
    const { task, diagnostics } = parseTask(source, "001.md");
    expect(diagnostics).toEqual([]);
    expect(task?.evidence.commits).toEqual([]);
  });

  it("rejects evidence with no commits key", () => {
    const source = VALID.replace(
      "evidence:\n  commits: [abc1234]",
      "evidence:\n  notes: none",
    );
    expect(parseTask(source, "001.md").diagnostics[0]?.message).toContain(
      "must be a list, possibly empty",
    );
  });

  // A numeric-looking id is the one YAML trap that would corrupt data silently
  // rather than loudly: `001` parses as 1, and the task would stop matching the
  // file it names.
  it("rejects an unquoted numeric identifier and says how to fix it", () => {
    const source = VALID.replace('id: "001-demo"', "id: 001");
    expect(parseTask(source, "001.md").diagnostics[0]?.message).toContain(
      'write `id: "001"`',
    );
  });
});
