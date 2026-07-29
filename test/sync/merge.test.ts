import { describe, expect, it } from "vitest";
import { normalizeProjection, syncedHash } from "../../src/sync/hash.js";
import { FIELD_OWNERSHIP, mergeThreeWay } from "../../src/sync/merge.js";

const spec = (title: string) => normalizeProjection({ title, body: "same" });

// REQ-SYNC-005 — Both sides changed is a conflict, and conflicts are never
// resolved.
describe("mergeThreeWay", () => {
  it("creates when the item is not on the board", () => {
    const result = mergeThreeWay({ item: "REQ-A-001", ours: spec("a") });
    expect(result.outcome).toBe("create");
  });

  it("reports unchanged when neither side moved", () => {
    const ours = spec("a");
    const result = mergeThreeWay({
      item: "REQ-A-001",
      base: syncedHash(ours),
      ours,
      theirs: ours,
    });
    expect(result.outcome).toBe("unchanged");
    expect(result.conflicts).toEqual([]);
  });

  it("pushes when only the spec moved", () => {
    const base = syncedHash(spec("old"));
    const result = mergeThreeWay({
      item: "REQ-A-001",
      base,
      ours: spec("new"),
      theirs: spec("old"),
    });
    expect(result.outcome).toBe("push");
  });

  // A spec-owned field edited on the board. Ownership decides, so this is not
  // ambiguous — but it overwrites somebody's edit, so it gets its own name.
  it("restores when only the board moved", () => {
    const base = syncedHash(spec("canonical"));
    const result = mergeThreeWay({
      item: "REQ-A-001",
      base,
      ours: spec("canonical"),
      theirs: spec("edited on the board"),
    });
    expect(result.outcome).toBe("restore");
  });

  it("converges when both sides moved to the same value", () => {
    const base = syncedHash(spec("old"));
    const result = mergeThreeWay({
      item: "REQ-A-001",
      base,
      ours: spec("new"),
      theirs: spec("new"),
    });
    expect(result.outcome).toBe("converged");
    expect(result.conflicts).toEqual([]);
  });

  it("conflicts when both sides moved differently, and names the field", () => {
    const base = syncedHash(spec("old"));
    const result = mergeThreeWay({
      item: "REQ-A-001",
      base,
      ours: spec("ours"),
      theirs: spec("theirs"),
    });
    expect(result.outcome).toBe("conflict");
    expect(result.conflicts).toEqual([
      { field: "title", ours: "ours", theirs: "theirs" },
    ]);
  });

  // P4: an item on the board with no recorded hash is two states with no basis
  // for choosing between them.
  it("conflicts when the item exists remotely with no recorded base", () => {
    expect(
      mergeThreeWay({
        item: "REQ-A-001",
        ours: spec("a"),
        theirs: spec("b"),
      }).outcome,
    ).toBe("conflict");
  });

  it("converges rather than conflicting when there is no base but the two agree", () => {
    expect(
      mergeThreeWay({
        item: "REQ-A-001",
        ours: spec("a"),
        theirs: spec("a"),
      }).outcome,
    ).toBe("converged");
  });

  // REQ-SYNC-003: the ownership table is data, so the split is one declaration
  // rather than a rule re-derived at each call site.
  it("declares which side owns what", () => {
    expect(FIELD_OWNERSHIP.spec).toContain("title");
    expect(FIELD_OWNERSHIP.spec).toContain("parent");
    expect(FIELD_OWNERSHIP.board).toEqual(["status", "assignee", "iteration"]);
    for (const owned of FIELD_OWNERSHIP.board) {
      expect(FIELD_OWNERSHIP.spec).not.toContain(owned);
    }
  });
});
