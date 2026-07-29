import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectImportGraph,
  findForbidden,
  type ForbiddenRule,
} from "./import-graph.js";

const SRC = join(import.meta.dirname, "..", "..", "src");
const HOOK_ENTRY = join(SRC, "hooks", "run.ts");
const VERIFY_ENTRY = join(SRC, "verify", "index.ts");

// REQ-SYNC-001 — `sync` is manual and never runs from a hook.
//
// A hook runs with nobody watching. `sync` writes into a third-party system,
// and a write nobody is watching is how someone else's work is quietly
// overwritten. The rule is stated in the spec; this is what makes it hold when
// somebody later reaches for a convenient import.
//
// The same rule covers `verify` for two separate reasons: P3, because the
// adapter opens sockets, and P1's sibling — the gate stays a pure read.
const FORBIDDEN: ForbiddenRule[] = [
  { pattern: /(^|\/)sync(\/|$)/, reason: "sync module" },
  { pattern: /\/sync\/index\.js$/, reason: "sync entry point" },
  { pattern: /\/sync\/adapters\//, reason: "board adapter" },
];

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

describe("no-sync-in-hooks", () => {
  it("reaches the real hook graph", () => {
    expect(collectImportGraph(HOOK_ENTRY).files.length).toBeGreaterThan(5);
  });

  it("no module reachable from the hook adapter imports sync", () => {
    const matches = findForbidden(
      collectImportGraph(HOOK_ENTRY),
      FORBIDDEN,
    ).map((m) => `${m.importer} imports ${m.specifier} (${m.reason})`);
    expect(matches).toEqual([]);
  });

  it("no module reachable from verify() imports sync either", () => {
    const matches = findForbidden(
      collectImportGraph(VERIFY_ENTRY),
      FORBIDDEN,
    ).map((m) => `${m.importer} imports ${m.specifier} (${m.reason})`);
    expect(matches).toEqual([]);
  });

  it("catches a sync import introduced anywhere in the graph", () => {
    // Proves the walker fails CI rather than passing because it found nothing.
    const root = mkdtempSync(join(tmpdir(), "specd-arch-"));
    roots.push(root);
    mkdirSync(join(root, "layers"), { recursive: true });
    writeFileSync(
      join(root, "index.ts"),
      'import { layer } from "./layers/one.js";\nexport const runHook = layer;\n',
    );
    writeFileSync(
      join(root, "layers", "one.ts"),
      'import { sync } from "../../sync/index.js";\nexport const layer = sync;\n',
    );

    const matches = findForbidden(
      collectImportGraph(join(root, "index.ts")),
      FORBIDDEN,
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.specifier).toBe("../../sync/index.js");
  });
});
