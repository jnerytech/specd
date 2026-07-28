import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listChanges, readActiveChange } from "../src/verify/active-change.js";
import { verify } from "../src/verify/index.js";
import type { VerifyReport } from "../src/verify/report.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SPECS_DIR = join(REPO_ROOT, ".specd", "specs");
const CHANGES_DIR = join(REPO_ROOT, ".specd", "changes");

// `fast` skips the project layer, whose validation_command is `npm run verify`
// — the very command running this test.
async function run(): Promise<VerifyReport> {
  return verify({ cwd: REPO_ROOT, fast: true });
}

function requirementIds(text: string): string[] {
  return [...text.matchAll(/^### (REQ-[A-Z][A-Z0-9]*-\d{3})/gm)].map(
    (m) => m[1] as string,
  );
}

function specsIds(): string[] {
  return readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) => requirementIds(readFileSync(join(SPECS_DIR, f), "utf8")));
}

// Identifiers a change delta introduces, by section. ADDED means the
// requirement exists nowhere else; MODIFIED means it also lives in a
// capability and the delta replaces it.
function deltaIds(section: "ADDED" | "MODIFIED"): string[] {
  const ids: string[] = [];
  for (const name of readdirSync(CHANGES_DIR)) {
    if (name === "archive") continue;
    let text: string;
    try {
      text = readFileSync(join(CHANGES_DIR, name, "delta.md"), "utf8");
    } catch {
      continue;
    }
    const body = text.split(/^## /m).find((s) => s.startsWith(section));
    if (body !== undefined) ids.push(...requirementIds(`## ${body}`));
  }
  return ids;
}

describe("specd verifies this repository", () => {
  it("runs the layers this repository configures", async () => {
    const report = await run();
    expect(report.layers.map((l) => l.layer)).toEqual([
      "schema",
      "anchors",
      "project",
    ]);
    expect(report.disabled).toEqual(["provenance", "coverage", "evidence"]);
  });

  // Deliberately no count: requirements get added, and a number in the name
  // goes stale without failing anything.
  it("passes the schema layer: every statement parses", async () => {
    const report = await run();
    const schema = report.layers.find((l) => l.layer === "schema");
    expect(schema?.violations).toEqual([]);
    expect(schema?.status).toBe("passed");
  });

  // The Modelo B invariant, and the reason this file exists.
  //
  // `.specd/specs/` holds realized truth only, so every anchor in it must
  // resolve. A requirement whose code is not written yet lives in the delta of
  // an open change until `specd archive` moves it here. Anything dangling in
  // `specs/` is drift, never pending work — which is what makes a red gate
  // worth believing.
  it("holds no dangling anchor in .specd/specs/", async () => {
    const report = await run();
    expect(report.violations).toEqual([]);
    expect(report.stoppedAt).toBeUndefined();
    expect(report.ok).toBe(true);
  });

  it("never lets a requirement live in two places at once", () => {
    const inSpecs = new Set(specsIds());
    // ADDED means "does not exist yet". An identifier in both places is the
    // illegal state this migration corrected; it must not come back.
    for (const id of deltaIds("ADDED")) {
      expect(
        inSpecs.has(id),
        `${id} is ADDED by a delta and also in specs/`,
      ).toBe(false);
    }
    // MODIFIED is the opposite: replacing a section that must already exist.
    for (const id of deltaIds("MODIFIED")) {
      expect(
        inSpecs.has(id),
        `${id} is MODIFIED by a delta but not in specs/`,
      ).toBe(true);
    }
  });

  it("keeps every open change readable", () => {
    const changes = listChanges(REPO_ROOT);
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      expect(change.name).not.toBe("archive");
    }

    // Documents a known defect rather than asserting correct behaviour:
    // `readActiveChange` returns the alphabetically first directory, so with
    // several open changes it names the oldest. Fatia 2 replaces it with
    // `readOpenChanges`; when it does, this expectation is what says so.
    expect(readActiveChange(REPO_ROOT)?.name).toBe(changes[0]?.name);
  });
});
