import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HOOK_EXIT } from "../../src/hooks/protocol.js";
import { runHook } from "../../src/hooks/run.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
} from "../verify/helpers.js";

const CONFIG = '[verify]\nlevels = ["schema", "anchors"]\n';

const made: string[] = [];
afterEach(() => {
  cleanupWorkspaces();
  while (made.length > 0)
    rmSync(made.pop() as string, { recursive: true, force: true });
});

// REQ-HOOK-005 — the adapter answers in the host's convention, never specd's.
describe("hook adapter exit codes", () => {
  it("allows when the gate is clean", async () => {
    const workspace = makeWorkspace({
      config: CONFIG,
      specs: { inert: capability({ name: "inert", id: "REQ-INERT-001" }) },
    });
    const outcome = await runHook("stop", { cwd: workspace.root, fast: true });
    expect(outcome.exitCode).toBe(HOOK_EXIT.ALLOW);
    expect(outcome.payload).toEqual({});
  });

  it("blocks with the host's code, never with specd's 1", async () => {
    const workspace = makeWorkspace({
      config: CONFIG,
      specs: {
        drift: capability({
          name: "drift",
          id: "REQ-DRIFT-001",
          anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
        }),
      },
    });
    const outcome = await runHook("stop", { cwd: workspace.root, fast: true });
    expect(outcome.exitCode).toBe(HOOK_EXIT.BLOCK);
    // The number the specd contract would have produced for the same verdict.
    // If it ever appears here, the two contracts have been confused.
    expect(outcome.exitCode).not.toBe(1);
    expect(outcome.payload.decision).toBe("block");
    expect(outcome.message).toContain("REQ-DRIFT-001");
  });

  it("carries the report as the reason, so the agent can act on it", async () => {
    const workspace = makeWorkspace({
      config: CONFIG,
      specs: {
        drift: capability({
          name: "drift",
          id: "REQ-DRIFT-001",
          anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
        }),
      },
    });
    const outcome = await runHook("post-tool-use", {
      cwd: workspace.root,
      fast: true,
    });
    expect(outcome.payload.reason).toBe(outcome.message);
    expect(outcome.message).toContain("specd anchor fix");
  });
});

// REQ-HOOK-006 / absence-is-not-compliance — three outcomes, and only the first allows.
describe("inability to verify blocks", () => {
  it("blocks in a directory that is not a specd project", async () => {
    const root = mkdtempSync(join(tmpdir(), "specd-hook-"));
    made.push(root);
    const outcome = await runHook("stop", { cwd: root, fast: true });
    expect(outcome.exitCode).toBe(HOOK_EXIT.BLOCK);
    expect(outcome.message).toContain("not a specd project");
    expect(outcome.message).toContain("This is not an approval");
  });

  it("blocks on invalid configuration", async () => {
    const workspace = makeWorkspace({
      config: '[verify]\nlevels = ["not-a-layer"]\n',
    });
    const outcome = await runHook("stop", { cwd: workspace.root, fast: true });
    expect(outcome.exitCode).toBe(HOOK_EXIT.BLOCK);
    expect(outcome.message).toContain("could not run the gate");
  });

  it("blocks rather than throwing, so nothing escapes carrying a specd code", async () => {
    const root = mkdtempSync(join(tmpdir(), "specd-hook-"));
    made.push(root);
    // `requireProjectRoot` throws an OperationalError whose `.exitCode` is 2 —
    // specd's "I refused to act". BLOCK is also 2, for an unrelated reason. The
    // adapter must translate rather than let the first travel as the second, so
    // this asserts the call resolves instead of rejecting.
    await expect(runHook("stop", { cwd: root, fast: true })).resolves.toEqual(
      expect.objectContaining({ exitCode: HOOK_EXIT.BLOCK }),
    );
  });
});
