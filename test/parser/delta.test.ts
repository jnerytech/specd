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
    const found = messages(`${HEAD}## REMOVED\n\n- not-an-identifier\n`);
    expect(found[0]).toContain("is not a requirement identifier");
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
