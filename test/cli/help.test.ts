import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.js";
import { EXIT, type ExitCode } from "../../src/cli/exit-codes.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

// REQ-CLI-008 — help and version print and never judge.
//
// Every case runs against a directory with no `.specd/` in it. That is the
// point rather than a convenience: a project without a spec tree makes
// `verify` exit 2 (absence-is-not-compliance, first instance), so any help path that touched the spec
// would fail here instead of quietly working.
const bare: string[] = [];

afterEach(() => {
  while (bare.length > 0)
    rmSync(bare.pop() as string, { recursive: true, force: true });
});

function bareDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), "specd-help-"));
  bare.push(root);
  return root;
}

interface Run {
  status: ExitCode;
  stdout: string;
  stderr: string;
}

async function cli(args: string[], cwd: string): Promise<Run> {
  let stdout = "";
  let stderr = "";
  const status = await main(args, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    cwd,
  });
  return { status, stdout, stderr };
}

const HELP_PATHS = [[], ["--help"], ["-h"], ["help"]];
const VERSION_PATHS = [["--version"], ["-v"]];

describe("help and version", () => {
  it("answers the four help entry points with the same text and exit 0", async () => {
    const cwd = bareDirectory();
    const runs = await Promise.all(HELP_PATHS.map((args) => cli(args, cwd)));

    for (const run of runs) {
      expect(run.status).toBe(EXIT.OK);
      expect(run.stdout).toBe(runs[0]?.stdout);
      expect(run.stdout.length).toBeGreaterThan(0);
    }
  });

  it("answers both version entry points with the declared version and exit 0", async () => {
    const cwd = bareDirectory();

    for (const args of VERSION_PATHS) {
      const run = await cli(args, cwd);
      expect(run.status).toBe(EXIT.OK);
      expect(run.stdout.trim()).toBe(`specd ${version}`);
    }
  });

  // The gate refuses a directory with no spec tree. If any of these read one,
  // this is where it would show.
  it("writes nothing into the working directory", async () => {
    const cwd = bareDirectory();

    for (const args of [...HELP_PATHS, ...VERSION_PATHS]) {
      await cli(args, cwd);
    }

    expect(readdirSync(cwd)).toEqual([]);
  });

  // REQ-CLI-008 and REQ-CLI-004: this surface prints. Only `verify` may reprove,
  // and an unknown command is the tool failing to run rather than a verdict.
  it("never returns the gate failure code", async () => {
    const cwd = bareDirectory();

    for (const args of [...HELP_PATHS, ...VERSION_PATHS, ["nope"]]) {
      const run = await cli(args, cwd);
      expect(run.status).not.toBe(EXIT.GATE_FAILURE);
    }
  });

  it("sends the usage of an unknown command to stderr and exits 2", async () => {
    const run = await cli(["nope"], bareDirectory());
    expect(run.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(run.stderr).toContain('Unknown command "nope"');
    expect(run.stderr).toContain("Usage: specd <command>");
    expect(run.stdout).toBe("");
  });
});
