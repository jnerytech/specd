import { describe, expect, it } from "vitest";
import { redactPayload } from "../../src/explore/redact.js";

// REQ-EXP-005 — Redaction before persistence
describe("redactPayload", () => {
  it("removes a top-level field", () => {
    expect(redactPayload({ id: 1, token: "secret" }, ["token"])).toEqual({
      id: 1,
    });
  });

  it("removes a nested field path", () => {
    const payload = { card: { id: 1, owner: { name: "ada", email: "a@b.c" } } };
    expect(redactPayload(payload, ["card.owner.email"])).toEqual({
      card: { id: 1, owner: { name: "ada" } },
    });
  });

  it("removes the field on every element of an array", () => {
    const payload = {
      items: [
        { id: 1, email: "a@b.c" },
        { id: 2, email: "d@e.f" },
      ],
    };
    expect(redactPayload(payload, ["items.email"])).toEqual({
      items: [{ id: 1 }, { id: 2 }],
    });
  });

  it("leaves the payload untouched when the path is absent", () => {
    const payload = { id: 1 };
    expect(redactPayload(payload, ["nope.deeper"])).toEqual({ id: 1 });
  });

  it("does not mutate the input", () => {
    const payload = { card: { token: "secret" } };
    redactPayload(payload, ["card.token"]);
    expect(payload.card.token).toBe("secret");
  });

  it("applies every listed path", () => {
    const payload = { a: 1, b: 2, c: 3 };
    expect(redactPayload(payload, ["a", "c"])).toEqual({ b: 2 });
  });
});
