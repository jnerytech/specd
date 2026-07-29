import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.js";
import { EXIT, type ExitCode } from "../../src/cli/exit-codes.js";
import {
  SCOPE_USAGE,
  renderScopeHelp,
  type Scope,
} from "../../src/cli/usage.js";

const bare: string[] = [];

afterEach(() => {
  while (bare.length > 0)
    rmSync(bare.pop() as string, { recursive: true, force: true });
});

// A directory with no `.specd/` in it. Any scope that did its work before
// answering the help flag would reach for a spec tree that is not there.
function bareDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), "specd-scope-"));
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

const SCOPES = Object.keys(SCOPE_USAGE) as Scope[];

// An argument list that makes each scope refuse for a usage reason, so the
// refusal can be compared against the help. Kept beside the scope list on
// purpose: a scope added without one fails the exhaustiveness check below.
const REFUSALS: Record<Scope, string[]> = {
  init: ["init", "--nope"],
  verify: ["verify", "--nope"],
  status: ["status", "--nope"],
  explore: ["explore"],
  sync: ["sync", "--nope"],
  archive: ["archive", "one", "two"],
  anchor: ["anchor", "bogus"],
  "anchor suggest": ["anchor", "suggest", "one", "two"],
  "anchor fix": ["anchor", "fix"],
  hooks: ["hooks", "bogus"],
  "hooks install": ["hooks", "install", "positional"],
  "hooks uninstall": ["hooks", "uninstall", "positional"],
  "hooks run": ["hooks", "run"],
};

// REQ-CLI-010 — every scope answers --help.
describe("scope help", () => {
  it("covers every scope with a refusal case", () => {
    expect(Object.keys(REFUSALS).sort()).toEqual([...SCOPES].sort());
  });

  it.each(SCOPES)(
    "answers `%s --help` with that scope's text",
    async (scope) => {
      const run = await cli([...scope.split(" "), "--help"], bareDirectory());
      expect(run.status).toBe(EXIT.OK);
      expect(run.stdout).toBe(renderScopeHelp(scope));
    },
  );

  it.each(SCOPES)("answers `%s -h` the same way", async (scope) => {
    const run = await cli([...scope.split(" "), "-h"], bareDirectory());
    expect(run.status).toBe(EXIT.OK);
    expect(run.stdout).toBe(renderScopeHelp(scope));
  });

  it("gives every scope a text of its own", () => {
    const texts = SCOPES.map((scope) => renderScopeHelp(scope));
    expect(new Set(texts).size).toBe(SCOPES.length);
  });

  // The flag the reader is asking about is the reason they are asking.
  it("answers help before validating options", async () => {
    const run = await cli(["verify", "--nope", "--help"], bareDirectory());
    expect(run.status).toBe(EXIT.OK);
    expect(run.stdout).toBe(renderScopeHelp("verify"));
  });

  // costly-ops-are-not-silent: `sync` and `explore` open the network, `archive` rewrites capabilities.
  // A help flag read too late would be the one way this surface costs anything.
  it("does no work and writes nothing", async () => {
    const cwd = bareDirectory();
    for (const scope of SCOPES) {
      const run = await cli([...scope.split(" "), "--help"], cwd);
      expect(run.status).toBe(EXIT.OK);
    }
    expect(readdirSync(cwd)).toEqual([]);
  });

  it("never returns the gate failure code", async () => {
    const cwd = bareDirectory();
    for (const scope of SCOPES) {
      const help = await cli([...scope.split(" "), "--help"], cwd);
      const refusal = await cli(REFUSALS[scope], cwd);
      expect(help.status).toBe(EXIT.OK);
      expect(refusal.status).toBe(EXIT.OPERATIONAL_FAILURE);
    }
  });
});

// REQ-CLI-011 — a scope's usage text has one source.
describe("refusal and help share a source", () => {
  it.each(SCOPES)("names the help of `%s` when it refuses", async (scope) => {
    const run = await cli(REFUSALS[scope], bareDirectory());
    expect(run.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(run.stderr).toContain(renderScopeHelp(scope).trimEnd());
    expect(run.stdout).toBe("");
  });

  it("keeps no second copy of a signature in the source", () => {
    // Every scope's usage line is declared once, in SCOPE_USAGE. If a `throw`
    // site spelled its own again, this is the shape it would take.
    for (const scope of SCOPES) {
      expect(renderScopeHelp(scope)).toContain(`specd ${scope.split(" ")[0]}`);
    }
  });
});
