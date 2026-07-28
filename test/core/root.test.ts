import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectRoot, requireProjectRoot } from "../../src/core/root.js";
import { OperationalError } from "../../src/core/operational.js";

const made: string[] = [];
afterEach(() => {
  while (made.length > 0)
    rmSync(made.pop() as string, { recursive: true, force: true });
});

function tree(options: {
  specdAt?: string;
  git?: boolean;
  gitignore?: string;
}): string {
  const root = mkdtempSync(join(tmpdir(), "specd-root-"));
  made.push(root);
  mkdirSync(join(root, "deep", "deeper"), { recursive: true });
  if (options.specdAt !== undefined) {
    mkdirSync(join(root, options.specdAt, ".specd", "specs"), {
      recursive: true,
    });
  }
  if (options.git === true) {
    spawnSync("git", ["init", "-q"], { cwd: root, shell: false });
  }
  if (options.gitignore !== undefined) {
    writeFileSync(join(root, ".gitignore"), options.gitignore);
  }
  return root;
}

// REQ-CFG-010 — Project root is the directory holding `.specd/`
describe("project root", () => {
  it("is the directory holding .specd/", () => {
    const root = tree({ specdAt: "." });
    expect(findProjectRoot(root)).toBe(root);
  });

  it("resolves the same root from a subdirectory", () => {
    const root = tree({ specdAt: "." });
    expect(findProjectRoot(join(root, "deep", "deeper"))).toBe(root);
  });

  it("stops at the nearest .specd/, not the outermost", () => {
    const root = tree({ specdAt: "." });
    mkdirSync(join(root, "deep", ".specd", "specs"), { recursive: true });
    expect(findProjectRoot(join(root, "deep", "deeper"))).toBe(
      join(root, "deep"),
    );
  });

  // The two definitions this replaces: the working directory, and the git
  // toplevel. Neither is the project.
  it("does not require a git repository", () => {
    const root = tree({ specdAt: "." });
    expect(findProjectRoot(root)).toBe(root);
  });

  it("holds inside a tree the parent repository ignores", () => {
    // The exact shape that broke the tool: a specd project living under a
    // directory the enclosing repository gitignores.
    const outer = tree({ git: true, gitignore: "sandbox/*\n" });
    const project = join(outer, "sandbox", "sample");
    mkdirSync(join(project, ".specd", "specs"), { recursive: true });
    expect(findProjectRoot(project)).toBe(project);
  });

  it("is undefined when no ancestor has .specd/", () => {
    expect(findProjectRoot(tree({}))).toBeUndefined();
  });

  // P8: "this is not a specd project" is a third outcome, never a pass.
  it("refuses with exit 2 rather than continuing", () => {
    const root = tree({});
    expect(() => requireProjectRoot(root)).toThrow(OperationalError);
    expect(() => requireProjectRoot(root)).toThrow(/not a specd project/);
    try {
      requireProjectRoot(root);
    } catch (cause) {
      expect((cause as { exitCode: number }).exitCode).toBe(2);
    }
  });
});
