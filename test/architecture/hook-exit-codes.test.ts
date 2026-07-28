import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { collectImportGraph } from "./import-graph.js";

const SRC = join(import.meta.dirname, "..", "..", "src");
const ADAPTER_ENTRY = join(SRC, "hooks", "run.ts");
const HOOKS_DIR = join(SRC, "hooks");

// REQ-HOOK-005 — the boundary between two exit-code contracts must not leak.
//
// The rule is deliberately scoped to the adapter's own modules rather than to
// everything it can reach. `runHook` calls `verify`, which calls
// `requireProjectRoot`, which throws an `OperationalError` carrying specd's 2 —
// so "no reachable module imports EXIT" would be false by design and would have
// to be weakened until it asserted nothing.
//
// What has to hold is narrower and real: the adapter never *names* specd's exit
// codes, and it translates the errors that carry them instead of letting them
// out. The second half is asserted behaviourally in test/hooks/run.test.ts.
describe("hook adapter never claims specd's exit codes", () => {
  it("reaches the real adapter graph", () => {
    const graph = collectImportGraph(ADAPTER_ENTRY);
    expect(graph.files.length).toBeGreaterThan(5);
  });

  it("no module under src/hooks/ imports the specd EXIT table", () => {
    const graph = collectImportGraph(ADAPTER_ENTRY);
    const offenders: string[] = [];
    for (const [specifier, importers] of graph.importers) {
      if (!/exit-codes(\.js)?$/.test(specifier)) continue;
      for (const importer of importers) {
        if (!importer.startsWith(HOOKS_DIR)) continue;
        offenders.push(`${relative(SRC, importer)} imports ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // The literals are the contract. A future edit that renames ALLOW/BLOCK is
  // fine; one that changes what they are is a silent protocol break, because
  // the host is the only thing that would notice and it notices in production.
  it("pins the host convention to the values the host defines", () => {
    const source = readFileSync(join(HOOKS_DIR, "protocol.ts"), "utf8");
    expect(source).toMatch(/ALLOW:\s*0/);
    expect(source).toMatch(/BLOCK:\s*2/);
    expect(source).not.toMatch(/from\s+["'].*exit-codes/);
  });
});
