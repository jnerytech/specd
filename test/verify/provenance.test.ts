import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verify } from "../../src/verify/index.js";
import type { VerifyReport } from "../../src/verify/report.js";
import { requiresProvenance } from "../../src/verify/layers/provenance.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  makeWorkspace,
} from "./helpers.js";

afterEach(cleanupWorkspaces);

const REQUIRED_SOURCE =
  '[[explore.sources]]\nname = "card"\ntype = "board"\nrequired = true\n';
const OPTIONAL_SOURCE =
  '[[explore.sources]]\nname = "notes"\ntype = "http"\nurl = "https://example.invalid"\n';

function run(options: {
  sources: string;
  manifest?: unknown;
}): Promise<VerifyReport> {
  const workspace = makeWorkspace({
    config: `[verify]\nlevels = ["provenance"]\n\n${options.sources}`,
    specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    change: { name: "2026-07-demo", delta: delta({ change: "2026-07-demo" }) },
  });
  if (options.manifest !== undefined) {
    const dir = join(workspace.root, ".specd/changes/2026-07-demo/explore");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify(options.manifest, null, 2),
    );
  }
  return verify({ cwd: workspace.root, globalPath: workspace.globalPath });
}

function manifest(sources: unknown[]): unknown {
  return {
    version: 1,
    change: "2026-07-demo",
    card: { id: "CARD-1" },
    collectedAt: "2026-07-28T00:00:00.000Z",
    usable: true,
    sources,
  };
}

// REQ-VER-003 — Provenance layer
describe("provenance layer", () => {
  // The guard condition, and the reason the layer stayed switched off for two
  // slices: as first written it demanded a bundle from every change, which
  // rejects any change that did not start from a board card.
  it("asks for nothing when no source is declared required", async () => {
    const report = await run({ sources: OPTIONAL_SOURCE });
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it("asks for nothing when the project declares no source at all", async () => {
    const report = await run({ sources: "" });
    expect(report.ok).toBe(true);
  });

  it("rejects a change with no manifest once a source is required", async () => {
    const report = await run({ sources: REQUIRED_SOURCE });
    expect(report.ok).toBe(false);
    expect(report.violations[0]?.message).toContain("no explore manifest");
  });

  it("rejects a required source that did not collect, naming it", async () => {
    const report = await run({
      sources: REQUIRED_SOURCE,
      manifest: manifest([
        {
          name: "card",
          type: "board",
          required: true,
          status: "failed",
          error: "connection refused",
        },
      ]),
    });
    expect(report.ok).toBe(false);
    expect(report.violations[0]?.message).toContain('"card"');
    expect(report.violations[0]?.message).toContain("connection refused");
  });

  it("does not reject a failed optional source", async () => {
    const report = await run({
      sources: REQUIRED_SOURCE,
      manifest: manifest([
        { name: "card", type: "board", required: true, status: "ok" },
        { name: "notes", type: "http", required: false, status: "failed" },
      ]),
    });
    expect(report.ok).toBe(true);
  });

  it("rejects a manifest that is not readable JSON", async () => {
    const workspace = makeWorkspace({
      config: `[verify]\nlevels = ["provenance"]\n\n${REQUIRED_SOURCE}`,
      specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
      change: {
        name: "2026-07-demo",
        delta: delta({ change: "2026-07-demo" }),
      },
    });
    const dir = join(workspace.root, ".specd/changes/2026-07-demo/explore");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), "{ truncated");

    const report = await verify({
      cwd: workspace.root,
      globalPath: workspace.globalPath,
    });
    expect(report.ok).toBe(false);
    expect(report.violations[0]?.message).toContain("not readable JSON");
  });
});

describe("requiresProvenance", () => {
  it("is the condition that decides whether the layer checks anything", () => {
    const config = (sources: { required?: boolean }[]) =>
      ({ explore: { sources } }) as never;
    expect(requiresProvenance(config([]))).toBe(false);
    expect(requiresProvenance(config([{}]))).toBe(false);
    expect(requiresProvenance(config([{ required: false }]))).toBe(false);
    expect(requiresProvenance(config([{ required: true }]))).toBe(true);
  });
});
