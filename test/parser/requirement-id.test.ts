import { describe, expect, it } from "vitest";
import {
  REQ_ID_PATTERN,
  isPrefixAbbreviationOf,
  isValidRequirementId,
  prefixOf,
} from "../../src/parser/requirement-id.js";

// REQ-FMT-002 — Requirement identifier format
describe("requirement identifier", () => {
  it("accepts REQ-AUTH-003", () => {
    expect(isValidRequirementId("REQ-AUTH-003")).toBe(true);
    expect(REQ_ID_PATTERN.test("REQ-AUTH-003")).toBe(true);
  });

  it("rejects REQ-auth-3", () => {
    expect(isValidRequirementId("REQ-auth-3")).toBe(false);
  });

  it.each([
    "REQ-AUTH-3",
    "REQ-AUTH-0003",
    "req-auth-003",
    "REQ-3AUTH-003",
    "REQ--003",
    "AUTH-003",
    "REQ-AUTH-003 ",
  ])("rejects %s", (id) => {
    expect(isValidRequirementId(id)).toBe(false);
  });

  it("extracts the prefix of a valid identifier", () => {
    expect(prefixOf("REQ-AUTH-003")).toBe("AUTH");
    expect(prefixOf("REQ-auth-3")).toBeUndefined();
  });
});

// REQ-FMT-002 — the prefix need not equal the capability name; only a real
// divergence warns.
describe("prefix abbreviation", () => {
  it.each([
    ["ANC", "anchors"],
    ["CFG", "config"],
    ["FMT", "spec-format"],
    ["VER", "verify"],
    ["EXP", "explore"],
    ["CLI", "cli"],
    ["EARS", "ears"],
  ])("accepts %s for capability %s", (prefix, capability) => {
    expect(isPrefixAbbreviationOf(prefix, capability)).toBe(true);
  });

  it("rejects a prefix unrelated to the capability", () => {
    expect(isPrefixAbbreviationOf("AUTH", "billing")).toBe(false);
  });

  it("rejects letters that appear out of order", () => {
    expect(isPrefixAbbreviationOf("CNA", "anchors")).toBe(false);
  });
});
