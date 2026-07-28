import { afterEach, describe, expect, it } from "vitest";
import { EXIT } from "../../src/cli/exit-codes.js";
import { looksLikeToken, resolveToken } from "../../src/config/credentials.js";
import { ConfigError } from "../../src/config/errors.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { makeFixture, type ConfigFixture } from "./helpers.js";

const fixtures: ConfigFixture[] = [];

// Fake credentials, assembled at runtime so that secret scanners do not
// mistake these fixtures for real tokens.
const fakeToken = (prefix: string, body: string): string => `${prefix}${body}`;
const FAKE_GITHUB_TOKEN = fakeToken(
  "ghp_",
  "16C7e42F292c6912E7710c838347Ae178B4a",
);
const FAKE_SLACK_TOKEN = fakeToken("xoxb-", "1234567890-abcdefghijklmnop");
const FAKE_GITLAB_TOKEN = fakeToken("glpat-", "abcDEF123456789012345");

function load(workspaceToml: string): () => void {
  const f = makeFixture({ workspace: workspaceToml });
  fixtures.push(f);
  return () => resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
}

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

// REQ-CFG-003 — Credentials by environment reference
describe("literal tokens in configuration files", () => {
  it("rejects a literal token in token_env at load time", () => {
    const attempt = load(`[board]\ntoken_env = "${FAKE_GITHUB_TOKEN}"\n`);
    expect(attempt).toThrowError(ConfigError);
    expect(attempt).toThrowError(/literal credential/);
  });

  it("rejects token_env values that are not environment variable names", () => {
    const attempt = load(`[board]\ntoken_env = "not-a-var-name"\n`);
    expect(attempt).toThrowError(/must name an environment variable/);
  });

  it("rejects a token-looking literal in any string field", () => {
    const attempt = load(`[project]\nclient = "${FAKE_SLACK_TOKEN}"\n`);
    expect(attempt).toThrowError(/literal credential/);
  });

  it("accepts a proper environment variable reference", () => {
    const f = makeFixture({
      workspace: `[board]\ntoken_env = "SPECD_BOARD_TOKEN"\n`,
    });
    fixtures.push(f);
    const config = resolveConfig({ cwd: f.cwd, globalPath: f.globalPath });
    expect(config.board.token_env).toBe("SPECD_BOARD_TOKEN");
  });
});

describe("resolveToken", () => {
  it("fails with exit code 2 when the variable is absent — before any network call", () => {
    try {
      resolveToken("SPECD_MISSING_TOKEN", {});
      expect.unreachable("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).exitCode).toBe(EXIT.OPERATIONAL_FAILURE);
      expect((error as Error).message).toContain("SPECD_MISSING_TOKEN");
    }
  });

  it("treats an empty variable as absent", () => {
    expect(() => resolveToken("SPECD_EMPTY", { SPECD_EMPTY: "" })).toThrowError(
      ConfigError,
    );
  });

  it("returns the value of the referenced variable", () => {
    const env = { SPECD_BOARD_TOKEN: "s3cret-value" };
    expect(resolveToken("SPECD_BOARD_TOKEN", env)).toBe("s3cret-value");
  });
});

describe("looksLikeToken heuristic", () => {
  it("flags known credential prefixes", () => {
    expect(looksLikeToken(FAKE_GITHUB_TOKEN)).toBe(true);
    expect(looksLikeToken(FAKE_SLACK_TOKEN)).toBe(true);
    expect(looksLikeToken(FAKE_GITLAB_TOKEN)).toBe(true);
  });

  it("does not flag ordinary configuration values", () => {
    expect(looksLikeToken("SPECD_BOARD_TOKEN")).toBe(false);
    expect(looksLikeToken("pt-BR")).toBe(false);
    expect(looksLikeToken("npm run verify")).toBe(false);
    expect(looksLikeToken("jnerytech")).toBe(false);
  });
});
