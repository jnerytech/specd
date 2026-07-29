import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError } from "../../src/config/errors.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { detectStack } from "../../src/init/detect-stack.js";
import { GENERATED_PATTERNS } from "../../src/init/gitattributes.js";
import { LAYER_ORDER } from "../../src/verify/index.js";
import { formatInitResult, init } from "../../src/init/index.js";
import { verify } from "../../src/verify/index.js";
import { cleanupWorkspaces, makeWorkspace } from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

// makeWorkspace always writes .specd/config.toml; blanking it gives `init` the
// clean repository it is meant to run against.
function freshRepo(files: Record<string, string> = {}): string {
  const workspace = makeWorkspace({ files });
  writeFileSync(join(workspace.root, ".specd", "config.toml"), "");
  return workspace.root;
}

// REQ-CFG-005 — Init detects the stack
describe("detectStack", () => {
  it("proposes an npm command for a package.json", () => {
    const root = freshRepo({ "package.json": '{"name":"x"}' });
    expect(detectStack(root)).toEqual({
      name: "node",
      manifest: "package.json",
      validationCommand: ["npm", "test"],
    });
  });

  it("prefers an existing aggregate script over npm test", () => {
    const root = freshRepo({
      "package.json": '{"scripts":{"test":"vitest","verify":"make check"}}',
    });
    expect(detectStack(root)?.validationCommand).toEqual([
      "npm",
      "run",
      "verify",
    ]);
  });

  it("proposes pytest for a pyproject.toml", () => {
    const root = freshRepo({ "pyproject.toml": "[project]\nname = 'x'\n" });
    expect(detectStack(root)).toMatchObject({
      name: "python",
      validationCommand: ["pytest"],
    });
  });

  it("detects nothing in a repository with no known manifest", () => {
    expect(detectStack(freshRepo({ "notes.txt": "hi" }))).toBeUndefined();
  });
});

// REQ-CFG-004 — Init writes complete defaults
describe("init", () => {
  it("writes every supported section, not an empty skeleton", () => {
    const root = freshRepo({ "package.json": '{"name":"x"}' });
    init({ cwd: root, force: true });
    const written = readFileSync(join(root, ".specd", "config.toml"), "utf8");

    for (const section of [
      "[project]",
      "[board]",
      "[verify]",
      "[verify.anchors]",
      "[anchors]",
      "[memory]",
      "explore.sources",
    ]) {
      expect(written).toContain(section);
    }
    // Inline comments, not a bare key list.
    expect(
      written.split("\n").filter((l) => l.startsWith("#")).length,
    ).toBeGreaterThan(10);
  });

  it("fills in the validation command from the detected stack", () => {
    const root = freshRepo({
      "package.json": '{"scripts":{"test":"vitest"}}',
    });
    const result = init({ cwd: root, force: true });
    const written = readFileSync(join(root, ".specd", "config.toml"), "utf8");

    expect(result.detection?.name).toBe("node");
    expect(written).toContain('validation_command = ["npm", "test"]');
    expect(written).toContain("Detected from package.json");
  });

  it("leaves the command commented with an instruction when nothing is detected", () => {
    const root = freshRepo({ "notes.txt": "hi" });
    const written = (() => {
      init({ cwd: root, force: true });
      return readFileSync(join(root, ".specd", "config.toml"), "utf8");
    })();

    expect(written).toContain("No build manifest was recognised");
    expect(written).toContain('# validation_command = ["make", "check"]');
    expect(written).not.toMatch(/^validation_command/m);
  });

  it("creates the specd directories", () => {
    const root = freshRepo();
    init({ cwd: root, force: true });
    // REQ-CFG-004: the archive lives inside `changes/`, where `specd archive`
    // writes it. `init` used to create `.specd/archive/`, which nothing read.
    for (const directory of ["specs", "changes", "changes/archive"]) {
      expect(existsSync(join(root, ".specd", directory))).toBe(true);
    }
    expect(existsSync(join(root, ".specd", "archive"))).toBe(false);
  });

  // REQ-CFG-004 acceptance: running verify right after init raises no
  // configuration error.
  it("produces a configuration verify accepts", async () => {
    const root = freshRepo({ "package.json": '{"name":"x"}' });
    init({ cwd: root, force: true });

    const report = await verify({
      cwd: root,
      fast: true,
      globalPath: join(root, "absent"),
    });
    // REQ-CFG-004: every layer the pipeline knows runs on the first verify
    // after init. The template used to hand-maintain this list and offered
    // three of six, so a project scaffolded after change `archive-cycle-and-effective-specs` started with half the
    // gate switched off and nothing said so. This assertion is what stops the
    // divergence from coming back.
    expect(report.layers.map((l) => l.layer)).toEqual([...LAYER_ORDER]);
    expect(() => resolveConfig({ cwd: root })).not.toThrow();
  });

  it("refuses to overwrite an existing configuration without --force", () => {
    const root = freshRepo();
    init({ cwd: root, force: true });
    expect(() => init({ cwd: root })).toThrow(ConfigError);
    expect(() => init({ cwd: root })).toThrow(/--force/);
  });

  // REQ-EXP-006 — the bundle is registered as generated, versioned content.
  it("registers the explore bundle in .gitattributes", () => {
    const root = freshRepo();
    const result = init({ cwd: root, force: true });
    const written = readFileSync(join(root, ".gitattributes"), "utf8");

    expect(result.gitattributesUpdated).toBe(true);
    for (const pattern of GENERATED_PATTERNS) {
      expect(written).toContain(pattern);
    }
    expect(existsSync(join(root, ".gitignore"))).toBe(false);
  });

  it("does not duplicate the .gitattributes block on a second run", () => {
    const root = freshRepo();
    init({ cwd: root, force: true });
    const first = readFileSync(join(root, ".gitattributes"), "utf8");

    const second = init({ cwd: root, force: true });
    expect(second.gitattributesUpdated).toBe(false);
    expect(readFileSync(join(root, ".gitattributes"), "utf8")).toBe(first);
  });

  it("keeps hand-written .gitattributes content", () => {
    const root = freshRepo();
    writeFileSync(join(root, ".gitattributes"), "*.png binary\n");
    init({ cwd: root, force: true });
    expect(readFileSync(join(root, ".gitattributes"), "utf8")).toContain(
      "*.png binary",
    );
  });
});

// REQ-CLI-006 is covered by test/distribution/package.test.ts, which exercises
// the packaged tarball rather than the manifest alone.

// REQ-CFG-005 — Init detects the stack
describe("stack detection", () => {
  it("proposes dotnet test for a solution file", () => {
    const root = freshRepo({
      "GymErp.sln": "Microsoft Visual Studio Solution\n",
    });
    expect(init({ cwd: root, force: true }).detection).toMatchObject({
      name: "dotnet",
      manifest: "GymErp.sln",
      validationCommand: ["dotnet", "test"],
    });
  });

  it("proposes dotnet test for a bare project file", () => {
    const root = freshRepo({ "App.csproj": "<Project />\n" });
    expect(
      init({ cwd: root, force: true }).detection?.validationCommand,
    ).toEqual(["dotnet", "test"]);
  });

  it("proposes the verification target declared in a Makefile", () => {
    const root = freshRepo({ Makefile: "build:\n\techo\n\nverify:\n\techo\n" });
    expect(init({ cwd: root, force: true }).detection).toMatchObject({
      name: "make",
      validationCommand: ["make", "verify"],
    });
  });

  it("prefers a language manifest over a Makefile", () => {
    // A repository with both usually has the Makefile wrapping the other one,
    // and the language manifest is the more specific answer.
    const root = freshRepo({
      Makefile: "verify:\n\techo\n",
      "package.json": '{"name":"x","scripts":{"test":"vitest"}}',
    });
    expect(init({ cwd: root, force: true }).detection?.name).toBe("node");
  });

  // The message used to say "no build manifest recognised" in a repository with
  // a solution file at the root and twelve project files under it.
  it("names a manifest it found but does not understand", () => {
    const root = freshRepo({ "build.gradle": "plugins {}\n" });
    const result = init({ cwd: root, force: true });
    expect(result.detection).toBeUndefined();
    expect(result.unrecognisedManifests).toEqual(["build.gradle"]);
    expect(formatInitResult(result)).toContain("Found build.gradle");
    expect(formatInitResult(result)).not.toContain("No build manifest found");
  });

  it("says there was nothing when there was nothing", () => {
    const result = init({ cwd: freshRepo(), force: true });
    expect(result.unrecognisedManifests).toEqual([]);
    expect(formatInitResult(result)).toContain("No build manifest found");
  });
});
