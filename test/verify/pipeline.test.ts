import { afterEach, describe, expect, it } from "vitest";
import { EXIT } from "../../src/cli/exit-codes.js";
import { ConfigError } from "../../src/config/errors.js";
import { LAYER_ORDER, verify } from "../../src/verify/index.js";
import type { VerifyReport } from "../../src/verify/report.js";
import { capability, cleanupWorkspaces, makeWorkspace } from "./helpers.js";

afterEach(cleanupWorkspaces);

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

const BROKEN_STATEMENT = capability({
  name: "demo",
  id: "REQ-DEMO-001",
  statement: "The specd verifier reads things.",
  anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
});

const APP = { "src/app.ts": "export function run(): void {}\n" };

function run(
  spec: Parameters<typeof makeWorkspace>[0],
  options: { fast?: boolean } = {},
): Promise<VerifyReport> {
  const workspace = makeWorkspace(spec);
  return verify({
    cwd: workspace.root,
    globalPath: workspace.globalPath,
    ...options,
  });
}

// REQ-VER-001 — Ordered layer execution
describe("layer order", () => {
  it("declares the fixed order", () => {
    expect([...LAYER_ORDER]).toEqual([
      "provenance",
      "schema",
      "coverage",
      "anchors",
      "evidence",
      "project",
    ]);
  });

  it("a failing schema layer prevents anchors from running", async () => {
    const report = await run({
      config: '[verify]\nlevels = ["schema", "anchors"]\n',
      specs: { demo: BROKEN_STATEMENT },
    });
    expect(report.layers.map((l) => l.layer)).toEqual(["schema"]);
    expect(report.stoppedAt).toBe("schema");
    expect(report.ok).toBe(false);
  });

  it("reports the layer it stopped at", async () => {
    const report = await run({
      config: '[verify]\nlevels = ["schema", "anchors"]\n',
      specs: { demo: DANGLING },
    });
    expect(report.stoppedAt).toBe("anchors");
    expect(report.layers.at(-1)?.status).toBe("failed");
  });

  it("runs layers in LAYER_ORDER regardless of the order configured", async () => {
    const report = await run({
      config: '[verify]\nlevels = ["anchors", "schema"]\n',
      specs: { demo: RESOLVING },
      files: APP,
    });
    expect(report.layers.map((l) => l.layer)).toEqual(["schema", "anchors"]);
    expect(report.ok).toBe(true);
  });
});

// REQ-VER-002 — Layers are individually disableable
describe("configured levels", () => {
  it("a layer absent from the list neither runs nor appears in the report", async () => {
    const report = await run({
      config: '[verify]\nlevels = ["schema"]\n',
      specs: { demo: DANGLING },
    });
    expect(report.layers.map((l) => l.layer)).toEqual(["schema"]);
    expect(report.disabled).toContain("anchors");
    expect(report.ok).toBe(true);
  });

  it("an empty list is a configuration error, not a silent pass", async () => {
    const workspace = makeWorkspace({ config: "[verify]\nlevels = []\n" });
    await expect(
      verify({ cwd: workspace.root, globalPath: workspace.globalPath }),
    ).rejects.toThrow(ConfigError);
  });

  it("a configured layer that is not implemented is a configuration error", async () => {
    const workspace = makeWorkspace({
      config: '[verify]\nlevels = ["coverage"]\n',
    });
    const attempt = verify({
      cwd: workspace.root,
      globalPath: workspace.globalPath,
    });
    await expect(attempt).rejects.toThrow(/not implemented in this version/);
    await expect(attempt).rejects.toMatchObject({
      exitCode: EXIT.OPERATIONAL_FAILURE,
    });
  });
});

// REQ-VER-006 — Project layer delegates by argv
describe("project layer", () => {
  const echoArgs = [
    process.execPath,
    "-e",
    "process.stdout.write(process.argv.slice(1).join('|'))",
  ];

  it("executes the command without a shell", async () => {
    const report = await run({
      config:
        '[verify]\nlevels = ["project"]\nvalidation_command = ' +
        JSON.stringify([...echoArgs, "a;b", "$HOME", "*"]) +
        "\n",
    });
    const project = report.layers[0];
    expect(project?.status).toBe("passed");
    // A shell would have split on ";", expanded $HOME and globbed "*".
    expect(project?.stdout).toBe("a;b|$HOME|*");
  });

  it("fails the layer on a non-zero exit code and keeps the output", async () => {
    const report = await run({
      config:
        '[verify]\nlevels = ["project"]\nvalidation_command = ' +
        JSON.stringify([
          process.execPath,
          "-e",
          "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
        ]) +
        "\n",
    });
    const project = report.layers[0];
    expect(project?.status).toBe("failed");
    expect(project?.exitCode).toBe(3);
    expect(project?.stdout).toBe("out");
    expect(project?.stderr).toBe("err");
    expect(report.ok).toBe(false);
    expect(report.violations[0]?.message).toContain("exited with code 3");
  });

  it("is skipped when no validation_command is configured", async () => {
    const report = await run({ config: '[verify]\nlevels = ["project"]\n' });
    expect(report.layers[0]?.status).toBe("skipped");
    expect(report.ok).toBe(true);
  });
});

// REQ-VER-007 — Fast mode
describe("fast mode", () => {
  const config =
    '[verify]\nlevels = ["project"]\nvalidation_command = ' +
    JSON.stringify([process.execPath, "-e", "process.exit(1)"]) +
    "\n";

  it("marks the project layer as skipped, not as passed", async () => {
    const report = await run({ config }, { fast: true });
    expect(report.layers[0]?.status).toBe("skipped");
    expect(report.layers[0]?.status).not.toBe("passed");
    expect(report.ok).toBe(true);
  });

  it("does not execute validation_command", async () => {
    const report = await run({ config }, { fast: true });
    expect(report.layers[0]?.exitCode).toBeUndefined();
  });

  it("without --fast the same command fails the gate", async () => {
    const report = await run({ config });
    expect(report.layers[0]?.status).toBe("failed");
  });
});

// REQ-VER-008 — Machine-readable report
describe("report shape", () => {
  it("carries executed layers, violations and a severity per item", async () => {
    const report = await run({
      config: '[verify]\nlevels = ["schema", "anchors"]\n',
      specs: { demo: DANGLING },
    });
    const parsed = JSON.parse(JSON.stringify(report)) as VerifyReport;
    expect(parsed.layers.map((l) => l.layer)).toEqual(["schema", "anchors"]);
    expect(parsed.violations.length).toBeGreaterThan(0);
    for (const violation of parsed.violations) {
      expect(["error", "warning"]).toContain(violation.severity);
      expect(violation.file).toBeTruthy();
      expect(typeof violation.line).toBe("number");
    }
  });
});
