import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listRepository } from "../../src/anchors/search.js";
import {
  grepStrategy,
  indexOfSymbol,
} from "../../src/anchors/strategies/grep.js";

const made: string[] = [];
afterEach(() => {
  while (made.length > 0)
    rmSync(made.pop() as string, { recursive: true, force: true });
});

function repo(
  files: Record<string, string>,
  options: { git?: boolean } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "specd-listing-"));
  made.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  if (options.git === true) {
    spawnSync("git", ["init", "-q"], { cwd: root, shell: false });
  }
  return root;
}

// REQ-ANC-009 — Listing falls back to the filesystem
describe("repository listing", () => {
  it("uses git when it succeeds and sees something", () => {
    const listing = listRepository(repo({ "src/a.ts": "x\n" }, { git: true }));
    expect(listing.mode).toBe("git");
    expect(listing.files).toContain("src/a.ts");
  });

  it("walks when there is no git repository at all", () => {
    const listing = listRepository(repo({ "src/a.ts": "x\n" }));
    expect(listing.mode).toBe("walk");
    expect(listing.files).toContain("src/a.ts");
  });

  // The failure this requirement exists for. Inside a tree the enclosing
  // repository ignores, `git ls-files` exits 0 and returns nothing — and the
  // ladder silently lost its whole fifth step.
  it("walks when git succeeds and returns nothing", () => {
    const outer = repo({ ".gitignore": "ignored/*\n" }, { git: true });
    const project = join(outer, "ignored", "project");
    mkdirSync(join(project, "src"), { recursive: true });
    writeFileSync(join(project, "src", "a.ts"), "export const a = 1;\n");

    const fromGit = spawnSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: project, encoding: "utf8", shell: false },
    );
    expect(fromGit.status).toBe(0);
    expect(fromGit.stdout.trim()).toBe("");

    const listing = listRepository(project);
    expect(listing.mode).toBe("walk");
    expect(listing.files).toContain("src/a.ts");
  });

  it("skips .git and dependency directories when walking", () => {
    const root = repo({
      "src/a.ts": "x\n",
      "node_modules/pkg/index.js": "x\n",
      "dist/a.js": "x\n",
    });
    expect(listRepository(root).files).toEqual(["src/a.ts"]);
  });
});

// REQ-ANC-010 — A match is an identifier, not a substring
describe("identifier matching", () => {
  const source =
    "public class TenantAccessorRegisterMiddleware(\n" +
    "public class TenantAccessor : IDisposable\n";

  it("does not match a longer identifier it prefixes", () => {
    const only =
      "public class TenantAccessorRegisterMiddleware(\nnothing else\n";
    expect(grepStrategy.matches(only, "public class TenantAccessor")).toBe(
      false,
    );
  });

  it("matches the real declaration, skipping the collision", () => {
    // The line number proves it skipped the first line rather than stopping
    // there — the collision used to win because it comes first.
    expect(grepStrategy.find(source, "public class TenantAccessor")).toBe(2);
  });

  it("matches when the symbol is followed by punctuation", () => {
    for (const after of ["(", ":", " ", '"', "\n", ";", ","]) {
      expect(
        indexOfSymbol(`export const X${after}rest`, "export const X"),
      ).toBe(0);
    }
  });

  it("does not require a boundary where the symbol already ends in punctuation", () => {
    // An anchor like `"bin"` carries its own delimiters; demanding an
    // identifier boundary after the closing quote would reject every match.
    expect(indexOfSymbol('{"bin":{"specd":"dist/cli.js"}}', '"bin"')).toBe(1);
  });

  it("does not match a longer identifier it suffixes", () => {
    expect(grepStrategy.matches("class MyEnrollment {}", "Enrollment")).toBe(
      false,
    );
  });
});
