import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalError } from "../../src/core/operational.js";
import { verify } from "../../src/verify/index.js";
import type { VerifyReport } from "../../src/verify/report.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "./helpers.js";

afterEach(cleanupWorkspaces);

interface Scenario {
  levels: string;
  added?: string[];
  tasks?: Record<string, string>;
  // Give the workspace a real (empty) history, so the evidence layer has
  // something to look a commit up in.
  git?: boolean;
}

function task(options: {
  id: string;
  req: string[];
  status: string;
  commits?: string[];
}): string {
  return (
    `---\nid: "${options.id}"\nchange: 2026-07-demo\n` +
    `req: [${options.req.join(", ")}]\nstatus: ${options.status}\n` +
    `evidence:\n  commits: [${(options.commits ?? []).map((c) => `"${c}"`).join(", ")}]\n---\n\nDo it.\n`
  );
}

function run(scenario: Scenario): Promise<VerifyReport> {
  const workspace = makeWorkspace({
    config: `[verify]\nlevels = ["${scenario.levels}"]\n`,
    specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    change: {
      name: "2026-07-demo",
      delta: delta({
        change: "2026-07-demo",
        added: scenario.added ?? [
          deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" }),
        ],
      }),
    },
  });
  for (const [name, content] of Object.entries(scenario.tasks ?? {})) {
    mkdirSync(join(workspace.root, ".specd/changes/2026-07-demo/tasks"), {
      recursive: true,
    });
    writeFileSync(
      join(workspace.root, ".specd/changes/2026-07-demo/tasks", name),
      content,
    );
  }
  if (scenario.git === true) {
    spawnSync("git", ["init", "-q"], { cwd: workspace.root, shell: false });
  }
  return verify({ cwd: workspace.root, globalPath: workspace.globalPath });
}

// REQ-VER-004 — Coverage layer
describe("coverage layer", () => {
  it("rejects a declared requirement no task references", async () => {
    const report = await run({ levels: "coverage" });
    expect(report.ok).toBe(false);
    expect(report.violations[0]?.message).toContain(
      "no task of that change references it",
    );
  });

  it("accepts a requirement a pending task claims", async () => {
    // Coverage asks whether the work is planned, not whether it is finished.
    const report = await run({
      levels: "coverage",
      tasks: {
        "001.md": task({ id: "001", req: ["REQ-DEMO-002"], status: "pending" }),
      },
    });
    expect(report.ok).toBe(true);
  });

  it("ignores prose: only the req field counts", async () => {
    const report = await run({
      levels: "coverage",
      tasks: {
        "001.md":
          `---\nid: "001"\nchange: 2026-07-demo\nreq: [REQ-DEMO-001]\n` +
          `status: pending\nevidence:\n  commits: []\n---\n\nImplements REQ-DEMO-002.\n`,
      },
    });
    expect(report.ok).toBe(false);
  });

  it("does not ask for a task to remove a requirement", async () => {
    const workspace = makeWorkspace({
      config: '[verify]\nlevels = ["coverage"]\n',
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: "2026-07-demo",
        delta: delta({ change: "2026-07-demo", removed: ["REQ-DEMO-001"] }),
      },
    });
    const report = await verify({
      cwd: workspace.root,
      globalPath: workspace.globalPath,
    });
    expect(report.ok).toBe(true);
  });
});

// REQ-VER-005, REQ-VER-010, REQ-VER-011 — the evidence layer
describe("evidence layer", () => {
  it("rejects a done task with no commits", async () => {
    const report = await run({
      levels: "evidence",
      tasks: {
        "001.md": task({ id: "001", req: ["REQ-DEMO-002"], status: "done" }),
      },
    });
    expect(report.ok).toBe(false);
    expect(report.violations[0]?.message).toContain("empty `evidence.commits`");
  });

  it("ignores a task that is not done", async () => {
    const report = await run({
      levels: "evidence",
      tasks: {
        "001.md": task({ id: "001", req: ["REQ-DEMO-002"], status: "blocked" }),
      },
    });
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });

  // REQ-VER-010: a rewritten history degrades the record, it does not falsify
  // it. Squash and rebase both produce this, and failing here would make the
  // gate unusable for anyone who squashes.
  it("warns for a commit the history cannot reach", async () => {
    const report = await run({
      levels: "evidence",
      git: true,
      tasks: {
        "001.md": task({
          id: "001",
          req: ["REQ-DEMO-002"],
          status: "done",
          commits: ["0000000000000000000000000000000000000000"],
        }),
      },
    });
    expect(report.violations.map((v) => v.severity)).toEqual(["warning"]);
    expect(report.ok).toBe(true);
  });

  // REQ-VER-011: "could not check" must never render as "checked and failed".
  it("exits operationally when there is no history at all", async () => {
    // The workspace is a bare temp directory: no .git anywhere above it.
    await expect(
      run({
        levels: "evidence",
        tasks: {
          "001.md": task({
            id: "001",
            req: ["REQ-DEMO-002"],
            status: "done",
            commits: ["abc1234"],
          }),
        },
      }),
    ).rejects.toThrow(OperationalError);
  });
});

// A directory with nothing to check is not a passing check.
describe("empty project", () => {
  it("exits operationally instead of passing vacuously", async () => {
    const workspace = makeWorkspace({ config: "", emptyProject: true });
    const attempt = verify({
      cwd: workspace.root,
      globalPath: workspace.globalPath,
    });
    await expect(attempt).rejects.toThrow(/nothing to verify/);
    await expect(attempt).rejects.toMatchObject({ exitCode: 2 });
  });
});
