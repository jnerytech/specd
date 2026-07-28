import { afterEach, describe, expect, it } from "vitest";
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

const DANGLING_ANCHOR = '- file: src/gone.ts\n  symbol: "export function gone"';

// Realized: the requirement lives in `.specd/specs/`, which asserts the code
// exists. Its anchor no longer resolving is drift.
const IN_SPECS = capability({
  name: "demo",
  id: "REQ-DEMO-001",
  anchors: DANGLING_ANCHOR,
});

// In flight: the requirement lives only in an open change's delta, so the code
// is not written yet and the same anchor is pending work.
const IN_DELTA = delta({
  change: "2026-07-demo",
  added: [
    deltaRequirement({
      id: "REQ-DEMO-002",
      capability: "demo",
      anchors: DANGLING_ANCHOR,
    }),
  ],
});

function run(options: {
  policy: string;
  specs?: Record<string, string>;
  delta?: string;
}): Promise<VerifyReport> {
  const workspace = makeWorkspace({
    config: `[verify]\nlevels = ["anchors"]\n\n[verify.anchors]\npolicy = "${options.policy}"\n`,
    specs: options.specs ?? { demo: IN_SPECS },
    ...(options.delta === undefined
      ? {}
      : { change: { name: "2026-07-demo", delta: options.delta } }),
  });
  return verify({ cwd: workspace.root, globalPath: workspace.globalPath });
}

// REQ-ANC-006 — Graduated policy.
//
// Severity comes from where the requirement is written, not from whether some
// change happens to name its identifier. That difference is the whole point:
// listing an identifier in a delta used to be enough to silence a real
// regression, and a delta nobody closed silenced every identifier it named.
describe("graduated policy", () => {
  it("warns for a requirement written in an open change delta", async () => {
    const report = await run({
      policy: "graduated",
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      delta: IN_DELTA,
    });
    expect(report.violations.map((v) => v.severity)).toEqual(["warning"]);
    expect(report.ok).toBe(true);
  });

  it("errors for a requirement written in .specd/specs/", async () => {
    const report = await run({ policy: "graduated" });
    expect(report.violations.map((v) => v.severity)).toEqual(["error"]);
    expect(report.ok).toBe(false);
  });

  it("still errors for a realized requirement an open change names", async () => {
    // The Modelo A escape hatch, closed: a change may not silence drift in
    // `.specd/specs/` by mentioning the identifier. To change a realized
    // requirement it must carry the text, under MODIFIED.
    const report = await run({
      policy: "graduated",
      delta: delta({
        change: "2026-07-demo",
        added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
      }),
    });
    expect(report.violations.map((v) => v.severity)).toEqual(["error"]);
  });

  it("shadows the realized copy when a change modifies it", async () => {
    // The requirement exists in both places while the change is open. Only the
    // delta text is checked, so moving the symbol does not hold the gate red
    // for the change's whole duration.
    const report = await run({
      policy: "graduated",
      delta: delta({
        change: "2026-07-demo",
        modified: [
          deltaRequirement({
            id: "REQ-DEMO-001",
            capability: "demo",
            anchors: DANGLING_ANCHOR,
          }),
        ],
      }),
    });
    expect(report.violations.map((v) => v.severity)).toEqual(["warning"]);
    expect(report.ok).toBe(true);
  });
});

describe("strict and lenient policies", () => {
  it("strict errors even for work in flight", async () => {
    const report = await run({
      policy: "strict",
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      delta: IN_DELTA,
    });
    expect(report.violations.map((v) => v.severity)).toEqual(["error"]);
  });

  it("lenient warns even for a realized requirement", async () => {
    const report = await run({ policy: "lenient" });
    expect(report.violations.map((v) => v.severity)).toEqual(["warning"]);
    expect(report.ok).toBe(true);
  });
});

// REQ-CLI-003 — never guess: a suggestion is reported, never applied.
describe("suggestions", () => {
  it("names the location found without rewriting the anchor", async () => {
    const workspace = makeWorkspace({
      config:
        '[verify]\nlevels = ["anchors"]\n\n[verify.anchors]\npolicy = "strict"\n',
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          anchors: '- file: src/old.ts\n  symbol: "export function moved"',
        }),
      },
      files: {
        "src/old.ts": "// the function used to live here\n",
        "src/new.ts": "export function moved(): void {}\n",
      },
    });
    const report = await verify({
      cwd: workspace.root,
      globalPath: workspace.globalPath,
    });
    const message = report.violations[0]?.message ?? "";
    expect(message).toContain("src/new.ts:1");
    expect(message).toContain("specd does not decide for you");
  });
});
