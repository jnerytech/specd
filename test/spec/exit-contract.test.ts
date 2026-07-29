import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
} from "../verify/helpers.js";
import {
  collectImportGraph,
  findForbidden,
  type ForbiddenRule,
} from "../architecture/import-graph.js";

afterEach(cleanupWorkspaces);

const SPEC_ENTRY = join(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "spec",
  "index.ts",
);

// Same list the gate is held to. `spec` reads what the gate reads, and a
// transport reaching this graph would put the network inside a command people
// run from a hook.
const FORBIDDEN: ForbiddenRule[] = [
  { pattern: /^node:https?$/, reason: "HTTP client" },
  { pattern: /^node:http2$/, reason: "HTTP/2 client" },
  { pattern: /^node:net$/, reason: "TCP sockets" },
  { pattern: /^node:tls$/, reason: "TLS sockets" },
  { pattern: /^node:dgram$/, reason: "UDP sockets" },
  { pattern: /^node:dns$/, reason: "name resolution" },
  {
    pattern: /^(node-fetch|undici|axios|got|superagent|ky|request)$/,
    reason: "HTTP client package",
  },
  { pattern: /^src\/(net|http|remote|sync)\//, reason: "network module" },
];

function io(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (text: string) => out.push(text),
    stderr: (text: string) => err.push(text),
    cwd,
  };
}

// REQ-EFF-003 — a second command able to exit 1 breaks single-gate even if
// nobody puts it in CI, because eventually somebody does.
describe("spec informs and never judges", () => {
  it("exits 0 with a dangling anchor in the effective spec", async () => {
    const { root } = makeWorkspace({
      specs: {
        demo: capability({
          name: "demo",
          id: "REQ-DEMO-001",
          anchors: '- file: src/gone.ts\n  symbol: "export function gone"',
        }),
      },
    });

    const sink = io(root);
    expect(await main(["spec"], sink)).toBe(EXIT.OK);
    expect(sink.out.join("")).toContain("REQ-DEMO-001");
  });

  it("exits 0 with a requirement that has no acceptance criteria", async () => {
    const { root } = makeWorkspace({
      files: {
        ".specd/specs/demo.md":
          "---\ncapability: demo\nretired: []\n---\n\n" +
          "### REQ-DEMO-001 — Example\n\n" +
          "**Statement.** The specd verifier SHALL do the thing.\n",
      },
    });

    expect(await main(["spec"], io(root))).toBe(EXIT.OK);
  });

  it("exits 2, never 1, when there is no project to read", async () => {
    const { root } = makeWorkspace({});
    const outside = join(root, "..");

    const sink = io(outside);
    expect(await main(["spec"], sink)).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(sink.err.join("")).toContain(".specd/");
  });

  it("reaches no network module", () => {
    const graph = collectImportGraph(SPEC_ENTRY);

    expect(graph.files.length).toBeGreaterThan(5);
    expect(findForbidden(graph, FORBIDDEN)).toEqual([]);
  });
});
