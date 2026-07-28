import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { EXIT, type ExitCode } from "../src/cli/exit-codes.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
} from "./verify/helpers.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

afterEach(cleanupWorkspaces);

interface Run {
  status: ExitCode;
  stdout: string;
  stderr: string;
}

// Drives the CLI in-process. Spawning it would need the workspace as cwd,
// which breaks module resolution for the loader; the command surface and the
// exit code are the same either way.
async function cli(args: string[], cwd = process.cwd()): Promise<Run> {
  let stdout = "";
  let stderr = "";
  const status = await main(args, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    cwd,
  });
  return { status, stdout, stderr };
}

const RESOLVING = capability({
  name: "demo",
  id: "REQ-DEMO-001",
  anchors: '- file: src/app.ts\n  symbol: "export function run"',
});

const DANGLING = capability({
  name: "demo",
  id: "REQ-DEMO-001",
  anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
});

const STRICT_CONFIG =
  '[verify]\nlevels = ["schema", "anchors"]\n\n[verify.anchors]\npolicy = "strict"\n';

describe("cli entrypoint", () => {
  it("prints the package version and exits 0 when run as the binary", () => {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", "--version"],
      { encoding: "utf8" },
    );
    expect(output.trim()).toBe(`specd ${version}`);
  });

  it("prints usage when invoked with no command", async () => {
    const result = await cli([]);
    expect(result.status).toBe(EXIT.OK);
    expect(result.stdout).toContain("Usage: specd <command>");
  });

  // REQ-CLI-004 — an unknown command is the tool failing to run, not a gate
  // verdict, so it must never be confused with exit 1.
  it("exits 2 on an unknown command", async () => {
    const result = await cli(["nope"]);
    expect(result.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(result.stderr).toContain('Unknown command "nope"');
  });

  it("exits 2 on an unknown option", async () => {
    const result = await cli(["verify", "--nope"]);
    expect(result.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(result.stderr).toContain('Unknown option "--nope"');
  });
});

// REQ-CLI-001 — Single gate; REQ-CLI-004 — Exit code contract
describe("specd verify exit codes", () => {
  it("exits 0 when the gate passes", async () => {
    const workspace = makeWorkspace({
      config: '[verify]\nlevels = ["schema", "anchors"]\n',
      specs: { demo: RESOLVING },
      files: { "src/app.ts": "export function run(): void {}\n" },
    });
    const result = await cli(["verify"], workspace.root);
    expect(result.status).toBe(EXIT.OK);
    expect(result.stdout).toContain("verify: passed");
  });

  it("exits 1 when an anchor dangles", async () => {
    const workspace = makeWorkspace({
      config: STRICT_CONFIG,
      specs: { demo: DANGLING },
    });
    const result = await cli(["verify"], workspace.root);
    expect(result.status).toBe(EXIT.GATE_FAILURE);
    expect(result.stdout).toContain("verify: failed");
  });

  it("exits 2 on invalid configuration, never 1", async () => {
    const workspace = makeWorkspace({ config: "[verify]\nlevles = 1\n" });
    const result = await cli(["verify"], workspace.root);
    expect(result.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(result.stderr).toContain("unknown key");
  });
});

// REQ-ANC-001 / REQ-CLI-003 — anchor suggest reports, it never decides.
describe("specd anchor suggest", () => {
  const workspace = () =>
    makeWorkspace({
      config: "",
      specs: {
        demo:
          "---\ncapability: demo\nretired: []\n---\n\n# demo\n\n" +
          "### REQ-DEMO-001 — Example\n\n" +
          "**Statement.** The specd demo SHALL do the thing.\n\n" +
          "**Acceptance.**\n- `redactPayload` removes the listed fields\n",
      },
      files: { "src/redact.ts": "export function redactPayload(): void {}\n" },
    });

  it("prints candidates and exits 0", async () => {
    const result = await cli(["anchor", "suggest", "demo"], workspace().root);
    expect(result.status).toBe(EXIT.OK);
    expect(result.stdout).toContain("REQ-DEMO-001");
    expect(result.stdout).toContain('symbol: "export function redactPayload"');
    expect(result.stdout).toContain("specd never writes these into the spec");
  });

  it("emits JSON with --json", async () => {
    const result = await cli(
      ["anchor", "suggest", "demo", "--json"],
      workspace().root,
    );
    const report = JSON.parse(result.stdout) as {
      capability: string;
      requirements: Array<{ candidates: Array<{ confidence: string }> }>;
    };
    expect(report.capability).toBe("demo");
    expect(report.requirements[0]?.candidates[0]?.confidence).toBe("unique");
  });

  // REQ-CLI-001: only verify may exit 1. A missing capability is operational.
  it("exits 2 on an unknown capability, never 1", async () => {
    const result = await cli(["anchor", "suggest", "nope"], workspace().root);
    expect(result.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(result.stderr).toContain('No capability named "nope"');
  });

  it("exits 2 on a missing capability argument", async () => {
    const result = await cli(["anchor", "suggest"], workspace().root);
    expect(result.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(result.stderr).toContain("exactly one capability name");
  });

  it("exits 2 on an unknown subcommand", async () => {
    const result = await cli(["anchor", "fix", "demo"], workspace().root);
    expect(result.status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(result.stderr).toContain('Unknown subcommand "fix"');
  });
});

// REQ-VER-008 — Machine-readable report
describe("specd verify --json", () => {
  it("emits the full report as JSON on stdout", async () => {
    const workspace = makeWorkspace({
      config: STRICT_CONFIG,
      specs: { demo: DANGLING },
    });
    const result = await cli(["verify", "--json"], workspace.root);
    const report = JSON.parse(result.stdout) as {
      ok: boolean;
      layers: Array<{ layer: string }>;
      violations: Array<{ severity: string }>;
    };
    expect(report.ok).toBe(false);
    expect(report.layers.map((l) => l.layer)).toEqual(["schema", "anchors"]);
    expect(report.violations[0]?.severity).toBe("error");
  });

  it("moves the human rendering to stderr so the pipe stays parseable", async () => {
    const workspace = makeWorkspace({
      config: STRICT_CONFIG,
      specs: { demo: DANGLING },
    });
    const result = await cli(["verify", "--json"], workspace.root);
    expect(result.stderr).toContain("verify: failed");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });
});
