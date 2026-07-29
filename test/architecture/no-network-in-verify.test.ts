import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectImportGraph,
  findForbidden,
  type ForbiddenRule,
} from "./import-graph.js";

const VERIFY_ENTRY = join(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "verify",
  "index.ts",
);

// gate-no-network / REQ-CLI-005 — the gate never touches the network.
//
// The list is explicit rather than a heuristic: a new transport has to be added
// here consciously, and the reason is written down next to it.
//
// `node:child_process` is deliberately absent. The project layer spawns the
// configured validation command (REQ-VER-006) and the anchor search asks git
// which files are ignored (REQ-ANC-003); neither opens a socket.
const FORBIDDEN: ForbiddenRule[] = [
  { pattern: /^node:https?$/, reason: "HTTP client" },
  { pattern: /^node:http2$/, reason: "HTTP/2 client" },
  { pattern: /^node:net$/, reason: "TCP sockets" },
  { pattern: /^node:tls$/, reason: "TLS sockets" },
  { pattern: /^node:dgram$/, reason: "UDP sockets" },
  { pattern: /^node:dns$/, reason: "name resolution" },
  { pattern: /^node:quic$/, reason: "QUIC sockets" },
  {
    pattern: /^(node-fetch|undici|axios|got|superagent|ky|request)$/,
    reason: "HTTP client package",
  },
  { pattern: /^ws$|^socket\.io/, reason: "WebSocket client" },
  { pattern: /^src\/(net|http|remote)\//, reason: "network module" },
];

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

describe("no-network-in-verify", () => {
  it("reaches the real verify graph", () => {
    const graph = collectImportGraph(VERIFY_ENTRY);
    // A graph of one file would make every assertion below vacuous.
    expect(graph.files.length).toBeGreaterThan(5);
  });

  it("no module reachable from verify() imports a network module", () => {
    const graph = collectImportGraph(VERIFY_ENTRY);
    const matches = findForbidden(graph, FORBIDDEN).map(
      (m) => `${m.importer} imports ${m.specifier} (${m.reason})`,
    );
    expect(matches).toEqual([]);
  });

  it("catches a network import introduced anywhere in the graph", () => {
    // Proves the walker actually fails CI, rather than passing because it
    // found nothing to look at.
    const root = mkdtempSync(join(tmpdir(), "specd-arch-"));
    roots.push(root);
    mkdirSync(join(root, "layers"), { recursive: true });
    writeFileSync(
      join(root, "index.ts"),
      'import { layer } from "./layers/one.js";\nexport const verify = layer;\n',
    );
    writeFileSync(
      join(root, "layers", "one.ts"),
      'import { request } from "node:https";\nexport const layer = request;\n',
    );

    const matches = findForbidden(
      collectImportGraph(join(root, "index.ts")),
      FORBIDDEN,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.specifier).toBe("node:https");
  });

  it("completes well under two seconds", () => {
    const started = process.hrtime.bigint();
    findForbidden(collectImportGraph(VERIFY_ENTRY), FORBIDDEN);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    expect(elapsedMs).toBeLessThan(2000);
  });
});
