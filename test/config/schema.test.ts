import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT } from "../../src/cli/exit-codes.js";
import { ConfigError } from "../../src/config/errors.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { makeFixture, type ConfigFixture } from "./helpers.js";

const fixtures: ConfigFixture[] = [];

function load(workspaceToml: string): () => void {
  const f = makeFixture({ workspace: workspaceToml });
  fixtures.push(f);
  return () => resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
}

function workspaceFile(f: ConfigFixture): string {
  return join(f.cwd, ".specd", "config.toml");
}

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

// REQ-CFG-002 — Unknown keys are rejected
describe("unknown keys", () => {
  it("rejects an unknown key with exit code 2", () => {
    const attempt = load(`[verify]\nlevles = ["schema"]\n`);
    try {
      attempt();
      expect.unreachable("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).exitCode).toBe(EXIT.OPERATIONAL_FAILURE);
    }
  });

  it("message cites file, key and nearby valid keys", () => {
    const attempt = load(`[verify]\nlevles = ["schema"]\n`);
    const f = fixtures[fixtures.length - 1] as ConfigFixture;
    expect(attempt).toThrowError(
      expect.objectContaining({
        message: expect.stringContaining(workspaceFile(f)),
      }),
    );
    try {
      attempt();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('"verify.levles"');
      expect(message).toContain('Did you mean "levels"?');
      expect(message).toContain("validation_command");
    }
  });

  it("rejects an unknown top-level section", () => {
    const attempt = load(`[projct]\nclient = "x"\n`);
    expect(attempt).toThrowError(
      /unknown key "projct".*Did you mean "project"/s,
    );
  });

  it("rejects a wrong type with exit code 2", () => {
    const attempt = load(`[memory]\nenabled = "yes"\n`);
    try {
      attempt();
      expect.unreachable("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).exitCode).toBe(EXIT.OPERATIONAL_FAILURE);
      expect((error as Error).message).toContain('"memory.enabled"');
      expect((error as Error).message).toContain("expects a boolean");
    }
  });

  it("rejects a value outside a closed enum, listing valid values", () => {
    const attempt = load(`[verify]\nlevels = ["schema", "vibes"]\n`);
    expect(attempt).toThrowError(/"vibes".*valid values are.*"anchors"/s);
  });

  it("rejects invalid TOML as an operational failure", () => {
    const attempt = load(`[verify\nlevels = [\n`);
    try {
      attempt();
      expect.unreachable("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).exitCode).toBe(EXIT.OPERATIONAL_FAILURE);
    }
  });
});
