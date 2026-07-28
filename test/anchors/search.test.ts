import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findSymbolInRepo, listFiles } from "../../src/anchors/search.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

// Builds a real git repository: REQ-ANC-003 defines the search in terms of
// `.gitignore`, so the test has to exercise git's own notion of ignored.
function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "specd-search-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, ".."), { recursive: true });
    writeFileSync(absolute, content);
  }
  spawnSync("git", ["init", "-q"], { cwd: root });
  return root;
}

// REQ-ANC-003 — Repository-wide fallback search
describe("findSymbolInRepo", () => {
  it("finds a single match with its path and line", () => {
    const root = makeRepo({
      "src/token.ts": "\nexport function validateToken() {}\n",
      "src/other.ts": "export function unrelated() {}\n",
    });
    expect(findSymbolInRepo("export function validateToken", { root })).toEqual(
      [{ file: "src/token.ts", line: 2 }],
    );
  });

  it("returns every match when the symbol is ambiguous", () => {
    const root = makeRepo({
      "src/a.ts": "export function dup() {}\n",
      "src/b.ts": "export function dup() {}\n",
    });
    expect(
      findSymbolInRepo("export function dup", { root }).map((m) => m.file),
    ).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("returns nothing when the symbol is absent", () => {
    const root = makeRepo({ "src/a.ts": "export function other() {}\n" });
    expect(findSymbolInRepo("export function gone", { root })).toEqual([]);
  });

  it("skips the excluded file", () => {
    const root = makeRepo({
      "src/a.ts": "export function dup() {}\n",
      "src/b.ts": "export function dup() {}\n",
    });
    expect(
      findSymbolInRepo("export function dup", {
        root,
        exclude: ["src/a.ts"],
      }).map((m) => m.file),
    ).toEqual(["src/b.ts"]);
  });

  it("respects .gitignore", () => {
    const root = makeRepo({
      ".gitignore": "dist/\n",
      "src/a.ts": "export function only() {}\n",
      "dist/a.js": "export function only() {}\n",
    });
    expect(
      findSymbolInRepo("export function only", { root }).map((m) => m.file),
    ).toEqual(["src/a.ts"]);
  });

  it("orders results by path so repeated runs agree", () => {
    const root = makeRepo({
      "src/z.ts": "export function dup() {}\n",
      "src/a.ts": "export function dup() {}\n",
      "src/m.ts": "export function dup() {}\n",
    });
    const runs = Array.from({ length: 5 }, () =>
      JSON.stringify(findSymbolInRepo("export function dup", { root })),
    );
    expect(new Set(runs).size).toBe(1);
    expect(JSON.parse(runs[0] as string)).toEqual([
      { file: "src/a.ts", line: 1 },
      { file: "src/m.ts", line: 1 },
      { file: "src/z.ts", line: 1 },
    ]);
  });

  it("falls back to a plain walk outside a git repository", () => {
    const root = mkdtempSync(join(tmpdir(), "specd-search-"));
    roots.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "a.ts"), "export function only() {}\n");
    expect(listFiles(root)).toContain("src/a.ts");
    expect(
      findSymbolInRepo("export function only", { root }).map((m) => m.file),
    ).toEqual(["src/a.ts"]);
  });
});
