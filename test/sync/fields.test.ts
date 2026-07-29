import { describe, expect, it } from "vitest";
import type {
  BoardAdapter,
  BoardFieldDefinition,
} from "../../src/sync/adapter.js";
import {
  FieldDefinitionsUnavailableError,
  BoardRefusedError,
} from "../../src/sync/errors.js";
import {
  bindFields,
  loadFieldBindings,
  valuesFor,
} from "../../src/sync/fields.js";

const DEFINITIONS: BoardFieldDefinition[] = [
  { id: 1, name: "Cliente", format: "string", required: true, multiple: false },
  { id: 2, name: "Sprint", format: "list", required: false, multiple: false },
  { id: 3, name: "Times", format: "list", required: false, multiple: true },
];

function adapterThatCannotDescribe(cause: Error): BoardAdapter {
  return {
    provider: "test",
    create: () => Promise.reject(new Error("not used")),
    update: () => Promise.reject(new Error("not used")),
    link: () => Promise.reject(new Error("not used")),
    close: () => Promise.reject(new Error("not used")),
    read: () => Promise.resolve(undefined),
    describeFields: () => Promise.reject(cause),
  };
}

// REQ-SYNC-009 — A field is named by id and by name, and divergence is a
// conflict.
describe("bindFields", () => {
  it("resolves by id alone", () => {
    expect(bindFields([{ id: 1 }], DEFINITIONS)[0]?.name).toBe("Cliente");
  });

  it("resolves by name alone", () => {
    expect(bindFields([{ name: "Sprint" }], DEFINITIONS)[0]?.id).toBe(2);
  });

  it("resolves by id when both agree", () => {
    const bound = bindFields([{ id: 3, name: "Times" }], DEFINITIONS)[0];
    expect(bound?.id).toBe(3);
    expect(bound?.multiple).toBe(true);
  });

  it("refuses when id and name disagree, showing both values", () => {
    expect(() =>
      bindFields([{ id: 1, name: "Sprint" }], DEFINITIONS),
    ).toThrowError(/configured as "Sprint".*reports "Cliente"/s);
  });

  it("refuses a field the board does not report", () => {
    expect(() => bindFields([{ name: "Nowhere" }], DEFINITIONS)).toThrowError(
      /does not report/,
    );
  });

  it("refuses an entry that identifies nothing", () => {
    expect(() => bindFields([{ constant: "x" }], DEFINITIONS)).toThrowError(
      /neither "id" nor "name"/,
    );
  });
});

// REQ-SYNC-010 — Unreadable field definitions refuse, never assume.
describe("loadFieldBindings", () => {
  it("never asks the board when the configuration declares no field", async () => {
    let asked = false;
    const adapter = adapterThatCannotDescribe(
      new Error("should not be called"),
    );
    const spy: BoardAdapter = {
      ...adapter,
      describeFields: () => {
        asked = true;
        return Promise.resolve([]);
      },
    };
    await expect(loadFieldBindings(spy, [])).resolves.toEqual([]);
    expect(asked).toBe(false);
  });

  it("refuses with a diagnostic rather than assuming a format", async () => {
    const adapter = adapterThatCannotDescribe(
      new FieldDefinitionsUnavailableError("admin-only endpoint", [], 403),
    );
    await expect(
      loadFieldBindings(adapter, [{ name: "Cliente" }]),
    ).rejects.toBeInstanceOf(FieldDefinitionsUnavailableError);
  });

  it("distinguishes could-not-check from field-absent in the message", async () => {
    const adapter = adapterThatCannotDescribe(
      new BoardRefusedError("/custom_fields.json", 403, ""),
    );
    await expect(
      loadFieldBindings(adapter, [{ name: "Cliente" }]),
    ).rejects.toThrowError(/not the same as those fields being absent/);
  });

  it("carries exit code 2, never 1", async () => {
    const adapter = adapterThatCannotDescribe(new Error("boom"));
    await loadFieldBindings(adapter, [{ name: "Cliente" }]).catch(
      (error: unknown) => {
        expect((error as { exitCode: number }).exitCode).toBe(2);
      },
    );
  });
});

describe("valuesFor", () => {
  it("keeps the empty shape each field format expects", () => {
    const bound = bindFields([{ id: 1 }, { id: 3 }], DEFINITIONS);
    const values = valuesFor(bound, {
      capability: "sync",
      requirementId: "REQ-SYNC-001",
      title: "t",
      level: "requirement",
    });
    expect(values[0]?.value).toBeNull();
    expect(values[1]?.value).toEqual([]);
  });

  it("writes a constant into a required field the spec has no source for", () => {
    const bound = bindFields([{ id: 1, constant: "ACME" }], DEFINITIONS);
    expect(
      valuesFor(bound, {
        capability: "sync",
        requirementId: "REQ-SYNC-001",
        title: "t",
        level: "requirement",
      })[0]?.value,
    ).toBe("ACME");
  });

  it("takes a value from the spec when told where to look", () => {
    const bound = bindFields(
      [{ id: 2, from: "requirement_id" as const }],
      DEFINITIONS,
    );
    expect(
      valuesFor(bound, {
        capability: "sync",
        requirementId: "REQ-SYNC-001",
        title: "t",
        level: "requirement",
      })[0]?.value,
    ).toBe("REQ-SYNC-001");
  });
});
