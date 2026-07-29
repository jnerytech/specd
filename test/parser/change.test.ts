import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadChangeFrontmatter,
  parseChangeFrontmatter,
} from "../../src/parser/change.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

function changeDirectory(proposal?: string): string {
  const root = mkdtempSync(join(tmpdir(), "specd-change-"));
  roots.push(root);
  const directory = join(root, "2026-07-demo");
  mkdirSync(directory, { recursive: true });
  if (proposal !== undefined) {
    writeFileSync(join(directory, "proposal.md"), proposal);
  }
  return directory;
}

const MINIMAL = "---\nchange: 2026-07-demo\nstatus: active\n---\n\n# Demo\n";

// REQ-FMT-011 — the structural half: what a change declares, and what a
// half-written declaration costs.
describe("change frontmatter — REQ-FMT-011", () => {
  it("reads change and status", () => {
    const parsed = parseChangeFrontmatter(MINIMAL, "proposal.md");

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.frontmatter?.change).toBe("2026-07-demo");
    expect(parsed.frontmatter?.status).toBe("active");
    expect(parsed.frontmatter?.card).toBeUndefined();
  });

  it("reads a card declaring ref and url", () => {
    const parsed = parseChangeFrontmatter(
      "---\nchange: 2026-07-demo\nstatus: active\n" +
        'card:\n  ref: "4821"\n  url: "https://board.example/issues/4821"\n---\n',
      "proposal.md",
    );

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.frontmatter?.card).toEqual({
      ref: "4821",
      url: "https://board.example/issues/4821",
    });
  });

  it("rejects a card with a ref and no url", () => {
    const parsed = parseChangeFrontmatter(
      '---\nchange: 2026-07-demo\nstatus: active\ncard:\n  ref: "4821"\n---\n',
      "proposal.md",
    );

    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.diagnostics[0]?.message).toContain('"url"');
  });

  it("rejects a card with a url and no ref", () => {
    const parsed = parseChangeFrontmatter(
      "---\nchange: 2026-07-demo\nstatus: active\n" +
        'card:\n  url: "https://board.example/issues/4821"\n---\n',
      "proposal.md",
    );

    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.diagnostics[0]?.message).toContain('"ref"');
  });

  it("rejects a proposal without change", () => {
    const parsed = parseChangeFrontmatter("---\nstatus: active\n---\n", "p.md");

    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.diagnostics[0]?.message).toContain('"change"');
  });

  it("rejects a change directory with no proposal", () => {
    const parsed = loadChangeFrontmatter(changeDirectory(), "changes/demo");

    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.diagnostics[0]?.message).toContain("proposal.md");
  });

  it("reads the proposal of a change directory", () => {
    const parsed = loadChangeFrontmatter(
      changeDirectory(MINIMAL),
      "changes/demo",
    );

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.frontmatter?.change).toBe("2026-07-demo");
  });
});
