import { describe, expect, it } from "vitest";
import type {
  BoardAdapter,
  BoardItemSnapshot,
} from "../../src/sync/adapter.js";
import { UndeclaredOrphanError } from "../../src/sync/errors.js";
import {
  assertNoUndeclaredOrphans,
  bodyKey,
  findOrphanedLinks,
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
    expect(orphans.map((o) => [o.key, o.declared])).toEqual([
      ["REQ-D-002", true],
    ]);
  });

  it("marks an orphan undeclared when nothing says it died", () => {
    const orphans = findOrphanedLinks(
      [planned("REQ-D-001")],
      links,
      new Map([["demo", []]]),
    );
    expect(orphans.map((o) => [o.key, o.declared])).toEqual([
      ["REQ-D-002", false],
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
    expect(orphans.find((o) => o.key === "REQ-D-002")?.declared).toBe(true);
    expect(orphans.find((o) => o.key === "REQ-O-001")?.declared).toBe(false);
  });
});

// REQ-SYNC-015 — An undeclared orphan stops the command and names the candidate.
describe("assertNoUndeclaredOrphans", () => {
  const orphan = (declared: boolean): OrphanedLink => ({
    capability: "demo",
    key: "REQ-D-002",
    link: link("2"),
    declared,
  });

  it("lets a declared death through", async () => {
    await expect(
      assertNoUndeclaredOrphans([orphan(true)], [], adapterReturning({})),
    ).resolves.toBeUndefined();
  });

  it("refuses an undeclared orphan with exit code 2", async () => {
    const error = await assertNoUndeclaredOrphans(
      [orphan(false)],
      [],
      adapterReturning({ "2": snapshot("2", "body") }),
    ).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(UndeclaredOrphanError);
    expect((error as { exitCode: number }).exitCode).toBe(2);
  });

  // The body is what a rename does not touch. The title is derived from the
  // identifier, so comparing whole projections would never match here.
  it("names an unlinked item with the same body as a probable rename", async () => {
    const error = (await assertNoUndeclaredOrphans(
      [orphan(false)],
      [state("REQ-D-003", "the same body")],
      adapterReturning({ "2": snapshot("2", "the same body") }),
    ).catch((cause: unknown) => cause)) as UndeclaredOrphanError;

    expect(error.orphans[0]?.candidates).toEqual(["REQ-D-003"]);
    expect(error.message).toContain("REQ-D-003");
    expect(error.message).toContain("probably a rename");
  });

  it("lists every candidate and chooses none", async () => {
    const error = (await assertNoUndeclaredOrphans(
      [orphan(false)],
      [state("REQ-D-003", "same"), state("REQ-D-004", "same")],
      adapterReturning({ "2": snapshot("2", "same") }),
    ).catch((cause: unknown) => cause)) as UndeclaredOrphanError;
    expect(error.orphans[0]?.candidates).toEqual(["REQ-D-003", "REQ-D-004"]);
  });

  it("ignores an item that already has its own link", async () => {
    const error = (await assertNoUndeclaredOrphans(
      [orphan(false)],
      [state("REQ-D-003", "same", true)],
      adapterReturning({ "2": snapshot("2", "same") }),
    ).catch((cause: unknown) => cause)) as UndeclaredOrphanError;
    expect(error.orphans[0]?.candidates).toEqual([]);
  });

  it("still refuses when no candidate matches", async () => {
    const error = (await assertNoUndeclaredOrphans(
      [orphan(false)],
      [state("REQ-D-003", "different body")],
      adapterReturning({ "2": snapshot("2", "the orphan body") }),
    ).catch((cause: unknown) => cause)) as UndeclaredOrphanError;
    expect(error.orphans[0]?.candidates).toEqual([]);
    expect(error.message).toContain("Nothing was written");
  });

  it("names both ways out", async () => {
    const error = (await assertNoUndeclaredOrphans(
      [orphan(false)],
      [],
      adapterReturning({ "2": snapshot("2", "b") }),
    ).catch((cause: unknown) => cause)) as Error;
    expect(error.message).toContain("rename the key");
    expect(error.message).toContain("retired");
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
