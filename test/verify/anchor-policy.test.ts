import { afterEach, describe, expect, it } from "vitest";
import { verify } from "../../src/verify/index.js";
import type { VerifyReport } from "../../src/verify/report.js";
import { capability, cleanupWorkspaces, makeWorkspace } from "./helpers.js";

afterEach(cleanupWorkspaces);

const DANGLING = capability({
  name: "demo",
  id: "REQ-DEMO-001",
  anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
});

const DELTA_WITH = "## ADDED\n\n- REQ-DEMO-001 — Example\n";
const DELTA_WITHOUT = "## ADDED\n\n- REQ-OTHER-001 — Something else\n";

function run(policy: string, delta?: string): Promise<VerifyReport> {
  const workspace = makeWorkspace({
    config: `[verify]\nlevels = ["anchors"]\n\n[verify.anchors]\npolicy = "${policy}"\n`,
    specs: { demo: DANGLING },
    ...(delta === undefined ? {} : { change: { name: "2026-07-demo", delta } }),
  });
  return verify({ cwd: workspace.root, globalPath: workspace.globalPath });
}

// REQ-ANC-006 — Graduated policy
describe("graduated policy", () => {
  it("warns when the requirement is in the active change delta", async () => {
    const report = await run("graduated", DELTA_WITH);
    expect(report.violations.map((v) => v.severity)).toEqual(["warning"]);
    expect(report.ok).toBe(true);
  });

  it("errors when the requirement is absent from the delta", async () => {
    const report = await run("graduated", DELTA_WITHOUT);
    expect(report.violations.map((v) => v.severity)).toEqual(["error"]);
    expect(report.ok).toBe(false);
  });

  it("errors for every dangling anchor when there is no active change", async () => {
    const report = await run("graduated");
    expect(report.violations.map((v) => v.severity)).toEqual(["error"]);
    expect(report.ok).toBe(false);
  });
});

describe("strict and lenient policies", () => {
  it("strict errors even for a requirement under way", async () => {
    const report = await run("strict", DELTA_WITH);
    expect(report.violations.map((v) => v.severity)).toEqual(["error"]);
  });

  it("lenient warns even without an active change", async () => {
    const report = await run("lenient");
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
    expect(message).toContain("specd does not rewrite it for you");
  });
});
