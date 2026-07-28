import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../../src/config/resolve.js";
import { DEFAULT_CONFIG } from "../../src/config/schema.js";
import { makeFixture, type ConfigFixture } from "./helpers.js";

const fixtures: ConfigFixture[] = [];

function fixture(contents: Parameters<typeof makeFixture>[0]): ConfigFixture {
  const f = makeFixture(contents);
  fixtures.push(f);
  return f;
}

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

// REQ-CFG-001 — Four-level precedence
describe("resolveConfig precedence", () => {
  it("uses built-in defaults when no file defines a field", () => {
    const f = fixture({});
    const config = resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("global file overrides defaults", () => {
    const f = fixture({ global: `[project]\nlanguage = "de"\n` });
    const config = resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
    expect(config.project.language).toBe("de");
  });

  it("workspace file overrides global", () => {
    const f = fixture({
      global: `[project]\nlanguage = "de"\n`,
      workspace: `[project]\nlanguage = "pt-BR"\n`,
    });
    const config = resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
    expect(config.project.language).toBe("pt-BR");
  });

  it("flag overrides workspace even when the workspace defines the field", () => {
    const f = fixture({
      global: `[project]\nlanguage = "de"\n`,
      workspace: `[project]\nlanguage = "pt-BR"\n`,
    });
    const config = resolveConfig({
      cwd: f.cwd,
      globalPath: f.globalPath,
      flags: { project: { language: "fr" } },
    });
    expect(config.project.language).toBe("fr");
  });

  it("merges field by field, never whole sections", () => {
    const f = fixture({
      global: `[verify]\nvalidation_command = ["make", "check"]\n`,
      workspace: `[verify]\nlevels = ["schema", "anchors"]\n`,
    });
    const config = resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
    // The workspace [verify] section must not wipe the global's field.
    expect(config.verify.levels).toEqual(["schema", "anchors"]);
    expect(config.verify.validation_command).toEqual(["make", "check"]);
    // Untouched nested field keeps its default.
    expect(config.verify.anchors.policy).toBe("graduated");
  });

  it("resolves this repository's own .specd/config.toml", () => {
    const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
    const f = fixture({});
    const config = resolveConfig({ cwd: repoRoot, globalPath: f.globalPath });
    expect(config.verify.levels).toEqual(["schema", "anchors", "project"]);
    expect(config.verify.validation_command).toEqual(["npm", "run", "verify"]);
    expect(config.project.client).toBe("jnerytech");
  });
});
