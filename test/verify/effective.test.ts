import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { effectiveSpecs } from "../../src/verify/effective.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "./helpers.js";

afterEach(cleanupWorkspaces);

function build(deltas: Record<string, string>, specs?: Record<string, string>) {
  const root = makeWorkspace({
    config: "",
    specs: specs ?? {
      demo: capability({ name: "demo", id: "REQ-DEMO-001" }),
    },
  }).root;
  for (const [name, content] of Object.entries(deltas)) {
    makeWorkspaceDelta(root, name, content);
  }
  return effectiveSpecs(root, { pathsRelativeTo: root });
}

function makeWorkspaceDelta(root: string, name: string, content: string): void {
  mkdirSync(join(root, ".specd", "changes", name), { recursive: true });
  writeFileSync(join(root, ".specd", "changes", name, "delta.md"), content);
}

function idsWithOrigin(
  result: ReturnType<typeof effectiveSpecs>,
): Record<string, string> {
  return Object.fromEntries(
    result.requirements.map((entry) => [entry.requirement.id, entry.origin]),
  );
}

// The overlay: specs ⊕ ADDED ⊕ MODIFIED ⊖ REMOVED.
describe("effective specs", () => {
  it("carries the origin of every requirement", () => {
    const result = build({
      "2026-07-a": delta({
        change: "2026-07-a",
        added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
      }),
    });
    expect(idsWithOrigin(result)).toEqual({
      "REQ-DEMO-001": "specs",
      "REQ-DEMO-002": "delta",
    });
  });

  it("lets a MODIFIED block shadow the realized copy", () => {
    const result = build({
      "2026-07-a": delta({
        change: "2026-07-a",
        modified: [
          deltaRequirement({ id: "REQ-DEMO-001", capability: "demo" }),
        ],
      }),
    });
    const entry = result.requirements.find(
      (r) => r.requirement.id === "REQ-DEMO-001",
    );
    expect(entry?.origin).toBe("delta");
    expect(entry?.change).toBe("2026-07-a");
    expect(result.requirements).toHaveLength(1);
  });

  it("drops a REMOVED requirement from the effective spec", () => {
    const result = build({
      "2026-07-a": delta({ change: "2026-07-a", removed: ["REQ-DEMO-001"] }),
    });
    expect(result.requirements).toEqual([]);
  });

  it("rejects ADDED for a requirement that already exists", () => {
    const result = build({
      "2026-07-a": delta({
        change: "2026-07-a",
        added: [deltaRequirement({ id: "REQ-DEMO-001", capability: "demo" })],
      }),
    });
    expect(result.diagnostics.map((d) => d.message).join(" ")).toContain(
      "put it under MODIFIED",
    );
  });

  it("rejects MODIFIED for a requirement that exists nowhere", () => {
    const result = build({
      "2026-07-a": delta({
        change: "2026-07-a",
        modified: [
          deltaRequirement({ id: "REQ-DEMO-009", capability: "demo" }),
        ],
      }),
    });
    expect(result.diagnostics.map((d) => d.message).join(" ")).toContain(
      "exists nowhere",
    );
  });

  // no-guessing-on-conflict: two changes editing the same requirement is a conflict, and specd
  // reports it rather than letting whichever parsed last win.
  it("rejects two open changes claiming the same requirement", () => {
    const result = build({
      "2026-07-a": delta({
        change: "2026-07-a",
        modified: [
          deltaRequirement({ id: "REQ-DEMO-001", capability: "demo" }),
        ],
      }),
      "2026-07-b": delta({
        change: "2026-07-b",
        modified: [
          deltaRequirement({ id: "REQ-DEMO-001", capability: "demo" }),
        ],
      }),
    });
    expect(result.diagnostics.map((d) => d.message).join(" ")).toContain(
      "claimed by both 2026-07-a and 2026-07-b",
    );
  });

  it("reads every open change, in name order, and never the archive", () => {
    const result = build({
      "2026-07-b": delta({ change: "2026-07-b" }),
      "2026-07-a": delta({ change: "2026-07-a" }),
      "archive/2026-07-old": delta({ change: "2026-07-old" }),
    });
    expect(result.changes.map((c) => c.name)).toEqual([
      "2026-07-a",
      "2026-07-b",
    ]);
  });
});
