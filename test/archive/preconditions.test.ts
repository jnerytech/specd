import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  archive,
  preconditionLayers,
  scopedDiagnostics,
} from "../../src/archive/index.js";
import { DEFAULT_CONFIG } from "../../src/config/schema.js";
import { error } from "../../src/parser/diagnostics.js";
import { readOpenChanges } from "../../src/verify/changes.js";
import { effectiveSpecs } from "../../src/verify/effective.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const RESOLVING = '- file: src/present.ts\n  symbol: "export function present"';
const CHANGE = "2026-07-demo";

interface Setup {
  // Extra files, keyed by path relative to the root.
  files?: Record<string, string>;
  // `proposal.md` of the change; omitted leaves it out entirely.
  proposal?: string | null;
  config?: string;
}

function build(setup: Setup = {}): string {
  const workspace = makeWorkspace({
    config: setup.config ?? "",
    specs: {
      demo: capability({
        name: "demo",
        id: "REQ-DEMO-001",
        anchors: RESOLVING,
      }),
    },
    files: {
      "src/present.ts": "export function present(): void {}\n",
      ...(setup.files ?? {}),
    },
    change: {
      name: CHANGE,
      delta: delta({
        change: CHANGE,
        added: [
          deltaRequirement({
            id: "REQ-DEMO-002",
            capability: "demo",
            anchors: RESOLVING,
          }),
        ],
      }),
      ...(setup.proposal === undefined || setup.proposal === null
        ? {}
        : { proposal: setup.proposal }),
    },
  });

  // `makeWorkspace` always writes a proposal; the tests that need it absent
  // remove it, which is the state a change hand-written before REQ-FMT-011 is in.
  if (setup.proposal === null) {
    rmSync(join(workspace.root, `.specd/changes/${CHANGE}/proposal.md`));
  }

  const tasksDir = join(workspace.root, `.specd/changes/${CHANGE}/tasks`);
  mkdirSync(tasksDir, { recursive: true });
  writeFileSync(
    join(tasksDir, "001.md"),
    `---\nid: "001"\nchange: ${CHANGE}\nreq: [REQ-DEMO-002]\n` +
      `status: pending\nevidence:\n  commits: []\n---\n\nDo it.\n`,
  );
  spawnSync("git", ["init", "-q"], { cwd: workspace.root, shell: false });
  return workspace.root;
}

// REQ-ARC-002 — the preconditions are the offline layers the project declares.
describe("archive preconditions — REQ-ARC-002", () => {
  it("takes its layers from verify.levels, in the fixed order", () => {
    expect(
      preconditionLayers(DEFAULT_CONFIG).map((layer) => layer.name),
    ).toEqual(["provenance", "schema", "coverage", "evidence"]);
  });

  it("never demands the project layer, even when it is configured", () => {
    expect(
      preconditionLayers(DEFAULT_CONFIG).some(
        (layer) => layer.name === "project",
      ),
    ).toBe(false);
  });

  it("demands nothing a project switched off", () => {
    const config = {
      ...DEFAULT_CONFIG,
      verify: { ...DEFAULT_CONFIG.verify, levels: ["coverage" as const] },
    };

    expect(preconditionLayers(config).map((layer) => layer.name)).toEqual([
      "coverage",
    ]);
  });

  it("refuses a change whose proposal is missing, writing nothing", async () => {
    const root = build({ proposal: null });

    await expect(archive(CHANGE, { cwd: root })).rejects.toThrow(
      /schema:[\s\S]*proposal\.md/,
    );
    expect(readOpenChanges(root).map((change) => change.name)).toEqual([
      CHANGE,
    ]);
  });

  it("refuses a change with no explore manifest where a source is required", async () => {
    const root = build({
      config:
        '[[explore.sources]]\nname = "card"\ntype = "board"\nrequired = true\n',
    });

    await expect(archive(CHANGE, { cwd: root })).rejects.toThrow(
      /provenance:[\s\S]*explore manifest/,
    );
  });

  it("names `specd verify` as the place the verdict lives", async () => {
    const root = build({ proposal: null });

    await expect(archive(CHANGE, { cwd: root })).rejects.toThrow(
      /specd verify/,
    );
  });
});

// REQ-ARC-015 — the cut: this change and what it rewrites.
describe("scoped diagnostics — REQ-ARC-015", () => {
  function context(root: string) {
    const changes = readOpenChanges(root);
    const effective = effectiveSpecs(root, {
      pathsRelativeTo: root,
      changes,
    });
    return { change: changes[0]!, effective };
  }

  it("keeps a diagnostic of the change directory", () => {
    const root = build();
    const { change, effective } = context(root);
    const finding = error({
      file: `.specd/changes/${CHANGE}/delta.md`,
      line: 1,
      message: "boom",
    });

    expect(scopedDiagnostics([finding], root, change, effective)).toHaveLength(
      1,
    );
  });

  it("keeps a diagnostic of a capability the delta rewrites", () => {
    const root = build();
    const { change, effective } = context(root);
    const finding = error({
      file: ".specd/specs/demo.md",
      line: 1,
      message: "boom",
    });

    expect(scopedDiagnostics([finding], root, change, effective)).toHaveLength(
      1,
    );
  });

  it("drops a diagnostic of another open change", () => {
    const root = build();
    const { change, effective } = context(root);
    const finding = error({
      file: ".specd/changes/2026-07-other/delta.md",
      line: 1,
      message: "boom",
    });

    expect(scopedDiagnostics([finding], root, change, effective)).toEqual([]);
  });

  it("matches an absolute path against the same root-relative one", () => {
    const root = build();
    const { change, effective } = context(root);
    const finding = error({
      file: join(root, ".specd", "specs", "demo.md"),
      line: 1,
      message: "boom",
    });

    expect(scopedDiagnostics([finding], root, change, effective)).toHaveLength(
      1,
    );
  });

  it("drops a diagnostic of a requirement the resumption already applied", () => {
    const root = build();
    const { change, effective } = context(root);
    const finding = error({
      file: `.specd/changes/${CHANGE}/delta.md`,
      line: 1,
      requirementId: "REQ-DEMO-002",
      message: "ADDED but already exists",
    });

    expect(
      scopedDiagnostics(
        [finding],
        root,
        change,
        effective,
        new Set(["REQ-DEMO-002"]),
      ),
    ).toEqual([]);
  });
});
