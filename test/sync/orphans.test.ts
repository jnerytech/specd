import { describe, expect, it } from "vitest";
import type {
  BoardAdapter,
  BoardItemSnapshot,
} from "../../src/sync/adapter.js";
import { UndeclaredOrphanError } from "../../src/sync/errors.js";
import {
  assertNoUnsanctionedOrphans,
  bodyKey,
  classifyOrphans,
  findOrphanedLinks,
  type DeathSignal,
  type OrphanedLink,
  type SyncItemState,
} from "../../src/sync/index.js";
import type { BoardLink } from "../../src/sync/link.js";
import type { PlannedItem } from "../../src/sync/mapping.js";

const link = (ref: string): BoardLink => ({
  ref,
  url: `http://board.invalid/issues/${ref}`,
  synced_at: "2026-07-29T00:00:00.000Z",
  synced_hash: "sha256:whatever",
});

const planned = (key: string): PlannedItem => ({
  key,
  level: "requirement",
  type: "Story",
  title: `${key} — title`,
  body: "body",
  capability: "demo",
});

const state = (key: string, body: string, linked = false): SyncItemState => ({
  item: { ...planned(key), body },
  content: { title: `${key} — title`, body, fields: [] },
  ...(linked ? { link: link("99") } : {}),
});

function adapterReturning(
  snapshots: Record<string, BoardItemSnapshot | undefined>,
): BoardAdapter {
  return {
    provider: "test",
    create: () => Promise.reject(new Error("no writes")),
    update: () => Promise.reject(new Error("no writes")),
    link: () => Promise.reject(new Error("no writes")),
    close: () => Promise.reject(new Error("no writes")),
    transition: () => Promise.reject(new Error("no writes")),
    read: (ref) => Promise.resolve(snapshots[ref.id]),
    describeFields: () => Promise.resolve([]),
  };
}

function snapshot(id: string, body: string): BoardItemSnapshot {
  return {
    ref: { id, url: `http://board.invalid/issues/${id}` },
    type: "Story",
    content: { title: "whatever", body, fields: [] },
  };
}

// REQ-SYNC-014 — Closing a board item requires a declared death.
describe("findOrphanedLinks", () => {
  const links = new Map([
    ["demo", { "REQ-D-001": link("1"), "REQ-D-002": link("2") }],
  ]);

  it("does not treat a linked, planned item as an orphan", () => {
    const orphans = findOrphanedLinks(
      [planned("REQ-D-001"), planned("REQ-D-002")],
      links,
      new Map(),
    );
    expect(orphans).toEqual([]);
  });

  it("marks an orphan declared when its identifier is retired", () => {
    const orphans = findOrphanedLinks(
      [planned("REQ-D-001")],
      links,
      new Map([["demo", ["REQ-D-002"]]]),
    );
    expect(orphans.map((o) => [o.key, o.death])).toEqual([
      ["REQ-D-002", "declared"],
    ]);
  });

  it("marks an orphan undeclared when nothing says it died", () => {
    const orphans = findOrphanedLinks(
      [planned("REQ-D-001")],
      links,
      new Map([["demo", []]]),
    );
    expect(orphans.map((o) => [o.key, o.death])).toEqual([
      ["REQ-D-002", "none"],
    ]);
  });

  it("reads retired per capability, not globally", () => {
    const twoCapabilities = new Map([
      ["demo", { "REQ-D-002": link("2") }],
      ["other", { "REQ-O-001": link("3") }],
    ]);
    const orphans = findOrphanedLinks(
      [],
      twoCapabilities,
      new Map([["demo", ["REQ-D-002"]]]),
    );
    expect(orphans.find((o) => o.key === "REQ-D-002")?.death).toBe("declared");
    expect(orphans.find((o) => o.key === "REQ-O-001")?.death).toBe("none");
  });

  // REQ-SYNC-016 — a death an open change proposes is not a death yet.
  it("marks an orphan proposed when an open change removes it", () => {
    const orphans = findOrphanedLinks(
      [planned("REQ-D-001")],
      links,
      new Map([["demo", []]]),
      new Map([["demo", ["REQ-D-002"]]]),
    );
    expect(orphans.map((o) => [o.key, o.death])).toEqual([
      ["REQ-D-002", "proposed"],
    ]);
  });

  it("lets a declared death outrank a proposed one", () => {
    const orphans = findOrphanedLinks(
      [planned("REQ-D-001")],
      links,
      new Map([["demo", ["REQ-D-002"]]]),
      new Map([["demo", ["REQ-D-002"]]]),
    );
    expect(orphans[0]?.death).toBe("declared");
  });

  it("reads the proposals per capability, not globally", () => {
    const twoCapabilities = new Map([
      ["demo", { "REQ-D-002": link("2") }],
      ["other", { "REQ-O-001": link("3") }],
    ]);
    const orphans = findOrphanedLinks(
      [],
      twoCapabilities,
      new Map(),
      new Map([["demo", ["REQ-D-002"]]]),
    );
    expect(orphans.find((o) => o.key === "REQ-D-002")?.death).toBe("proposed");
    expect(orphans.find((o) => o.key === "REQ-O-001")?.death).toBe("none");
  });
});

// REQ-SYNC-014 / REQ-SYNC-015 — the two conditions for closing, and the refusal
// that carries the evidence.
describe("classifyOrphans", () => {
  const orphan = (death: DeathSignal): OrphanedLink => ({
    capability: "demo",
    key: "REQ-D-002",
    link: link("2"),
    death,
  });

  async function refusal(
    orphans: OrphanedLink[],
    states: SyncItemState[],
    adapter: BoardAdapter,
  ): Promise<UndeclaredOrphanError> {
    const classified = await classifyOrphans(orphans, states, adapter);
    try {
      assertNoUnsanctionedOrphans(classified);
    } catch (cause) {
      return cause as UndeclaredOrphanError;
    }
    throw new Error("expected a refusal and got none");
  }

  it("closes a declared death whose body did not reappear", async () => {
    const classified = await classifyOrphans(
      [orphan("declared")],
      [state("REQ-D-003", "a different body")],
      adapterReturning({ "2": snapshot("2", "the orphan body") }),
    );
    expect(classified[0]?.disposition).toBe("close");
    expect(() => {
      assertNoUnsanctionedOrphans(classified);
    }).not.toThrow();
  });

  // The change `declared-orphan-and-pending-retirement` correction. `REMOVED: REQ-D-002` plus `ADDED: REQ-D-003` with
  // the same body is how a rename of an already realized requirement is
  // written, because the delta has no other vocabulary for it — so the
  // declaration does not distinguish a death from a rename, and the body does.
  it("refuses a declared death whose body reappeared, and names both", async () => {
    const error = await refusal(
      [orphan("declared")],
      [state("REQ-D-003", "the same body")],
      adapterReturning({ "2": snapshot("2", "the same body") }),
    );
    expect(error).toBeInstanceOf(UndeclaredOrphanError);
    expect(error.exitCode).toBe(2);
    expect(error.orphans[0]?.declared).toBe(true);
    expect(error.orphans[0]?.candidates).toEqual(["REQ-D-003"]);
    expect(error.message).toContain("REQ-D-002");
    expect(error.message).toContain("REQ-D-003");
    expect(error.message).toContain("listed as retired");
  });

  it("refuses an undeclared orphan with exit code 2", async () => {
    const error = await refusal(
      [orphan("none")],
      [],
      adapterReturning({ "2": snapshot("2", "body") }),
    );
    expect(error).toBeInstanceOf(UndeclaredOrphanError);
    expect(error.exitCode).toBe(2);
  });

  // The body is what a rename does not touch. The title is derived from the
  // identifier, so comparing whole projections would never match here.
  it("names an unlinked item with the same body as a probable rename", async () => {
    const error = await refusal(
      [orphan("none")],
      [state("REQ-D-003", "the same body")],
      adapterReturning({ "2": snapshot("2", "the same body") }),
    );

    expect(error.orphans[0]?.candidates).toEqual(["REQ-D-003"]);
    expect(error.message).toContain("REQ-D-003");
    expect(error.message).toContain("probably a rename");
  });

  it("lists every candidate and chooses none", async () => {
    const error = await refusal(
      [orphan("none")],
      [state("REQ-D-003", "same"), state("REQ-D-004", "same")],
      adapterReturning({ "2": snapshot("2", "same") }),
    );
    expect(error.orphans[0]?.candidates).toEqual(["REQ-D-003", "REQ-D-004"]);
  });

  it("ignores an item that already has its own link", async () => {
    const error = await refusal(
      [orphan("none")],
      [state("REQ-D-003", "same", true)],
      adapterReturning({ "2": snapshot("2", "same") }),
    );
    expect(error.orphans[0]?.candidates).toEqual([]);
  });

  it("still refuses when no candidate matches", async () => {
    const error = await refusal(
      [orphan("none")],
      [state("REQ-D-003", "different body")],
      adapterReturning({ "2": snapshot("2", "the orphan body") }),
    );
    expect(error.orphans[0]?.candidates).toEqual([]);
    expect(error.message).toContain("Nothing was written");
  });

  it("names the ways out, including the one for a body that reappeared", async () => {
    const error = await refusal(
      [orphan("none")],
      [],
      adapterReturning({ "2": snapshot("2", "b") }),
    );
    expect(error.message).toContain("rename the key");
    expect(error.message).toContain("retired");
    expect(error.message).toContain("close the item on the board yourself");
  });

  // A 404 is the only thing that makes `read` return undefined, so this is a
  // verified absence and not an unverified one. A card that is not there has no
  // body to reappear.
  it("falls back to the declaration when the board item is gone", async () => {
    const classified = await classifyOrphans(
      [orphan("declared")],
      [state("REQ-D-003", "same")],
      adapterReturning({}),
    );
    expect(classified[0]?.candidates).toEqual([]);
    expect(classified[0]?.disposition).toBe("close");
  });

  // REQ-SYNC-016 — the third branch, and the two ways it must not collapse.
  it("leaves a proposed death alone", async () => {
    const classified = await classifyOrphans(
      [orphan("proposed")],
      [state("REQ-D-003", "a different body")],
      adapterReturning({ "2": snapshot("2", "the orphan body") }),
    );
    expect(classified[0]?.disposition).toBe("leave");
    expect(() => {
      assertNoUnsanctionedOrphans(classified);
    }).not.toThrow();
  });

  it("still refuses a proposed death whose body reappeared", async () => {
    const error = await refusal(
      [orphan("proposed")],
      [state("REQ-D-003", "the same body")],
      adapterReturning({ "2": snapshot("2", "the same body") }),
    );
    expect(error.orphans[0]?.declared).toBe(false);
    expect(error.orphans[0]?.candidates).toEqual(["REQ-D-003"]);
  });

  it("does not touch the board when there is no orphan at all", async () => {
    const exploding: BoardAdapter = {
      ...adapterReturning({}),
      read: () => Promise.reject(new Error("must not be read")),
    };
    await expect(classifyOrphans([], [], exploding)).resolves.toEqual([]);
  });
});

describe("bodyKey", () => {
  it("survives the whitespace a board round trip adds", () => {
    expect(bodyKey("one\ntwo")).toBe(bodyKey("one\r\ntwo\r\n  "));
  });

  it("separates genuinely different bodies", () => {
    expect(bodyKey("one")).not.toBe(bodyKey("two"));
  });
});
