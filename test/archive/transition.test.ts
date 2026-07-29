import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseDelta } from "../../src/parser/delta.js";
import type { Delta } from "../../src/parser/delta.js";
import {
  changeLinkKeys,
  formatTransition,
  transitionArchivedItems,
} from "../../src/archive/index.js";
import type { BoardAdapter, BoardItemRef } from "../../src/sync/adapter.js";
import { deltaRequirement } from "../verify/helpers.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

// A repository whose capability files carry board links, which is the state
// `archive --sync` leaves behind once `sync` has written them.
function repository(links: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "specd-transition-"));
  roots.push(root);

  const entries = Object.entries(links)
    .map(
      ([key, ref]) =>
        `  ${key}:\n    ref: "${ref}"\n    url: "http://board.invalid/issues/${ref}"\n` +
        `    synced_at: "2026-07-29T00:00:00Z"\n    synced_hash: "abc"`,
    )
    .join("\n");

  write(
    join(root, ".specd", "specs", "demo.md"),
    `---\ncapability: demo\nretired: []\nboard:\n${entries}\n---\n\n# demo\n`,
  );
  return root;
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function delta(ids: string[]): Delta {
  const parsed = parseDelta(
    `---\nchange: 2026-07-demo\n---\n\n## ADDED\n\n${ids
      .map((id) => deltaRequirement({ id, capability: "demo" }))
      .join("\n")}\n`,
    ".specd/changes/2026-07-demo/delta.md",
  );
  return parsed.delta as Delta;
}

function recorder() {
  const moved: { ref: BoardItemRef; status: string }[] = [];
  const adapter = {
    provider: "test",
    create: () => Promise.reject(new Error("no writes")),
    update: () => Promise.reject(new Error("no writes")),
    link: () => Promise.reject(new Error("no writes")),
    close: () => Promise.reject(new Error("close is not a transition")),
    transition: (ref: BoardItemRef, status: string) => {
      moved.push({ ref, status });
      return Promise.resolve();
    },
    read: () => Promise.resolve(undefined),
    describeFields: () => Promise.resolve([]),
  } satisfies BoardAdapter;
  return { moved, adapter };
}

// REQ-ARC-014 — Archive hands the item over, it does not bury it.
describe("transitionArchivedItems — REQ-ARC-014", () => {
  it("moves the items the change owns", async () => {
    const root = repository({ "REQ-DEMO-001": "11", demo: "10" });
    const { moved, adapter } = recorder();

    const keys = await transitionArchivedItems(
      delta(["REQ-DEMO-001"]),
      root,
      adapter,
      "Em homologação",
      "archived",
    );

    expect(keys).toEqual(["REQ-DEMO-001", "demo"]);
    expect(moved.map((entry) => entry.ref.id)).toEqual(["11", "10"]);
    expect(moved.every((entry) => entry.status === "Em homologação")).toBe(
      true,
    );
  });

  it("leaves an item of another change alone", async () => {
    const root = repository({ "REQ-DEMO-001": "11", "REQ-DEMO-002": "12" });
    const { moved, adapter } = recorder();

    await transitionArchivedItems(
      delta(["REQ-DEMO-001"]),
      root,
      adapter,
      "Em homologação",
      "archived",
    );

    expect(moved.map((entry) => entry.ref.id)).not.toContain("12");
  });

  it("skips a requirement the board has never seen", async () => {
    const root = repository({ demo: "10" });
    const { moved, adapter } = recorder();

    const keys = await transitionArchivedItems(
      delta(["REQ-DEMO-001"]),
      root,
      adapter,
      "Em homologação",
      "archived",
    );

    expect(keys).toEqual(["demo"]);
    expect(moved).toHaveLength(1);
  });

  it("owns its requirements and their capabilities, and nothing else", () => {
    expect(delta(["REQ-DEMO-001", "REQ-DEMO-002"])).toBeDefined();
    expect(changeLinkKeys(delta(["REQ-DEMO-001", "REQ-DEMO-002"]))).toEqual([
      "REQ-DEMO-001",
      "REQ-DEMO-002",
      "demo",
    ]);
  });
});

// REQ-ARC-014 — "nothing was attempted" and "nothing needed moving" are
// different facts, and the output says which one happened.
describe("formatTransition — REQ-ARC-014", () => {
  it("says when no status is configured", () => {
    expect(formatTransition({ items: [] })).toContain("archived_status");
  });

  it("says when a status is configured and no item is linked", () => {
    expect(formatTransition({ status: "Em homologação", items: [] })).toContain(
      "No archived item is linked",
    );
  });

  it("names what moved", () => {
    expect(
      formatTransition({ status: "Em homologação", items: ["REQ-DEMO-001"] }),
    ).toContain('Moved 1 item to "Em homologação": REQ-DEMO-001.');
  });
});
