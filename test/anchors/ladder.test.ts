import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Anchor } from "../../src/anchors/model.js";
import {
  LADDER_STEPS,
  resolveAnchor,
  type AnchorResolution,
} from "../../src/anchors/resolve.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function resolve(fixture: string, anchor: Anchor): AnchorResolution {
  return resolveAnchor(anchor, {
    root: join(FIXTURES, fixture),
    defaultStrategy: "grep",
  });
}

// REQ-ANC-002 — Deterministic resolution ladder.
// Each fixture is a miniature repository built to stop the ladder at exactly
// one step; see test/fixtures/README.md.
describe("resolution ladder", () => {
  it("step 1: a missing file is dangling", () => {
    const result = resolve("missing-file", {
      file: "src/removed.ts",
      symbol: "export function gone",
    });
    expect(result.outcome).toBe("dangling");
    expect(result.step).toBe(LADDER_STEPS.FILE_MISSING);
    expect(result.suggestion).toBeUndefined();
  });

  it("step 2: a file-only anchor resolves on the file existing", () => {
    const result = resolve("resolved-file-only", { file: "config/app.yml" });
    expect(result.outcome).toBe("resolved");
    expect(result.step).toBe(LADDER_STEPS.FILE_ONLY);
  });

  it("step 3: grep finding the symbol resolves", () => {
    const result = resolve("resolved-with-symbol", {
      file: "src/greeter.ts",
      symbol: "export function greet",
    });
    expect(result.outcome).toBe("resolved");
    expect(result.step).toBe(LADDER_STEPS.GREP);
    expect(result.strategy).toBe("grep");
  });

  // Step 4 is treesitter. Version 1 never reaches it: REQ-ANC-005 turns the
  // request into a configuration error, covered in strategy.test.ts.
  it("step 4 is not reachable while grep is the only strategy", () => {
    const steps = [
      resolve("resolved-with-symbol", {
        file: "src/greeter.ts",
        symbol: "export function greet",
      }),
      resolve("renamed-symbol", {
        file: "src/auth.ts",
        symbol: "export function validateToken",
      }),
    ].map((r) => r.step);
    expect(steps).not.toContain(LADDER_STEPS.TREESITTER);
  });

  it("step 5: exactly one match elsewhere becomes a suggestion", () => {
    const result = resolve("moved-symbol", {
      file: "src/auth.ts",
      symbol: "export function validateToken",
    });
    expect(result.outcome).toBe("dangling-with-suggestion");
    expect(result.step).toBe(LADDER_STEPS.REPO_SEARCH);
    expect(result.suggestion).toEqual({ file: "src/token.ts", line: 1 });
  });

  it("step 5: several matches leave the anchor dangling without a suggestion", () => {
    const result = resolve("ambiguous-symbol", {
      file: "src/auth.ts",
      symbol: "export function validateToken",
    });
    expect(result.outcome).toBe("dangling");
    expect(result.step).toBe(LADDER_STEPS.REPO_SEARCH);
    expect(result.suggestion).toBeUndefined();
  });

  it("step 5: no match anywhere leaves the anchor dangling", () => {
    const result = resolve("renamed-symbol", {
      file: "src/auth.ts",
      symbol: "export function validateToken",
    });
    expect(result.outcome).toBe("dangling");
    expect(result.step).toBe(LADDER_STEPS.REPO_SEARCH);
    expect(result.suggestion).toBeUndefined();
  });

  it("stops at the first matching step", () => {
    // The symbol exists in src/greeter.ts, so the ladder never reaches the
    // repository-wide search even though the tree would allow it.
    const result = resolve("resolved-with-symbol", {
      file: "src/greeter.ts",
      symbol: "export function greet",
    });
    expect(result.step).toBeLessThan(LADDER_STEPS.REPO_SEARCH);
  });
});

// REQ-ANC-002 — "the same input always produces the same output".
describe("determinism", () => {
  const cases: Array<[string, Anchor]> = [
    [
      "missing-file",
      { file: "src/removed.ts", symbol: "export function gone" },
    ],
    ["resolved-file-only", { file: "config/app.yml" }],
    [
      "resolved-with-symbol",
      { file: "src/greeter.ts", symbol: "export function greet" },
    ],
    [
      "moved-symbol",
      { file: "src/auth.ts", symbol: "export function validateToken" },
    ],
    [
      "ambiguous-symbol",
      { file: "src/auth.ts", symbol: "export function validateToken" },
    ],
    [
      "renamed-symbol",
      { file: "src/auth.ts", symbol: "export function validateToken" },
    ],
  ];

  it.each(cases)("%s resolves identically across runs", (fixture, anchor) => {
    const runs = Array.from({ length: 5 }, () =>
      JSON.stringify(resolve(fixture, anchor)),
    );
    expect(new Set(runs).size).toBe(1);
  });
});
