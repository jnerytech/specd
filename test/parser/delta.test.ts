import { describe, expect, it } from "vitest";
import { parseDelta } from "../../src/parser/delta.js";

function messages(source: string): string[] {
  return parseDelta(source, "delta.md").diagnostics.map((d) => d.message);
}

const BLOCK = (id: string, capability = "demo") =>
  `### ${id} — Example\n\n**Capability.** ${capability}\n\n` +
  `**Statement.** The specd verifier SHALL do the thing.\n\n` +
  `**Acceptance.**\n- it works\n`;

const HEAD = "---\nchange: 2026-07-demo\n---\n\n";

// REQ-FMT-005 — Delta declares three sections
describe("delta sections", () => {
  it("reads ADDED, MODIFIED and REMOVED", () => {
    const { delta } = parseDelta(
      `${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001")}\n## MODIFIED\n\n${BLOCK("REQ-DEMO-002")}\n## REMOVED\n\n- REQ-DEMO-003\n`,
      "delta.md",
    );
    expect(delta?.added.map((e) => e.requirement.id)).toEqual(["REQ-DEMO-001"]);
    expect(delta?.modified.map((e) => e.requirement.id)).toEqual([
      "REQ-DEMO-002",
    ]);
    expect(delta?.removed).toEqual(["REQ-DEMO-003"]);
  });

  it("rejects a section outside the three", () => {
    // The section `corrections-fatia-1` deleted, rejected by the parser this
    // time instead of by a person reading the file.
    expect(messages(`${HEAD}## DEFERRED\n\n- REQ-DEMO-001\n`)[0]).toContain(
      "is not one of ADDED, MODIFIED, REMOVED",
    );
  });

  it("accepts an empty REMOVED written as prose", () => {
    expect(messages(`${HEAD}## REMOVED\n\nNenhum.\n`)).toEqual([]);
  });

  it("rejects a body under REMOVED", () => {
    const found = messages(`${HEAD}## REMOVED\n\n- not-an-identifier\n`).join(
      " ",
    );
    expect(found).toContain("accepts only requirement identifiers");
  });

  it("rejects the same identifier in two sections", () => {
    const found = messages(
      `${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001")}\n## REMOVED\n\n- REQ-DEMO-001\n`,
    );
    expect(found.join(" ")).toContain("one operation per identifier");
  });
});

// REQ-FMT-005: ADDED declares its destination; MODIFIED need not.
describe("capability field", () => {
  it("carries the destination of an ADDED requirement", () => {
    const { delta } = parseDelta(
      `${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001", "spec-format")}`,
      "delta.md",
    );
    expect(delta?.added[0]?.capability).toBe("spec-format");
  });

  it("rejects an ADDED requirement without one", () => {
    const block = BLOCK("REQ-DEMO-001").replace("**Capability.** demo\n\n", "");
    expect(messages(`${HEAD}## ADDED\n\n${block}`).join(" ")).toContain(
      'without a "**Capability.**" field',
    );
  });

  it("accepts a MODIFIED requirement without one", () => {
    const block = BLOCK("REQ-DEMO-001").replace("**Capability.** demo\n\n", "");
    expect(messages(`${HEAD}## MODIFIED\n\n${block}`)).toEqual([]);
  });

  it("strips the field from the text archive will write", () => {
    const { delta } = parseDelta(
      `${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001")}`,
      "delta.md",
    );
    expect(delta?.added[0]?.text).not.toContain("**Capability.**");
    expect(delta?.added[0]?.text).toContain("**Statement.**");
  });
});

// REQ-FMT-006 — ADDED and MODIFIED carry full text
describe("full text", () => {
  it("rejects a block with no statement", () => {
    const block =
      "### REQ-DEMO-001 — Example\n\n**Capability.** demo\n\n**Acceptance.**\n- it works\n";
    expect(messages(`${HEAD}## ADDED\n\n${block}`).join(" ")).toContain(
      'has no "**Statement.**"',
    );
  });

  it("rejects a block with no acceptance", () => {
    const block =
      "### REQ-DEMO-001 — Example\n\n**Capability.** demo\n\n" +
      "**Statement.** The specd verifier SHALL do the thing.\n";
    expect(messages(`${HEAD}## ADDED\n\n${block}`).join(" ")).toContain(
      "carries the complete requirement, not a patch",
    );
  });

  it("accepts a block with no anchors, because anchors are optional", () => {
    expect(messages(`${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001")}`)).toEqual([]);
  });
});

// REQ-FMT-009 — Unreadable delta content is rejected, never ignored
describe("unreadable sections", () => {
  it("rejects a section with content but no requirement block", () => {
    // The exact shape of `2026-07-fatia-1`'s delta: a manifest of identifiers.
    // The parser read it as zero requirements, and `archive` exited 0 having
    // verified nothing.
    const found = messages(
      `${HEAD}## ADDED\n\n### cli\n- REQ-CLI-001 — Single gate\n- REQ-CLI-002 — No LLM\n`,
    ).join(" ");
    expect(found).toContain("has content but no requirement block");
    expect(found).toContain("the old manifest form");
  });

  it("rejects a bare identifier listed beside real blocks", () => {
    const found = messages(
      `${HEAD}## ADDED\n\n- REQ-DEMO-009 — Forgotten\n\n${BLOCK("REQ-DEMO-001")}`,
    ).join(" ");
    expect(found).toContain("REQ-DEMO-009 is listed as a bare item");
  });

  it("accepts a section with no content at all", () => {
    expect(
      messages(`${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001")}\n## REMOVED\n`),
    ).toEqual([]);
  });

  it("accepts an explicit empty marker in any section", () => {
    expect(
      messages(`${HEAD}## ADDED\n\nNenhum.\n\n## MODIFIED\n\nNone.\n`),
    ).toEqual([]);
  });

  it("accepts prose before the first block", () => {
    expect(
      messages(
        `${HEAD}## ADDED\n\nToda a fatia é greenfield.\n\n${BLOCK("REQ-DEMO-001")}`,
      ),
    ).toEqual([]);
  });

  it("ignores content inside a fenced block", () => {
    // An anchor block names files, not requirements; its lines must not be
    // read as section content.
    expect(messages(`${HEAD}## ADDED\n\n${BLOCK("REQ-DEMO-001")}`)).toEqual([]);
  });
});
