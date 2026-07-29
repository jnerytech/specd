import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, boardCardMode } from "../../src/config/schema.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { ConfigError } from "../../src/config/errors.js";
import { verify } from "../../src/verify/index.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
  proposal,
} from "./helpers.js";

afterEach(cleanupWorkspaces);

const BOARD = '[board]\nprovider = "redmine"\n';
const LEVELS = 'levels = ["schema"]\n';

function workspace(options: { config: string; proposal?: string }) {
  return makeWorkspace({
    config: `[verify]\n${LEVELS}\n${options.config}`,
    specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    change: {
      name: "2026-07-demo",
      delta: delta({
        change: "2026-07-demo",
        added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
      }),
      ...(options.proposal === undefined ? {} : { proposal: options.proposal }),
    },
  });
}

// REQ-CFG-012 — the mode is read from the configuration, and a repository
// without a board is never asked the question.
describe("board card mode — REQ-CFG-012", () => {
  it("has no mode where no board is configured", () => {
    expect(boardCardMode(DEFAULT_CONFIG)).toBeUndefined();
  });

  it("defaults to required where a board is configured", () => {
    const { root, globalPath } = makeWorkspace({ config: BOARD });

    expect(boardCardMode(resolveConfig({ cwd: root, globalPath }))).toBe(
      "required",
    );
  });

  it("reads optional from the configuration", () => {
    const { root, globalPath } = makeWorkspace({
      config: `${BOARD}card = "optional"\n`,
    });

    expect(boardCardMode(resolveConfig({ cwd: root, globalPath }))).toBe(
      "optional",
    );
  });

  it("rejects a value outside the set", () => {
    const { root, globalPath } = makeWorkspace({
      config: `${BOARD}card = "whenever"\n`,
    });

    expect(() => resolveConfig({ cwd: root, globalPath })).toThrowError(
      ConfigError,
    );
  });
});

// REQ-FMT-011 — the half that needs the configuration to answer.
describe("declared card — REQ-FMT-011", () => {
  it("fails a change with no card where a card is required", async () => {
    const { root } = workspace({ config: BOARD });

    const report = await verify({ cwd: root, fast: true });

    expect(report.ok).toBe(false);
    expect(
      report.layers
        .flatMap((layer) => layer.violations)
        .map((violation) => violation.message)
        .join("\n"),
    ).toContain("declares no board card");
  });

  it("accepts a change with no card where the card is optional", async () => {
    const { root } = workspace({ config: `${BOARD}card = "optional"\n` });

    expect((await verify({ cwd: root, fast: true })).ok).toBe(true);
  });

  it("accepts a declared card in either mode", async () => {
    const declared = proposal({
      change: "2026-07-demo",
      card: { ref: "4821", url: "https://board.example/issues/4821" },
    });

    for (const config of [BOARD, `${BOARD}card = "optional"\n`]) {
      const { root } = workspace({ config, proposal: declared });
      expect((await verify({ cwd: root, fast: true })).ok).toBe(true);
    }
  });

  it("asks nothing of a repository without a board", async () => {
    const { root } = workspace({ config: "" });

    expect((await verify({ cwd: root, fast: true })).ok).toBe(true);
  });
});
