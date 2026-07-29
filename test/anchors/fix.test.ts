import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fixAnchor } from "../../src/anchors/fix.js";
import { main } from "../../src/cli.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

// One unambiguous match: the resolver has a suggestion to apply.
function moved(): string {
  return makeWorkspace({
    config: '[verify]\nlevels = ["schema", "anchors"]\n',
    specs: {
      demo: capability({
        name: "demo",
        id: "REQ-DEMO-001",
        anchors: '- file: src/old.ts\n  symbol: "export function moved"',
      }),
    },
    files: {
      "src/old.ts": "// it used to live here\n",
      "src/new.ts": "export function moved(): void {}\n",
    },
  }).root;
}

// REQ-ANC-008 — Fix rewrites with review
describe("anchor fix", () => {
  it("rewrites the anchor to the suggested location", async () => {
    const root = moved();
    const result = await fixAnchor("REQ-DEMO-001", { cwd: root });

    expect(result.fixed).toEqual([
      {
        requirementId: "REQ-DEMO-001",
        file: ".specd/specs/demo.md",
        line: expect.any(Number),
        from: "src/old.ts",
        to: "src/new.ts",
      },
    ]);
    expect(readFileSync(join(root, ".specd/specs/demo.md"), "utf8")).toContain(
      "file: src/new.ts",
    );
  });

  it("leaves the symbol and the rest of the block untouched", async () => {
    const root = moved();
    await fixAnchor("REQ-DEMO-001", { cwd: root });

    const written = readFileSync(join(root, ".specd/specs/demo.md"), "utf8");
    expect(written).toContain('symbol: "export function moved"');
    expect(written).toContain("### REQ-DEMO-001 — Example");
  });

  it("makes verify pass afterwards, which is the point", async () => {
    const root = moved();
    await fixAnchor("REQ-DEMO-001", { cwd: root });
    const { verify } = await import("../../src/verify/index.js");
    expect((await verify({ cwd: root })).violations).toEqual([]);
  });

  // The exit code REQ-ANC-008 used to get wrong. "Nothing to apply" is a
  // refusal to act; only `specd verify` returns a verdict (REQ-CLI-001, single-gate).
  it("exits 2, not 1, when no anchor carries a suggestion", async () => {
    const root = makeWorkspace({
      config: "",
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          anchors: '- file: src/old.ts\n  symbol: "export function vanished"',
        }),
      },
      files: { "src/old.ts": "// nothing here\n" },
    }).root;

    await expect(
      fixAnchor("REQ-DEMO-001", { cwd: root }),
    ).rejects.toMatchObject({ exitCode: EXIT.OPERATIONAL_FAILURE });

    const status = await main(["anchor", "fix", "REQ-DEMO-001"], {
      stdout: () => undefined,
      stderr: () => undefined,
      cwd: root,
    });
    expect(status).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(status).not.toBe(EXIT.GATE_FAILURE);
  });

  it("exits 2 when the requirement does not exist", async () => {
    await expect(fixAnchor("REQ-DEMO-404", { cwd: moved() })).rejects.toThrow(
      /No requirement REQ-DEMO-404/,
    );
  });

  it("exits 2 when every anchor already resolves", async () => {
    const root = makeWorkspace({
      config: "",
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          anchors: '- file: src/here.ts\n  symbol: "export function here"',
        }),
      },
      files: { "src/here.ts": "export function here(): void {}\n" },
    }).root;
    await expect(fixAnchor("REQ-DEMO-001", { cwd: root })).rejects.toThrow(
      /nothing to fix/,
    );
  });
});
