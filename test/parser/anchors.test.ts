import { describe, expect, it } from "vitest";
import { parseAnchorBlock } from "../../src/parser/anchors.js";

const ctx = { file: "spec.md", startLine: 10, requirementId: "REQ-FMT-008" };

function parse(source: string): ReturnType<typeof parseAnchorBlock> {
  return parseAnchorBlock(source, ctx);
}

// REQ-FMT-008 — Anchors live on requirements
describe("anchor block", () => {
  it("requires file and accepts an optional symbol", () => {
    const { anchors, diagnostics } = parse(
      `- file: src/a.ts\n  symbol: "export function a"\n- file: src/b.ts\n`,
    );
    expect(diagnostics).toEqual([]);
    expect(anchors.map((a) => a.anchor)).toEqual([
      { file: "src/a.ts", symbol: "export function a" },
      { file: "src/b.ts" },
    ]);
  });

  it("reports the line of each entry relative to the file", () => {
    const { anchors } = parse(`- file: src/a.ts\n- file: src/b.ts\n`);
    expect(anchors.map((a) => a.line)).toEqual([10, 11]);
  });

  it("rejects an entry without file", () => {
    const { anchors, diagnostics } = parse(`- symbol: "export function a"\n`);
    expect(anchors).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe("error");
    expect(diagnostics[0]?.message).toContain('missing the required "file"');
    expect(diagnostics[0]?.requirementId).toBe("REQ-FMT-008");
  });

  it("rejects a mistyped key instead of silently dropping the symbol", () => {
    const { anchors, diagnostics } = parse(
      `- file: src/a.ts\n  symbols: "export function a"\n`,
    );
    expect(anchors).toEqual([]);
    expect(diagnostics[0]?.message).toContain('Unknown key "symbols"');
    expect(diagnostics[0]?.message).toContain("file, symbol");
  });

  it("rejects an empty value", () => {
    const { diagnostics } = parse(`- file: ""\n`);
    expect(diagnostics[0]?.message).toContain("non-empty string");
  });

  it("rejects a block that is not a list", () => {
    const { anchors, diagnostics } = parse(`file: src/a.ts\n`);
    expect(anchors).toEqual([]);
    expect(diagnostics[0]?.message).toContain("must be a YAML list");
  });

  it("rejects an empty block", () => {
    const { diagnostics } = parse(`\n`);
    expect(diagnostics[0]?.message).toContain("empty");
  });

  it("reports malformed YAML with the offending line", () => {
    const { anchors, diagnostics } = parse(
      `- file: src/a.ts\n  symbol: "unterminated\n`,
    );
    expect(anchors).toEqual([]);
    expect(diagnostics).not.toHaveLength(0);
    expect(diagnostics[0]?.severity).toBe("error");
    expect(diagnostics[0]?.message).toContain("Malformed anchor block");
  });

  it("keeps every entry independent when one is broken", () => {
    const { anchors, diagnostics } = parse(
      `- file: src/a.ts\n- symbol: "orphan"\n- file: src/c.ts\n`,
    );
    expect(anchors.map((a) => a.anchor.file)).toEqual(["src/a.ts", "src/c.ts"]);
    expect(diagnostics).toHaveLength(1);
  });
});
