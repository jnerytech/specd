import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import { OperationalError } from "../../src/core/operational.js";
import {
  proposeRecord,
  recordPath,
  writeProposeRecord,
} from "../../src/spec/record.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const CHANGE = "2026-07-demo";
const RESOLVING = '- file: src/present.ts\n  symbol: "export function present"';
const DANGLING = '- file: src/gone.ts\n  symbol: "export function gone"';

function task(status: string): string {
  return (
    `---\nid: "001"\nchange: ${CHANGE}\nreq: [REQ-DEMO-002]\n` +
    `status: ${status}\nevidence:\n  commits: []\n---\n\nDo it.\n`
  );
}

function workspace(
  options: { anchors?: string; levels?: string; taskStatus?: string } = {},
) {
  return makeWorkspace({
    config:
      options.levels === undefined
        ? ""
        : `[verify]\nlevels = [${options.levels}]\n`,
    specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    files: {
      "src/present.ts": "export function present(): void {}\n",
      ...(options.taskStatus === undefined
        ? {}
        : {
            [`.specd/changes/${CHANGE}/tasks/001.md`]: task(options.taskStatus),
          }),
    },
    change: {
      name: CHANGE,
      delta: delta({
        change: CHANGE,
        added: [
          deltaRequirement({
            id: "REQ-DEMO-002",
            capability: "demo",
            anchors: options.anchors ?? RESOLVING,
          }),
        ],
      }),
    },
  });
}

// REQ-EFF-005 — the record is computed, not transcribed.
describe("propose record — REQ-EFF-005", () => {
  it("records statement, criteria and anchors of what the change declares", () => {
    const { root } = workspace({ taskStatus: "pending" });

    const record = proposeRecord(CHANGE, { cwd: root });
    const [requirement] = record.requirements;

    expect(requirement?.id).toBe("REQ-DEMO-002");
    expect(requirement?.statement).toContain("SHALL");
    expect(requirement?.acceptance.length).toBeGreaterThan(0);
    expect(requirement?.anchors[0]?.file).toBe("src/present.ts");
  });

  it("leaves out what the change does not declare", () => {
    const { root } = workspace({ taskStatus: "pending" });

    const ids = proposeRecord(CHANGE, { cwd: root }).requirements.map(
      (entry) => entry.id,
    );

    // REQ-DEMO-001 is realized, not proposed by this change.
    expect(ids).toEqual(["REQ-DEMO-002"]);
  });

  it("computes resolution by resolving each declared anchor", () => {
    const resolved = proposeRecord(CHANGE, {
      cwd: workspace({ taskStatus: "pending" }).root,
    });
    const dangling = proposeRecord(CHANGE, {
      cwd: workspace({ anchors: DANGLING, taskStatus: "pending" }).root,
    });

    expect(resolved.requirements[0]?.anchors[0]?.resolved).toBe(true);
    expect(dangling.requirements[0]?.anchors[0]?.resolved).toBe(false);
  });

  it("answers the same with the anchors layer switched off", () => {
    // The failure mode of deriving resolution from a layer's report: with
    // `anchors` disabled the report is empty and everything would read as
    // resolved.
    const { root } = workspace({
      anchors: DANGLING,
      levels: '"schema"',
      taskStatus: "pending",
    });

    expect(
      proposeRecord(CHANGE, { cwd: root }).requirements[0]?.anchors[0]
        ?.resolved,
    ).toBe(false);
  });

  it("refuses a change that is not open, naming the ones that are", () => {
    const { root } = workspace({ taskStatus: "pending" });

    expect(() => proposeRecord("2026-07-absent", { cwd: root })).toThrowError(
      OperationalError,
    );
    expect(() => proposeRecord("2026-07-absent", { cwd: root })).toThrowError(
      new RegExp(CHANGE),
    );
  });

  it("refuses once any task has left `pending`, without writing", () => {
    const { root } = workspace({ taskStatus: "done" });

    expect(() => proposeRecord(CHANGE, { cwd: root })).toThrowError(
      /has already started[\s\S]*001 is done/,
    );
  });

  it("writes while every task is still `pending`", () => {
    const { root } = workspace({ taskStatus: "pending" });

    expect(proposeRecord(CHANGE, { cwd: root }).requirements).toHaveLength(1);
  });

  it("refuses a change that declares requirements and has no task", () => {
    // Absence of a task does not prove the implementation has not started, and
    // reading it as proof leaves the hole reachable by not creating tasks.
    const { root } = workspace();

    expect(() => proposeRecord(CHANGE, { cwd: root })).toThrowError(
      /declares requirements and has no task/,
    );
  });

  it("writes for a change whose delta only removes", () => {
    const { root } = makeWorkspace({
      config: "",
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: CHANGE,
        delta: delta({ change: CHANGE, removed: ["REQ-DEMO-001"] }),
      },
    });

    // Nothing declared, nothing to record, and no task required of it.
    expect(proposeRecord(CHANGE, { cwd: root }).requirements).toEqual([]);
  });

  it("writes the record inside the change directory", () => {
    const { root } = workspace({ taskStatus: "pending" });

    const { path } = writeProposeRecord(CHANGE, { cwd: root });

    expect(path).toBe(recordPath(root, CHANGE));
    const written = JSON.parse(readFileSync(path, "utf8")) as {
      version: number;
      change: string;
    };
    expect(written.version).toBe(1);
    expect(written.change).toBe(CHANGE);
  });

  it("exits 0 through the CLI with a dangling anchor", async () => {
    const { root } = workspace({ anchors: DANGLING, taskStatus: "pending" });
    const out: string[] = [];

    const status = await main(["propose-record", "--change", CHANGE], {
      stdout: (text) => out.push(text),
      stderr: () => undefined,
      cwd: root,
    });

    expect(status).toBe(EXIT.OK);
    expect(out.join("")).toContain("REQ-DEMO-002");
    expect(out.join("")).toContain("dangling");
  });

  it("exits 2 through the CLI when the change is not open", async () => {
    const { root } = workspace({ taskStatus: "pending" });

    const status = await main(
      ["propose-record", "--change", "2026-07-absent"],
      {
        stdout: () => undefined,
        stderr: () => undefined,
        cwd: root,
      },
    );

    expect(status).toBe(EXIT.OPERATIONAL_FAILURE);
  });
});
