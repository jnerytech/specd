import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStatement } from "../../src/ears/parse.js";
import { loadCapabilities } from "../../src/parser/capability.js";
import { hasErrors } from "../../src/parser/diagnostics.js";

const SPECS_DIR = join(import.meta.dirname, "..", "..", ".specd", "specs");
const ctx = { file: "spec.md", line: 12, requirementId: "REQ-AUTH-003" };

function parse(text: string): ReturnType<typeof parseStatement> {
  return parseStatement(text, ctx);
}

function message(result: ReturnType<typeof parseStatement>): string {
  return result.diagnostics.map((d) => d.message).join("\n");
}

// REQ-EARS-001 — Five accepted patterns
// REQ-EARS-002 — Keywords are syntax, not prose: every case below writes its
// prose in Portuguese and its keywords in English.
describe("the five patterns", () => {
  it("accepts ubiquitous", () => {
    const { statement, diagnostics } = parse(
      "The specd verifier SHALL rejeitar âncoras penduradas.",
    );
    expect(diagnostics).toEqual([]);
    expect(statement?.pattern).toBe("ubiquitous");
    expect(statement?.subject).toBe("The specd verifier");
    expect(statement?.response).toBe("rejeitar âncoras penduradas.");
    expect(statement?.condition).toBeUndefined();
  });

  it("accepts event-driven", () => {
    const { statement, diagnostics } = parse(
      "WHEN a change é arquivada, the specd verifier SHALL revalidar as âncoras.",
    );
    expect(diagnostics).toEqual([]);
    expect(statement?.pattern).toBe("event-driven");
    expect(statement?.condition).toBe("a change é arquivada");
    expect(statement?.subject).toBe("the specd verifier");
  });

  it("accepts state-driven", () => {
    const { statement, diagnostics } = parse(
      "WHILE a coleta está em andamento, the specd explore command SHALL gravar o manifest.",
    );
    expect(diagnostics).toEqual([]);
    expect(statement?.pattern).toBe("state-driven");
    expect(statement?.condition).toBe("a coleta está em andamento");
  });

  it("accepts unwanted-behaviour", () => {
    const { statement, diagnostics } = parse(
      "IF a âncora está ambígua, THEN specd SHALL sair com diagnóstico.",
    );
    expect(diagnostics).toEqual([]);
    expect(statement?.pattern).toBe("unwanted-behaviour");
    expect(statement?.condition).toBe("a âncora está ambígua");
    expect(statement?.subject).toBe("specd");
  });

  it("accepts optional-feature", () => {
    const { statement, diagnostics } = parse(
      "WHERE a política é `graduated`, the specd verifier SHALL emitir aviso.",
    );
    expect(diagnostics).toEqual([]);
    expect(statement?.pattern).toBe("optional-feature");
    expect(statement?.condition).toBe("a política é `graduated`");
  });

  it("accepts the terse forms of the acceptance criteria", () => {
    expect(parse("The X SHALL Y").statement?.pattern).toBe("ubiquitous");
    expect(parse("WHEN a the X SHALL Y").statement?.pattern).toBe(
      "event-driven",
    );
    expect(parse("WHILE a the X SHALL Y").statement?.pattern).toBe(
      "state-driven",
    );
    expect(parse("IF a THEN the X SHALL Y").statement?.pattern).toBe(
      "unwanted-behaviour",
    );
    expect(parse("WHERE a the X SHALL Y").statement?.pattern).toBe(
      "optional-feature",
    );
  });

  it("records SHALL NOT as a negated obligation", () => {
    const { statement } = parse("The specd CLI SHALL NOT acessar a rede.");
    expect(statement?.negated).toBe(true);
    expect(statement?.response).toBe("acessar a rede.");
  });

  it("splits on the last comma so a condition may contain one", () => {
    const { statement } = parse(
      "WHEN o arquivo existe, mas o símbolo sumiu, the specd resolver SHALL sugerir o novo local.",
    );
    expect(statement?.condition).toBe("o arquivo existe, mas o símbolo sumiu");
    expect(statement?.subject).toBe("the specd resolver");
  });
});

// REQ-EARS-002 — Keywords are syntax, not prose
describe("translated keywords", () => {
  it.each([
    ["QUANDO a change é arquivada, the X SHALL Y", "QUANDO", "WHEN"],
    ["The X DEVE fazer Y", "DEVE", "SHALL"],
    ["SE a âncora falha, ENTAO the X SHALL Y", "SE", "IF"],
  ])("rejects %s", (text, word, keyword) => {
    const result = parse(text);
    expect(result.statement).toBeUndefined();
    expect(message(result)).toContain(`uses "${word}"`);
    expect(message(result)).toContain(`"${keyword}"`);
    expect(message(result)).toContain("syntax, not prose");
  });

  it("does not flag a lowercase word that happens to be a keyword", () => {
    // "se" is an ordinary Portuguese pronoun; only an all-caps token is a
    // keyword slot.
    const { statement } = parse(
      "The specd verifier SHALL reprovar quando a âncora se perde.",
    );
    expect(statement?.pattern).toBe("ubiquitous");
  });
});

// REQ-EARS-004 — Missing SHALL is rejected
describe("missing SHALL", () => {
  it("rejects a descriptive statement and lists the five patterns", () => {
    const result = parse("The specd verifier reads anchors from the spec.");
    expect(result.statement).toBeUndefined();
    const text = message(result);
    expect(text).toContain('contains no "SHALL"');
    for (const template of [
      "The <system> SHALL <response>",
      "WHEN <trigger>, the <system> SHALL <response>",
      "WHILE <state>, the <system> SHALL <response>",
      "IF <condition>, THEN the <system> SHALL <response>",
      "WHERE <feature>, the <system> SHALL <response>",
    ]) {
      expect(text).toContain(template);
    }
  });

  it("does not accept a lowercase shall", () => {
    expect(parse("The X shall Y").statement).toBeUndefined();
  });
});

// REQ-EARS-003 — Single behaviour per requirement
describe("multiple SHALL clauses", () => {
  it("rejects two clauses and suggests splitting the requirement", () => {
    const result = parse(
      "The specd verifier SHALL execute layers in order and SHALL stop at the first failure.",
    );
    expect(result.statement).toBeUndefined();
    expect(message(result)).toContain('contains 2 "SHALL" clauses');
    expect(message(result)).toContain("Split it into separate requirements");
  });

  it("counts SHALL NOT as one clause", () => {
    expect(
      parse("The specd CLI SHALL NOT acessar a rede.").statement,
    ).toBeDefined();
  });

  it("does not count a SHALL quoted as inline code", () => {
    const { statement } = parse(
      "The specd EARS parser SHALL reject any statement that does not contain the keyword `SHALL`.",
    );
    expect(statement?.pattern).toBe("ubiquitous");
  });
});

// REQ-EARS-005 — Pattern is reported
describe("pattern on the requirement model", () => {
  const { capabilities, diagnostics } = loadCapabilities(SPECS_DIR);

  it("every statement of this repository parses", () => {
    const failures = diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => `${d.file}:${d.line} ${d.message.split("\n")[0]}`);
    expect(failures).toEqual([]);
    expect(hasErrors(diagnostics)).toBe(false);
  });

  it("carries the identified pattern on every requirement", () => {
    const requirements = capabilities.flatMap((c) => c.requirements);
    expect(requirements.filter((r) => r.ears === undefined)).toEqual([]);
  });

  it("allows aggregating requirements by pattern", () => {
    const counts = new Map<string, number>();
    for (const capability of capabilities) {
      for (const requirement of capability.requirements) {
        const pattern = requirement.ears?.pattern ?? "none";
        counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
      }
    }
    expect(counts.get("ubiquitous")).toBeGreaterThan(0);
    expect(counts.get("event-driven")).toBeGreaterThan(0);
    expect(counts.get("unwanted-behaviour")).toBeGreaterThan(0);
    expect(counts.get("optional-feature")).toBeGreaterThan(0);
    expect(counts.get("none")).toBeUndefined();
  });
});
