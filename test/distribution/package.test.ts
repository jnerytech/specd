import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const REPO_ROOT = join(import.meta.dirname, "..", "..");

interface Manifest {
  name: string;
  bin?: Record<string, string>;
  files?: string[];
  dependencies?: Record<string, string>;
}

const manifest = require("../../package.json") as Manifest;

// REQ-CLI-006 — Zero-install distribution.
//
// This is the only place the suite executes the *packaged* artifact rather than
// the source. That is the drift it exists to catch: `files` or `bin` can be
// wrong while every source test passes.
//
// Offline by construction — the tarball is extracted and run against the
// repository's own node_modules, so no registry and no npm cache are involved.
describe("packaged distribution", () => {
  let extracted: string;
  let workspace: string;

  beforeAll(() => {
    // `npm pack` honours `files`, but does not build. On a clean checkout dist/
    // would be absent and the tarball would ship nothing.
    execFileSync("npm", ["run", "build"], { cwd: REPO_ROOT, stdio: "pipe" });

    workspace = mkdtempSync(join(tmpdir(), "specd-pack-"));
    const packed = execFileSync(
      "npm",
      ["pack", "--pack-destination", workspace],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" },
    )
      .trim()
      .split("\n")
      .at(-1) as string;

    execFileSync("tar", ["-xzf", join(workspace, packed), "-C", workspace]);
    extracted = join(workspace, "package");

    // Runtime dependencies come from the repository rather than a fresh
    // install: the point is to execute the packaged files, not to re-test npm.
    symlinkSync(
      join(REPO_ROOT, "node_modules"),
      join(extracted, "node_modules"),
      "dir",
    );
  }, 120_000);

  afterAll(() => {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  });

  it("publishes under the unscoped name", () => {
    expect(manifest.name).toBe("specd");
  });

  it("declares bin.specd and ships dist", () => {
    expect(manifest.bin?.["specd"]).toBe("dist/cli.js");
    expect(manifest.files).toContain("dist");
  });

  it("the tarball contains the file bin.specd points at", () => {
    const target = manifest.bin?.["specd"] as string;
    expect(existsSync(join(extracted, target))).toBe(true);
  });

  it("the packaged binary runs and reports its version", () => {
    const result = spawnSync(
      process.execPath,
      [join(extracted, manifest.bin?.["specd"] as string), "--version"],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      `specd ${(require("../../package.json") as { version: string }).version}`,
    );
  });

  it("the packaged binary honours the exit code contract", () => {
    // Exit 2 for an unknown command, never 1: only `verify` is a gate.
    const result = spawnSync(
      process.execPath,
      [join(extracted, manifest.bin?.["specd"] as string), "nope"],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(2);
  });

  it("ships no source and no build step for the client", () => {
    const shipped = readdirSync(extracted);
    expect(shipped).toContain("dist");
    expect(shipped).not.toContain("src");
    expect(shipped).not.toContain("tsconfig.json");

    const packaged = JSON.parse(
      readFileSync(join(extracted, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    for (const lifecycle of ["prepare", "install", "postinstall"]) {
      expect(packaged.scripts?.[lifecycle]).toBeUndefined();
    }
  });

  // Moved here from the anchors tests: the constraint is about what ships, not
  // about how anchors resolve (REQ-ANC-005 states only strategy selection).
  it("ships no WASM grammar dependency", () => {
    const runtime = Object.keys(manifest.dependencies ?? {});
    expect(runtime.filter((name) => /tree-?sitter|wasm/i.test(name))).toEqual(
      [],
    );
  });
});
