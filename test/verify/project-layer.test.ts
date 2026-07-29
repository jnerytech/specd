import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config/schema.js";
import {
  classifyCommandFailure,
  projectLayer,
} from "../../src/verify/layers/project.js";
import type { VerifyLayerContext } from "../../src/verify/layers/types.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

function context(command: string[]): VerifyLayerContext {
  const root = mkdtempSync(join(tmpdir(), "specd-project-"));
  roots.push(root);
  return {
    root,
    config: {
      ...structuredClone(DEFAULT_CONFIG),
      verify: {
        ...structuredClone(DEFAULT_CONFIG.verify),
        validation_command: command,
      },
    },
    fast: false,
    effective: {
      requirements: [],
      capabilities: [],
      changes: [],
      diagnostics: [],
    },
  };
}

// REQ-VER-013 — A validation command that cannot be executed is operational.
describe("classifyCommandFailure", () => {
  it("calls a process that never started unrunnable", () => {
    expect(classifyCommandFailure({ spawnFailed: true })).toBe("unrunnable");
  });

  it("calls a process that ran and disapproved a verdict", () => {
    expect(classifyCommandFailure({ spawnFailed: false })).toBe("verdict");
  });
});

describe("project layer", () => {
  it("blocks rather than fails when the executable is missing", async () => {
    const result = await projectLayer.run(
      context(["specd-no-such-executable-anywhere"]),
    );
    expect(result.status).toBe("blocked");
  });

  it("names the three ways out, not just what happened", async () => {
    const result = await projectLayer.run(
      context(["specd-no-such-executable-anywhere"]),
    );
    const message = result.violations[0]?.message ?? "";
    expect(message).toContain("could not be executed");
    expect(message).toContain("verify.validation_command");
    expect(message).toContain("verify.levels");
    expect(message).toContain("exits 2");
  });

  // The distinction the README sells: CI has to tell "the spec disapproved"
  // from "the tool broke".
  it("still fails the gate when the command runs and returns non-zero", async () => {
    const result = await projectLayer.run(
      context(["node", "-e", "process.exit(3)"]),
    );
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
  });

  it("passes when the command succeeds", async () => {
    const result = await projectLayer.run(context(["node", "-e", ""]));
    expect(result.status).toBe("passed");
  });

  it("stays skipped under --fast, never passed", async () => {
    const ctx = { ...context(["node", "-e", ""]), fast: true };
    expect((await projectLayer.run(ctx)).status).toBe("skipped");
  });
});
