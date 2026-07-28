import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  suggestAnchors,
  type SuggestReport,
} from "../../src/anchors/suggest.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import { ConflictError } from "../../src/core/conflict.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
  type Workspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

// A capability whose requirements name symbols in their acceptance criteria and
// declare no anchors — the bootstrap case the command exists for.
function unanchored(criteria: string): string {
  return (
    "---\ncapability: demo\nretired: []\n---\n\n# demo\n\n" +
    "### REQ-DEMO-001 — Example\n\n" +
    "**Statement.** The specd demo SHALL do the thing.\n\n" +
    `**Acceptance.**\n${criteria}\n`
  );
}

function build(criteria: string, files: Record<string, string>): Workspace {
  return makeWorkspace({
    config: "",
    specs: { demo: unanchored(criteria) },
    files,
  });
}

function suggest(workspace: Workspace): SuggestReport {
  return suggestAnchors({ root: workspace.root, capability: "demo" });
}

describe("anchor suggest", () => {
  it("proposes a pasteable symbol when the term resolves to one declaration", () => {
    const workspace = build("- `redactPayload` removes the listed fields\n", {
      "src/redact.ts": "export function redactPayload(): void {}\n",
      "src/other.ts": "export function unrelated(): void {}\n",
    });
    const report = suggest(workspace);
    const requirement = report.requirements[0];

    expect(requirement?.requirementId).toBe("REQ-DEMO-001");
    expect(requirement?.hasAnchors).toBe(false);
    const candidate = requirement?.candidates.find(
      (c) => c.term === "redactPayload",
    );
    expect(candidate?.confidence).toBe("unique");
    expect(candidate?.symbol).toBe("export function redactPayload");
    expect(candidate?.matches).toEqual([{ file: "src/redact.ts", line: 1 }]);
  });

  // REQ-CLI-003 — an ambiguous candidate is listed, never chosen.
  it("lists every match when the term resolves to several declarations", () => {
    const workspace = build("- `validateToken` accepts the token\n", {
      "src/a.ts": "export function validateToken(): void {}\n",
      "src/b.ts": "export function validateToken(): void {}\n",
    });
    const candidate = suggest(workspace).requirements[0]?.candidates[0];

    expect(candidate?.confidence).toBe("ambiguous");
    expect(candidate?.matches.map((m) => m.file)).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("proposes nothing when the term resolves nowhere", () => {
    const workspace = build("- `neverDeclared` does something\n", {
      "src/a.ts": "export function somethingElse(): void {}\n",
    });
    expect(suggest(workspace).requirements[0]?.candidates).toEqual([]);
  });

  it("marks a requirement that already declares anchors", () => {
    const workspace = makeWorkspace({
      config: "",
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          anchors: "- file: src/a.ts",
        }),
      },
      files: { "src/a.ts": "export function run(): void {}\n" },
    });
    expect(suggest(workspace).requirements[0]?.hasAnchors).toBe(true);
  });

  it("never modifies the capability file", () => {
    const workspace = build("- `redactPayload` removes the listed fields\n", {
      "src/redact.ts": "export function redactPayload(): void {}\n",
    });
    const specPath = join(workspace.root, ".specd", "specs", "demo.md");
    const before = {
      content: readFileSync(specPath, "utf8"),
      size: statSync(specPath).size,
    };

    suggest(workspace);

    expect(readFileSync(specPath, "utf8")).toBe(before.content);
    expect(statSync(specPath).size).toBe(before.size);
  });

  it("ignores prose that merely repeats the term", () => {
    // Documentation mentions the word everywhere; only declarations count.
    const workspace = build("- `redactPayload` removes the listed fields\n", {
      "src/redact.ts": "export function redactPayload(): void {}\n",
      "README.md": "redactPayload redactPayload redactPayload\n",
    });
    const candidate = suggest(workspace).requirements[0]?.candidates[0];
    expect(candidate?.confidence).toBe("unique");
  });
});

// REQ-CLI-003 — Never guess on conflict
describe("capability selection", () => {
  it("names the available capabilities when the argument matches none", () => {
    const workspace = makeWorkspace({
      config: "",
      specs: { demo: unanchored("- nothing\n") },
    });
    let thrown: unknown;
    try {
      suggestAnchors({ root: workspace.root, capability: "nope" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).exitCode).toBe(EXIT.OPERATIONAL_FAILURE);
    expect((thrown as ConflictError).conflicts).toEqual(["demo"]);
  });

  it("refuses to choose when the argument matches two capabilities", () => {
    const workspace = makeWorkspace({
      config: "",
      specs: {
        demo: unanchored("- nothing\n"),
        // A second file declaring the same capability name is exactly the
        // ambiguous state specd must not resolve on its own.
        "demo-copy": unanchored("- nothing\n"),
      },
    });
    const attempt = () =>
      suggestAnchors({ root: workspace.root, capability: "demo" });

    expect(attempt).toThrow(ConflictError);
    expect(attempt).toThrow(/matches more than one capability/);
    expect(attempt).toThrow(/does not choose between these/);
  });
});
