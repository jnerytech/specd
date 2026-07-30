import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { archive } from "../../src/archive/index.js";
import { OperationalError } from "../../src/core/operational.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const RESOLVING = '- file: src/present.ts\n  symbol: "export function present"';

function task(req: string[]): string {
  return (
    `---\nid: "001"\nchange: 2026-07-demo\nreq: [${req.join(", ")}]\n` +
    `status: pending\nevidence:\n  commits: []\n---\n\nDo it.\n`
  );
}

interface Setup {
  added?: string[];
  modified?: string[];
  removed?: string[];
  taskReq?: string[];
  specs?: Record<string, string>;
}

function build(setup: Setup): string {
  const workspace = makeWorkspace({
    config: "",
    specs: setup.specs ?? {
      demo: capability({
        name: "demo",
        id: "REQ-DEMO-001",
        anchors: RESOLVING,
      }),
    },
    files: { "src/present.ts": "export function present(): void {}\n" },
    change: {
      name: "2026-07-demo",
      delta: delta({
        change: "2026-07-demo",
        ...(setup.added === undefined ? {} : { added: setup.added }),
        ...(setup.modified === undefined ? {} : { modified: setup.modified }),
        ...(setup.removed === undefined ? {} : { removed: setup.removed }),
      }),
    },
  });
  const tasksDir = join(workspace.root, ".specd/changes/2026-07-demo/tasks");
  mkdirSync(tasksDir, { recursive: true });
  // A task with an empty `req` is malformed by REQ-FMT-007, and a change whose
  // delta only removes needs no task at all. Writing one anyway made the
  // fixture describe a state the schema layer rejects — invisible until
  // REQ-ARC-002 started reading that layer.
  if (setup.taskReq !== undefined && setup.taskReq.length > 0) {
    writeFileSync(join(tasksDir, "001.md"), task(setup.taskReq));
  }
  spawnSync("git", ["init", "-q"], { cwd: workspace.root, shell: false });
  return workspace.root;
}

function specsFile(root: string, name: string): string {
  return readFileSync(join(root, ".specd", "specs", `${name}.md`), "utf8");
}

// REQ-ARC-001 — Change is named explicitly
describe("archive names its target", () => {
  it("refuses without an argument and lists the open changes", async () => {
    const root = build({});
    await expect(archive(undefined, { cwd: root })).rejects.toThrow(
      /needs the name of the change[\s\S]*2026-07-demo/,
    );
  });

  it("refuses a name that is not an open change", async () => {
    const root = build({});
    await expect(archive("2026-07-other", { cwd: root })).rejects.toThrow(
      /No open change named "2026-07-other"/,
    );
  });
});

// REQ-ARC-003, REQ-ARC-004, REQ-ARC-005 — application by section
describe("archive applies the delta", () => {
  it("inserts an ADDED requirement, without its Capability field", async () => {
    const root = build({
      added: [
        deltaRequirement({
          id: "REQ-DEMO-002",
          capability: "demo",
          anchors: RESOLVING,
        }),
      ],
      taskReq: ["REQ-DEMO-002"],
    });
    await archive("2026-07-demo", { cwd: root });

    const written = specsFile(root, "demo");
    expect(written).toContain("### REQ-DEMO-002 — Example");
    expect(written).not.toContain("**Capability.**");
  });

  it("creates the capability file when it does not exist yet", async () => {
    const root = build({
      added: [
        deltaRequirement({
          id: "REQ-NEW-001",
          capability: "brandnew",
          anchors: RESOLVING,
        }),
      ],
      taskReq: ["REQ-NEW-001"],
    });
    await archive("2026-07-demo", { cwd: root });

    expect(specsFile(root, "brandnew")).toContain("capability: brandnew");
    expect(specsFile(root, "brandnew")).toContain("### REQ-NEW-001");
  });

  it("replaces the whole section on MODIFIED", async () => {
    const root = build({
      modified: [
        deltaRequirement({
          id: "REQ-DEMO-001",
          capability: "demo",
          anchors: RESOLVING,
        }),
      ],
      taskReq: ["REQ-DEMO-001"],
    });
    await archive("2026-07-demo", { cwd: root });

    const written = specsFile(root, "demo");
    expect(written.match(/### REQ-DEMO-001/g)).toHaveLength(1);
  });

  it("deletes the section and retires the identifier on REMOVED", async () => {
    const root = build({ removed: ["REQ-DEMO-001"] });
    await archive("2026-07-demo", { cwd: root });

    const written = specsFile(root, "demo");
    expect(written).not.toContain("### REQ-DEMO-001");
    expect(written).toContain("retired: [REQ-DEMO-001]");
  });
});

// REQ-ARC-006 — destination
describe("archive destination", () => {
  it("preserves the change name and adds no date prefix", async () => {
    const root = build({ removed: ["REQ-DEMO-001"] });
    const result = await archive("2026-07-demo", { cwd: root });

    expect(result.destination).toBe(".specd/changes/archive/2026-07-demo");
    expect(
      existsSync(join(root, ".specd/changes/archive/2026-07-demo/delta.md")),
    ).toBe(true);
    expect(existsSync(join(root, ".specd/changes/2026-07-demo"))).toBe(false);
  });

  it("refuses when the destination is taken, without moving anything", async () => {
    const root = build({ removed: ["REQ-DEMO-001"] });
    mkdirSync(join(root, ".specd/changes/archive/2026-07-demo"), {
      recursive: true,
    });
    await expect(archive("2026-07-demo", { cwd: root })).rejects.toThrow(
      /already exists/,
    );
    expect(existsSync(join(root, ".specd/changes/2026-07-demo"))).toBe(true);
  });
});

// REQ-ARC-002 and REQ-ANC-007 — preconditions
describe("archive preconditions", () => {
  it("refuses on a dangling anchor whatever the policy, and writes nothing", async () => {
    const workspace = makeWorkspace({
      // `lenient` would turn the dangling anchor into a warning for verify.
      config: '[verify.anchors]\npolicy = "lenient"\n',
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: "2026-07-demo",
        delta: delta({
          change: "2026-07-demo",
          added: [
            deltaRequirement({
              id: "REQ-DEMO-002",
              capability: "demo",
              anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
            }),
          ],
        }),
      },
    });
    const tasksDir = join(workspace.root, ".specd/changes/2026-07-demo/tasks");
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, "001.md"), task(["REQ-DEMO-002"]));

    const before = specsFile(workspace.root, "demo");
    await expect(
      archive("2026-07-demo", { cwd: workspace.root }),
    ).rejects.toThrow(/anchor does not resolve/);
    expect(specsFile(workspace.root, "demo")).toBe(before);
    expect(
      existsSync(join(workspace.root, ".specd/changes/2026-07-demo")),
    ).toBe(true);
  });

  it("refuses on an uncovered requirement and names specd verify", async () => {
    const root = build({
      added: [
        deltaRequirement({
          id: "REQ-DEMO-002",
          capability: "demo",
          anchors: RESOLVING,
        }),
      ],
      taskReq: [],
    });
    await expect(archive("2026-07-demo", { cwd: root })).rejects.toThrow(
      /specd verify/,
    );
  });

  // REQ-CLI-001: refusing to act is exit 2. Only `verify` returns a verdict.
  it("refuses with exit code 2, never 1", async () => {
    const root = build({
      added: [
        deltaRequirement({
          id: "REQ-DEMO-002",
          capability: "demo",
          anchors: RESOLVING,
        }),
      ],
      taskReq: [],
    });
    await expect(archive("2026-07-demo", { cwd: root })).rejects.toMatchObject({
      exitCode: 2,
    });
    await expect(archive("2026-07-demo", { cwd: root })).rejects.toBeInstanceOf(
      OperationalError,
    );
  });
});

// REQ-ARC-007 — nothing is staged or committed
describe("archive leaves the work unstaged", () => {
  it("creates no commit and stages nothing", async () => {
    const root = build({ removed: ["REQ-DEMO-001"] });
    await archive("2026-07-demo", { cwd: root });

    const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
      cwd: root,
      shell: false,
      encoding: "utf8",
    });
    expect(staged.stdout.trim()).toBe("");
    const log = spawnSync("git", ["log", "--oneline"], {
      cwd: root,
      shell: false,
      encoding: "utf8",
    });
    expect(log.status).not.toBe(0);
  });
});

// REQ-ARC-010 — reapplication is idempotent by content
describe("archive is resumable", () => {
  it("treats an identical ADDED requirement as already applied", async () => {
    const root = build({
      added: [
        deltaRequirement({
          id: "REQ-DEMO-002",
          capability: "demo",
          anchors: RESOLVING,
        }),
      ],
      taskReq: ["REQ-DEMO-002"],
    });
    await archive("2026-07-demo", { cwd: root });

    // Simulate a crash between writing the capability and moving the
    // directory: the change comes back, the capability keeps the section.
    renameSync(
      join(root, ".specd/changes/archive/2026-07-demo"),
      join(root, ".specd/changes/2026-07-demo"),
    );
    const result = await archive("2026-07-demo", { cwd: root });

    expect(result.alreadyApplied).toEqual(["REQ-DEMO-002"]);
    expect(specsFile(root, "demo").match(/### REQ-DEMO-002/g)).toHaveLength(1);
  });
});
