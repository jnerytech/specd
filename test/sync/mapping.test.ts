import { describe, expect, it } from "vitest";
import { planBoardItems, type SpecNode } from "../../src/sync/mapping.js";

function tree(): SpecNode[] {
  return [
    {
      key: "sync",
      level: "capability",
      title: "sync",
      body: "",
      capability: "sync",
      children: [
        {
          key: "REQ-SYNC-001",
          level: "requirement",
          title: "REQ-SYNC-001 — manual",
          body: "statement",
          capability: "sync",
          children: [
            {
              key: "2026-07-fatia-6/006-sync-command",
              level: "task",
              title: "006-sync-command",
              body: "",
              capability: "sync",
              children: [],
            },
          ],
        },
      ],
    },
  ];
}

// REQ-SYNC-006 — Spec level maps to item type, with an explicit collapse rule.
describe("planBoardItems", () => {
  it("makes one item per element of a mapped level", () => {
    const planned = planBoardItems(tree(), {
      capability: "Epic",
      requirement: "Story",
      collapse: ["task"],
    });
    expect(planned.map((item) => [item.key, item.type])).toEqual([
      ["sync", "Epic"],
      ["REQ-SYNC-001", "Story"],
    ]);
  });

  it("names the parent so the hierarchy is built with link, not recreation", () => {
    const planned = planBoardItems(tree(), {
      capability: "Epic",
      requirement: "Story",
      collapse: ["task"],
    });
    expect(planned[0]?.parentKey).toBeUndefined();
    expect(planned[1]?.parentKey).toBe("sync");
  });

  // Collapsed does not mean dropped: the content lands in the nearest mapped
  // ancestor.
  it("folds a collapsed level into its nearest mapped ancestor", () => {
    const planned = planBoardItems(tree(), {
      capability: "Epic",
      requirement: "Story",
      collapse: ["task"],
    });
    expect(planned[1]?.body).toContain("006-sync-command");
  });

  it("collapses an intermediate level and reparents what was below it", () => {
    const planned = planBoardItems(tree(), {
      capability: "Epic",
      task: "Task",
      collapse: ["requirement"],
    });
    expect(planned.map((item) => item.key)).toEqual([
      "sync",
      "2026-07-fatia-6/006-sync-command",
    ]);
    expect(planned[1]?.parentKey).toBe("sync");
    // The collapsed requirement folded into the capability rather than vanishing.
    expect(planned[0]?.body).toContain("REQ-SYNC-001");
  });

  // Absence of a rule is not a rule (P8).
  it("refuses a level that is neither mapped nor collapsed, naming it", () => {
    expect(() =>
      planBoardItems(tree(), { capability: "Epic", collapse: ["task"] }),
    ).toThrowError(/No board mapping for spec level "requirement"/);
  });

  it("names every undecided level at once instead of one per run", () => {
    expect(() => planBoardItems(tree(), { capability: "Epic" })).toThrowError(
      /"requirement", "task"/,
    );
  });

  it("refuses with exit code 2", () => {
    try {
      planBoardItems(tree(), { capability: "Epic" });
      expect.unreachable("should have refused");
    } catch (error) {
      expect((error as { exitCode: number }).exitCode).toBe(2);
    }
  });
});
