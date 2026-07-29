import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  knownDeclarationExtensions,
  listDeclarations,
} from "../../src/anchors/declarations.js";
import { grepStrategy } from "../../src/anchors/strategies/grep.js";
import {
  formatFileSuggestReport,
  suggestForFile,
} from "../../src/anchors/suggest.js";
import { OperationalError } from "../../src/core/operational.js";

const made: string[] = [];
afterEach(() => {
  while (made.length > 0)
    rmSync(made.pop() as string, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "specd-decl-"));
  made.push(root);
  mkdirSync(join(root, ".specd", "specs"), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const CSHARP = [
  "namespace GymErp.Tenant;",
  "",
  "public class TenantAccessor : IDisposable",
  "{",
  "    private readonly ApplicationDbContext _context;",
  "    public void Dispose() { }",
  "}",
  "",
  "public sealed partial class TenantEfMiddleware(",
  "    RequestDelegate next)",
  "{",
  "}",
  "",
  "internal interface ITenantStore { }",
  "public record GetTenantResponse(string Name);",
  "public enum TenantState { Active, Suspended }",
].join("\n");

// REQ-ANC-012 — list what the file declares.
describe("declaration listing", () => {
  it("finds the C# declarations, in file order", () => {
    const listing = listDeclarations(CSHARP, "TenantAccessor.cs");
    expect(listing.known).toBe(true);
    if (!listing.known) return;
    expect(listing.declarations.map((d) => d.line)).toEqual([3, 9, 14, 15, 16]);
    expect(listing.declarations[0]?.symbol).toBe("public class TenantAccessor");
  });

  it("does not report a use as a declaration", () => {
    const listing = listDeclarations(CSHARP, "x.cs");
    if (!listing.known) throw new Error("expected a known language");
    const symbols = listing.declarations.map((d) => d.symbol).join("\n");
    expect(symbols).not.toContain("_context");
  });

  // The property that makes the output pasteable: every symbol reported occurs
  // verbatim in the file, so the ladder's third step finds it on the same line.
  it("reports symbols that resolve back to the line they came from", () => {
    const listing = listDeclarations(CSHARP, "x.cs");
    if (!listing.known) throw new Error("expected a known language");
    for (const declaration of listing.declarations) {
      expect(grepStrategy.find(CSHARP, declaration.symbol)).toBe(
        declaration.line,
      );
    }
  });

  it("composes nothing: every symbol is literal text of the file", () => {
    const listing = listDeclarations(CSHARP, "x.cs");
    if (!listing.known) throw new Error("expected a known language");
    for (const declaration of listing.declarations) {
      expect(CSHARP).toContain(declaration.symbol);
    }
  });

  it("is deterministic over an unchanged file", () => {
    expect(listDeclarations(CSHARP, "x.cs")).toEqual(
      listDeclarations(CSHARP, "x.cs"),
    );
  });

  it("reads TypeScript, Python and Go too", () => {
    const ts = listDeclarations(
      "export const A = 1;\nconst B = 2;\nexport function c() {}\nexport interface D {}\n",
      "a.ts",
    );
    if (!ts.known) throw new Error("expected a known language");
    expect(ts.declarations.map((d) => d.symbol)).toEqual([
      "export const A",
      "export function c",
      "export interface D",
    ]);

    const py = listDeclarations(
      "class A:\n    def b(self):\n        pass\n",
      "a.py",
    );
    if (!py.known) throw new Error("expected a known language");
    expect(py.declarations.map((d) => d.symbol)).toEqual(["class A", "def b"]);

    const go = listDeclarations("type A struct{}\nfunc B() {}\n", "a.go");
    if (!go.known) throw new Error("expected a known language");
    expect(go.declarations.map((d) => d.symbol)).toEqual(["type A", "func B"]);
  });

  // absence-is-not-compliance: not knowing how to read a file is a third outcome, not an empty list.
  it("says it cannot read an unknown extension", () => {
    const listing = listDeclarations("whatever\n", "a.zig");
    expect(listing.known).toBe(false);
    if (listing.known) return;
    expect(listing.extension).toBe(".zig");
  });

  it("distinguishes that from a known language declaring nothing", () => {
    const listing = listDeclarations("// only a comment\n", "a.ts");
    expect(listing.known).toBe(true);
    if (!listing.known) return;
    expect(listing.declarations).toEqual([]);
  });
});

describe("anchor suggest --file", () => {
  it("lists the declarations of the named file", () => {
    const root = project({ "src/TenantAccessor.cs": CSHARP });
    const report = suggestForFile({
      root,
      file: "src/TenantAccessor.cs",
    });
    expect(report.language).toBe("csharp");
    expect(report.declarations[0]?.symbol).toBe("public class TenantAccessor");
    expect(formatFileSuggestReport(report)).toContain(
      "src/TenantAccessor.cs:3",
    );
  });

  it("reports the unknown extension instead of an empty list", () => {
    const root = project({ "src/a.zig": "pub fn main() void {}\n" });
    const rendered = formatFileSuggestReport(
      suggestForFile({ root, file: "src/a.zig" }),
    );
    expect(rendered).toContain("No declaration pattern is known");
    expect(rendered).toContain(".zig");
    expect(rendered).toContain("Known extensions:");
    expect(knownDeclarationExtensions()).toContain(".cs");
  });

  it("refuses a path that is not a file", () => {
    const root = project({ "src/a.ts": "export const a = 1;\n" });
    expect(() => suggestForFile({ root, file: "src/missing.ts" })).toThrow(
      OperationalError,
    );
  });
});
