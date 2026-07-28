import { describe, expect, it } from "vitest";
import { parseCardRef } from "../../src/explore/card-ref.js";

// REQ-EXP-001 — Card identifier or URL
describe("parseCardRef", () => {
  it("resolves a bare identifier using board.project", () => {
    expect(
      parseCardRef("ABC-42", { project: "acme", provider: "jira" }),
    ).toEqual({ id: "ABC-42", project: "acme", provider: "jira" });
  });

  it("leaves the project absent when configuration has none", () => {
    expect(parseCardRef("ABC-42")).toEqual({ id: "ABC-42" });
  });

  it("extracts provider and identifier from a URL", () => {
    const ref = parseCardRef("https://github.com/acme/specd/issues/42");
    expect(ref.provider).toBe("github");
    expect(ref.id).toBe("42");
    expect(ref.url).toBe("https://github.com/acme/specd/issues/42");
  });

  it("takes the project from the address, not from configuration", () => {
    const ref = parseCardRef("https://github.com/acme/specd/issues/42", {
      project: "ignored",
    });
    expect(ref.project).toBe("specd");
  });

  it("keeps an unknown host as the provider", () => {
    const ref = parseCardRef("https://board.internal/tickets/T-9");
    expect(ref.provider).toBe("board.internal");
    expect(ref.id).toBe("T-9");
  });

  it("keeps a slug identifier whole", () => {
    const ref = parseCardRef("https://linear.app/acme/issue/ENG-7-fix-login");
    expect(ref.provider).toBe("linear");
    expect(ref.id).toBe("ENG-7-fix-login");
  });

  it("falls back to the query string when the path names no card", () => {
    const ref = parseCardRef("https://board.internal/browse?card=ABC-1");
    expect(ref.id).toBe("ABC-1");
  });

  it("rejects an empty reference", () => {
    expect(() => parseCardRef("  ")).toThrow(/empty/);
  });
});
