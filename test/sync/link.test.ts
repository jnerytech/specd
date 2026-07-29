import { describe, expect, it } from "vitest";
import { readBoardLinks, writeBoardLinks } from "../../src/sync/link.js";

const CAPABILITY = `---
capability: sync
# a comment the author wrote and expects to keep
retired: []
---

### REQ-SYNC-001 — Sync is manual

**Statement.** The specd sync command SHALL be invoked by hand.
`;

const LINK = {
  ref: "12",
  url: "http://localhost:18080/issues/12",
  synced_at: "2026-07-28T23:00:00.000Z",
  synced_hash: "sha256:abc",
};

// REQ-SYNC-007 — The link lives in the spec frontmatter.
describe("board links in frontmatter", () => {
  it("reads nothing when the file was never synced", () => {
    expect(readBoardLinks(CAPABILITY)).toEqual({});
  });

  it("round-trips a link", () => {
    const written = writeBoardLinks(CAPABILITY, { "REQ-SYNC-001": LINK });
    expect(readBoardLinks(written)).toEqual({ "REQ-SYNC-001": LINK });
  });

  it("leaves the body byte-identical", () => {
    const written = writeBoardLinks(CAPABILITY, { "REQ-SYNC-001": LINK });
    const body = (source: string) => source.slice(source.indexOf("\n---") + 5);
    expect(body(written)).toBe(body(CAPABILITY));
  });

  it("preserves comments and the order of existing keys", () => {
    const written = writeBoardLinks(CAPABILITY, { "REQ-SYNC-001": LINK });
    expect(written).toContain(
      "# a comment the author wrote and expects to keep",
    );
    expect(written.indexOf("capability: sync")).toBeLessThan(
      written.indexOf("retired: []"),
    );
  });

  it("writes the four fields and nothing else", () => {
    const written = writeBoardLinks(CAPABILITY, { "REQ-SYNC-001": LINK });
    const link = readBoardLinks(written)["REQ-SYNC-001"];
    expect(Object.keys(link ?? {}).sort()).toEqual([
      "ref",
      "synced_at",
      "synced_hash",
      "url",
    ]);
  });

  it("removes the key entirely when there is nothing left to record", () => {
    const written = writeBoardLinks(CAPABILITY, { "REQ-SYNC-001": LINK });
    expect(writeBoardLinks(written, {})).not.toContain("board:");
  });

  it("is stable: writing the same links twice produces the same bytes", () => {
    const once = writeBoardLinks(CAPABILITY, { "REQ-SYNC-001": LINK });
    expect(writeBoardLinks(once, { "REQ-SYNC-001": LINK })).toBe(once);
  });

  // A half-written link is not a link. Reading it as "synced" would be the absence-is-not-compliance
  // failure in file-format shape.
  it("refuses a link missing one of its four fields", () => {
    const broken = `---
capability: sync
retired: []
board:
  REQ-SYNC-001:
    ref: "12"
    url: http://localhost:18080/issues/12
---

body
`;
    expect(() => readBoardLinks(broken)).toThrowError(/missing "synced_at"/);
  });

  it("refuses to overwrite a board key it cannot read", () => {
    const broken = `---
capability: sync
retired: []
board: "not a mapping"
---

body
`;
    expect(() => readBoardLinks(broken)).toThrowError(/not a mapping/);
  });
});
