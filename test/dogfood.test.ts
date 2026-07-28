import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readActiveChange } from "../src/verify/active-change.js";
import { verify } from "../src/verify/index.js";
import type { VerifyReport } from "../src/verify/report.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

// Fatia 1's success criterion: specd verifies itself.
//
// `fast` skips the project layer, whose validation_command is `npm run verify`
// — the very command running this test.
async function run(): Promise<VerifyReport> {
  return verify({ cwd: REPO_ROOT, fast: true });
}

describe("specd verifies this repository", () => {
  it("runs the layers this repository configures", async () => {
    const report = await run();
    expect(report.layers.map((l) => l.layer)).toEqual(["schema", "anchors"]);
    expect(report.disabled).toEqual(["provenance", "coverage", "evidence"]);
  });

  it("passes the schema layer: all 48 statements parse", async () => {
    const report = await run();
    const schema = report.layers.find((l) => l.layer === "schema");
    expect(schema?.violations).toEqual([]);
    expect(schema?.status).toBe("passed");
  });

  it("fails on real dangling anchors", async () => {
    // This is the Fatia 1 criterion, not a defect: the deferred requirements
    // point at modules later slices will write. When a slice implements them,
    // this expectation is what says so out loud.
    const report = await run();
    expect(report.ok).toBe(false);
    expect(report.stoppedAt).toBe("anchors");
    expect(report.violations.filter((v) => v.severity === "error")).not.toEqual(
      [],
    );
  });

  // REQ-ANC-006: under the graduated policy, a dangling anchor is an error only
  // when its requirement is outside the active change delta. This holds however
  // many anchors dangle, so it keeps its meaning as the work advances.
  it("errors only for requirements the active change does not claim", async () => {
    const active = readActiveChange(REPO_ROOT);
    expect(active?.name).toBe("2026-07-fatia-1");

    const report = await run();
    for (const violation of report.violations) {
      const claimed = active?.inFlight.has(violation.requirementId ?? "");
      expect(violation.severity).toBe(claimed ? "warning" : "error");
    }
  });

  it("names the file and the ladder step of every dangling anchor", async () => {
    const report = await run();
    for (const violation of report.violations) {
      expect(violation.message).toMatch(/ladder step [1-5]/);
      expect(violation.file).toMatch(/^\.specd\/specs\/.+\.md$/);
      expect(violation.line).toBeGreaterThan(0);
    }
  });
});
