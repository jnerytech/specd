import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCapability } from "../../src/parser/capability.js";
import { parseDelta } from "../../src/parser/delta.js";
import { parseTask } from "../../src/parser/task.js";

const FORMAT_DOC = join(import.meta.dirname, "..", "..", "docs", "format.md");

// The examples are extracted from the published page rather than copied here.
// A copy inside the test is the defect this requirement exists to prevent, one
// indirection later: it would keep passing while the page rots.
function markdownExamples(): string[] {
  const source = readFileSync(FORMAT_DOC, "utf8");
  const blocks: string[] = [];
  // Three or four backticks, closed by the same run. An example that contains
  // an anchor block needs four; one that does not gets normalised down to three
  // by the formatter, and the extractor has to survive that rather than the
  // page having to be exempted from formatting.
  const pattern = /^(`{3,})markdown\r?\n([\s\S]*?)^\1[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    blocks.push(match[2] as string);
  }
  return blocks;
}

function errorsOf(diagnostics: { severity: string; message: string }[]) {
  return diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => d.message);
}

// REQ-FMT-010 — The documented delta and task examples parse.
//
// Run 006 spent six rounds of trial and error writing one change, every round
// taught by an error message and none by documentation. Documenting without a
// contract would trade "undocumented" for "documented and wrong", which is
// worse: the first sends you looking, the second tells you to trust it.
describe("documented examples parse", () => {
  const examples = markdownExamples();

  it("finds the three examples the page publishes", () => {
    // A zero here would make every assertion below vacuous — the same failure
    // mode P8 names.
    expect(examples).toHaveLength(3);
  });

  it("parses the capability example", () => {
    const parsed = parseCapability(
      examples[0] as string,
      "docs/format.md#capability",
    );
    expect(errorsOf(parsed.diagnostics)).toEqual([]);
    expect(parsed.capability?.name).toBe("enrollment");
    expect(parsed.capability?.requirements).toHaveLength(1);
    expect(parsed.capability?.requirements[0]?.anchors).toHaveLength(1);
  });

  it("parses the delta example", () => {
    const parsed = parseDelta(examples[1] as string, "docs/format.md#delta");
    expect(errorsOf(parsed.diagnostics)).toEqual([]);
    expect(parsed.delta?.change).toBe("add-cancellation");
    expect(parsed.delta?.added).toHaveLength(1);
    expect(parsed.delta?.added[0]?.capability).toBe("enrollment");
  });

  it("parses the task example", () => {
    const parsed = parseTask(examples[2] as string, "docs/format.md#task");
    expect(errorsOf(parsed.diagnostics)).toEqual([]);
    expect(parsed.task?.id).toBe("001-cancel");
    expect(parsed.task?.req).toEqual(["REQ-ENR-002"]);
    expect(parsed.task?.status).toBe("pending");
  });

  // The delta and the task have to agree with each other, or the page teaches a
  // change that `coverage` would reject.
  it("publishes a delta and a task that cover each other", () => {
    const delta = parseDelta(examples[1] as string, "delta").delta;
    const task = parseTask(examples[2] as string, "task").task;
    expect(task?.change).toBe(delta?.change);
    for (const added of delta?.added ?? []) {
      expect(task?.req).toContain(added.requirement.id);
    }
  });
});
