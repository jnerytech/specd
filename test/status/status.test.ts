import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import { formatStatus, status } from "../../src/status/index.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
  type WorkspaceSpec,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const DANGLING = capability({
  name: "demo",
  id: "REQ-DEMO-001",
  anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
});

// REQ-DEMO-001 is realized and being modified; REQ-DEMO-002 is new.
const DELTA = delta({
  change: "2026-07-demo",
  modified: [
    deltaRequirement({
      id: "REQ-DEMO-001",
      capability: "demo",
      anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
    }),
  ],
  added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
});

function task(options: {
  id: string;
  req: string[];
  status: string;
  commits?: string[];
}): string {
  return (
    `---\nid: "${options.id}"\nchange: 2026-07-demo\n` +
    `req: [${options.req.join(", ")}]\nstatus: ${options.status}\n` +
    `evidence:\n  commits: [${(options.commits ?? []).join(", ")}]\n---\n\n## Objetivo\n\nDo the thing.\n`
  );
}

function build(spec: Partial<WorkspaceSpec> = {}): string {
  return makeWorkspace({
    config: "",
    specs: { demo: DANGLING },
    change: { name: "2026-07-demo", delta: DELTA },
    ...spec,
  }).root;
}

// REQ-CFG-006 — Status reports drift and pending work
describe("status", () => {
  it("groups its output by change", async () => {
    const report = await status({ cwd: build() });
    expect(report.changes.map((c) => c.change)).toEqual(["2026-07-demo"]);
  });

  it("reports dangling anchors under the change that claims the requirement", async () => {
    const report = await status({ cwd: build() });
    const change = report.changes[0];

    expect(change?.danglingAnchors).toEqual([
      {
        requirementId: "REQ-DEMO-001",
        capability: "demo",
        file: "src/gone.ts",
        symbol: "export function gone",
        origin: "delta",
      },
    ]);
    expect(report.unclaimedDanglingAnchors).toEqual([]);
  });

  it("reports a dangling anchor no change claims separately", async () => {
    const report = await status({
      cwd: build({
        change: {
          name: "2026-07-demo",
          delta: delta({
            change: "2026-07-demo",
            added: [
              deltaRequirement({ id: "REQ-OTHER-001", capability: "demo" }),
            ],
          }),
        },
      }),
    });
    expect(report.changes[0]?.danglingAnchors).toEqual([]);
    expect(report.unclaimedDanglingAnchors.map((a) => a.requirementId)).toEqual(
      ["REQ-DEMO-001"],
    );
  });

  it("reports requirements the change declares with no task", async () => {
    const root = build({
      files: {
        ".specd/changes/2026-07-demo/tasks/001.md": task({
          id: "001",
          req: ["REQ-DEMO-001"],
          status: "done",
          commits: ["abc123"],
        }),
      },
    });
    const change = (await status({ cwd: root })).changes[0];

    expect(change?.requirementsWithoutTasks).toEqual(["REQ-DEMO-002"]);
    expect(change?.tasks).toEqual({ total: 1, done: 1 });
  });

  it("reports a task marked done with no evidence", async () => {
    const root = build({
      files: {
        ".specd/changes/2026-07-demo/tasks/001.md": task({
          id: "001",
          req: ["REQ-DEMO-001"],
          status: "done",
        }),
        ".specd/changes/2026-07-demo/tasks/002.md": task({
          id: "002",
          req: ["REQ-DEMO-002"],
          status: "in_progress",
        }),
      },
    });
    const change = (await status({ cwd: root })).changes[0];

    expect(change?.doneTasksWithoutEvidence).toEqual(["001"]);
  });

  it("reports memory files past their configured limit", async () => {
    const root = build({
      config: "[memory]\nchange_limit_lines = 3\ntask_limit_lines = 2\n",
      files: {
        ".specd/changes/2026-07-demo/memory/change.md": "a\nb\nc\nd\ne\n",
        ".specd/changes/2026-07-demo/memory/001.md": "a\n",
      },
    });
    const change = (await status({ cwd: root })).changes[0];

    expect(change?.oversizedMemory).toEqual([
      {
        file: ".specd/changes/2026-07-demo/memory/change.md",
        lines: 6,
        limit: 3,
      },
    ]);
  });

  it("reports nothing oversized when memory is disabled", async () => {
    const root = build({
      config: "[memory]\nenabled = false\nchange_limit_lines = 1\n",
      files: { ".specd/changes/2026-07-demo/memory/change.md": "a\nb\nc\n" },
    });
    expect((await status({ cwd: root })).changes[0]?.oversizedMemory).toEqual(
      [],
    );
  });

  it("counts capabilities, requirements and dangling anchors", async () => {
    const report = await status({ cwd: build() });
    expect(report.totals).toEqual({
      capabilities: 1,
      // The effective spec: the realized REQ-DEMO-001, shadowed by the delta
      // that modifies it, plus the REQ-DEMO-002 the same delta adds.
      requirements: 2,
      danglingAnchors: 1,
    });
  });

  it("renders a grouped human report", async () => {
    const rendered = formatStatus(await status({ cwd: build() }));
    expect(rendered).toContain("2026-07-demo — 0/0 tasks done");
    expect(rendered).toContain("dangling anchors (in flight):");
    expect(rendered).toContain(
      "REQ-DEMO-001 -> src/gone.ts :: export function gone",
    );
  });
});

// REQ-CFG-006 acceptance: the command always returns 0. It informs, it does
// not judge.
describe("specd status exit code", () => {
  async function run(root: string): Promise<number> {
    return main(["status"], {
      stdout: () => undefined,
      stderr: () => undefined,
      cwd: root,
    });
  }

  it("exits 0 even with dangling anchors and missing evidence", async () => {
    const root = build({
      files: {
        ".specd/changes/2026-07-demo/tasks/001.md": task({
          id: "001",
          req: ["REQ-DEMO-001"],
          status: "done",
        }),
      },
    });
    expect(await run(root)).toBe(EXIT.OK);
  });

  it("exits 0 in a repository with no changes at all", async () => {
    const root = makeWorkspace({ config: "", specs: { demo: DANGLING } }).root;
    expect(await run(root)).toBe(EXIT.OK);
  });
});
