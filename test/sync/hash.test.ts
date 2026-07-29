import { describe, expect, it } from "vitest";
import {
  normalizeProjection,
  projectContent,
  syncedHash,
} from "../../src/sync/hash.js";

// REQ-SYNC-004 — The hash is computed over a normalized projection.
describe("normalizeProjection", () => {
  it("drops null, empty string and empty array alike", () => {
    expect(
      normalizeProjection({
        kept: "value",
        nothing: null,
        blank: "",
        nowhere: [],
        absent: undefined,
      }),
    ).toEqual({ kept: "value" });
  });

  // The acceptance criterion that names the run 004 finding directly: Redmine
  // answers `null` for an unset single-valued field and `[]` for an unset
  // multi-valued one. Same field, two server shapes, one hash.
  it("gives an empty multi-valued field the same hash as an empty single one", () => {
    const single = syncedHash(normalizeProjection({ "field:1": null }));
    const multiple = syncedHash(normalizeProjection({ "field:1": [] }));
    expect(single).toBe(multiple);
  });

  it("gives the same hash regardless of key order", () => {
    const a = syncedHash(normalizeProjection({ title: "x", body: "y" }));
    const b = syncedHash(normalizeProjection({ body: "y", title: "x" }));
    expect(a).toBe(b);
  });

  // Value order inside a multi-valued field is content, not presentation.
  it("keeps the order of a multi-valued field", () => {
    const a = syncedHash(normalizeProjection({ "field:3": ["a", "b"] }));
    const b = syncedHash(normalizeProjection({ "field:3": ["b", "a"] }));
    expect(a).not.toBe(b);
    expect(normalizeProjection({ "field:3": ["a", "b"] })).toEqual({
      "field:3": ["a", "b"],
    });
  });

  it("treats a CRLF round trip and trailing whitespace as no change", () => {
    const sent = syncedHash(normalizeProjection({ body: "one\ntwo" }));
    const returned = syncedHash(
      normalizeProjection({ body: "one\r\ntwo\r\n  " }),
    );
    expect(sent).toBe(returned);
  });

  it("drops the empty entries of an array and the array once it is empty", () => {
    expect(normalizeProjection({ tags: ["a", "", "b"] })).toEqual({
      tags: ["a", "b"],
    });
    expect(normalizeProjection({ tags: ["", "  "] })).toEqual({});
  });
});

describe("projectContent", () => {
  it("keys custom fields by id, so a rename on the board does not move the hash", () => {
    const before = projectContent({
      title: "t",
      body: "b",
      fields: [{ id: 1, name: "Cliente", value: "ACME" }],
    });
    const after = projectContent({
      title: "t",
      body: "b",
      fields: [{ id: 1, name: "Customer", value: "ACME" }],
    });
    expect(syncedHash(before)).toBe(syncedHash(after));
  });

  it("carries the parent by identifier and nothing else about it", () => {
    const projection = projectContent({
      title: "t",
      body: "b",
      parent: { id: "7", url: "http://example.invalid/issues/7" },
      fields: [],
    });
    expect(projection).toEqual({ title: "t", body: "b", parent: "7" });
  });
});
