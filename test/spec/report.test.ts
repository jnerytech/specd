import { afterEach, describe, expect, it } from "vitest";
import { formatSpec, specReport } from "../../src/spec/index.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

// REQ-EFF-001 — the overlay is applied by the CLI, not rebuilt by the caller.
describe("spec — REQ-EFF-001", () => {
  it("emits a realized requirement once", () => {
    const { root } = makeWorkspace({
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    });

    const report = specReport({ cwd: root });

    expect(report.requirements.map((record) => record.id)).toEqual([
      "REQ-DEMO-001",
    ]);
  });

  it("emits a requirement an open change adds", () => {
    const { root } = makeWorkspace({
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: "2026-07-demo",
        delta: delta({
          change: "2026-07-demo",
          added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
        }),
      },
    });

    const report = specReport({ cwd: root });

    expect(report.requirements.map((record) => record.id)).toEqual([
      "REQ-DEMO-001",
      "REQ-DEMO-002",
    ]);
  });

  it("takes the text of a MODIFIED requirement from the delta", () => {
    const { root } = makeWorkspace({
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          statement: "The specd verifier SHALL do the realized thing.",
        }),
      },
      change: {
        name: "2026-07-demo",
        delta: delta({
          change: "2026-07-demo",
          modified: [
            deltaRequirement({ id: "REQ-DEMO-001", capability: "demo" }),
          ],
        }),
      },
    });

    const [record] = specReport({ cwd: root }).requirements;

    expect(record?.statement).toBe("The specd verifier SHALL do the thing.");
    expect(record?.source).toBe(".specd/changes/2026-07-demo/delta.md");
  });

  it("leaves a REMOVED identifier out", () => {
    const { root } = makeWorkspace({
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: "2026-07-demo",
        delta: delta({ change: "2026-07-demo", removed: ["REQ-DEMO-001"] }),
      },
    });

    expect(specReport({ cwd: root }).requirements).toEqual([]);
  });

  it("refuses outside a specd project, naming what it looked for", () => {
    const { root } = makeWorkspace({});

    expect(() => specReport({ cwd: `${root}/../` })).toThrowError(/\.specd\//);
  });
});

// REQ-EFF-002 — origin and source travel with every requirement.
describe("spec — REQ-EFF-002", () => {
  it("reports the origin of each requirement and the change that claims it", () => {
    const { root } = makeWorkspace({
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: "2026-07-demo",
        delta: delta({
          change: "2026-07-demo",
          added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
        }),
      },
    });

    const [realized, inFlight] = specReport({ cwd: root }).requirements;

    expect(realized?.origin).toBe("specs");
    expect(realized?.change).toBeUndefined();
    expect(realized?.source).toBe(".specd/specs/demo.md");

    expect(inFlight?.origin).toBe("delta");
    expect(inFlight?.change).toBe("2026-07-demo");
    expect(inFlight?.source).toBe(".specd/changes/2026-07-demo/delta.md");
  });

  it("carries in the text rendering everything the record holds", () => {
    const { root } = makeWorkspace({
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          anchors: '- file: src/demo.ts\n  symbol: "export function demo"',
        }),
      },
    });

    const report = specReport({ cwd: root });
    const text = formatSpec(report);
    const [record] = report.requirements;

    expect(text).toContain("REQ-DEMO-001");
    expect(text).toContain(record?.capability as string);
    expect(text).toContain(record?.statement as string);
    expect(text).toContain(record?.acceptance[0] as string);
    expect(text).toContain("specs");
    expect(text).toContain(".specd/specs/demo.md");
    expect(text).toContain("src/demo.ts :: export function demo");
  });
});
