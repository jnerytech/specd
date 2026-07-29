import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
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
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const manifest = require("../../package.json") as Manifest;

function sourceFiles(): string[] {
  return ["src", "test"].flatMap((directory) =>
    readdirSync(join(REPO_ROOT, directory), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((entry) => entry.endsWith(".ts"))
      .map((entry) => join(REPO_ROOT, directory, entry)),
  );
}

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
  let binSymlink: string;

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

    // npm's own install step turns `bin` entries into symlinks under
    // node_modules/.bin/ — it never invokes `node <target>` directly. Node's
    // ESM loader resolves import.meta.url through that symlink, so a test
    // that skips it can pass while the real, installed binary is silently
    // inert. Reproduce that symlink here rather than spawning the target file
    // straight. The tarball itself stores dist/cli.js without the executable
    // bit; a real `npm install`/`npx` sets it via npm's bin-links step, which
    // plain `tar -xzf` skips, so that's reproduced by hand too.
    const target = join(extracted, "dist", "cli.js");
    chmodSync(target, 0o755);
    const binDir = mkdtempSync(join(tmpdir(), "specd-bin-"));
    binSymlink = join(binDir, "specd");
    symlinkSync(target, binSymlink);
  }, 120_000);

  afterAll(() => {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
    if (binSymlink)
      rmSync(join(binSymlink, ".."), { recursive: true, force: true });
  });

  it("publishes under the reserved scope", () => {
    expect(manifest.name).toBe("@jnerytech/specd");
  });

  it("declares bin.specd and ships dist", () => {
    expect(manifest.bin?.["specd"]).toBe("dist/cli.js");
    expect(manifest.files).toContain("dist");
  });

  it("the tarball contains the file bin.specd points at", () => {
    const target = manifest.bin?.["specd"] as string;
    expect(existsSync(join(extracted, target))).toBe(true);
  });

  it("the packaged binary runs and reports its version, invoked through the bin symlink npm creates", () => {
    const result = spawnSync(binSymlink, ["--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      `specd ${(require("../../package.json") as { version: string }).version}`,
    );
  });

  it("the packaged binary honours the exit code contract, invoked through the bin symlink npm creates", () => {
    // Exit 2 for an unknown command, never 1: only `verify` is a gate.
    const result = spawnSync(binSymlink, ["nope"], { encoding: "utf8" });
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

  // REQ-CLI-012 — the package does not depend on itself.
  //
  // `dependencies` carried "@jnerytech/specd": "^0.0.2", resolved from the
  // registry, and nothing imported it: a second copy of the product on disk
  // that nothing called. It was the residue of a correct instinct — a publish
  // is only proved by reading it back (P8), and installing the package and
  // running its binary is a real read-back. The mistake was leaving the proof
  // installed inside the thing it proved.
  //
  // The import assertion is the one that matters. It forbids the pattern and
  // not only the line: a gate in development that called the published product
  // would pin itself to the version before the fix being written, so green
  // would mean "the earlier specd approved" and read as "this specd approved" —
  // and in a circle, because publishing the fix needs the gate to pass.
  it("does not depend on itself", () => {
    for (const section of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
    ]) {
      expect(Object.keys(section ?? {})).not.toContain(manifest.name);
    }

    const selfImport = new RegExp(
      `(?:from|import|require\\()\\s*["']${manifest.name}["']`,
    );
    for (const file of sourceFiles()) {
      expect(readFileSync(file, "utf8")).not.toMatch(selfImport);
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
