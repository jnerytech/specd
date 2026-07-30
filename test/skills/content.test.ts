import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SKILL_FILE,
  SKILL_MANIFEST,
  packagedSkillsPath,
} from "../../src/init/skills.js";

function skill(name: string): string {
  return readFileSync(join(packagedSkillsPath(), name, SKILL_FILE), "utf8");
}

// The steps that need the effective spec. `specd-archive-change` does not: it
// hands a change to `specd archive`, which computes the overlay itself.
const READS_THE_SPEC = ["specd-explore", "specd-propose", "specd-apply-change"];

// The steps that talk to the board. `specd-apply-change` deliberately does not:
// the board receives intent and result, not the noise of execution.
const TALKS_TO_THE_BOARD = [
  "specd-explore",
  "specd-propose",
  "specd-archive-change",
];

// REQ-SKL-004 — A skill reads the spec through the CLI.
describe("skills read the spec through the CLI — REQ-SKL-004", () => {
  it("cites `specd spec --json` wherever the effective spec is needed", () => {
    for (const name of READS_THE_SPEC) {
      expect(skill(name)).toContain("specd spec --json");
    }
  });

  it("forbids rebuilding the overlay in so many words", () => {
    for (const name of READS_THE_SPEC) {
      expect(skill(name)).toMatch(/Nunca (leia|reconstrua)/);
      expect(skill(name)).toMatch(/overlay/);
    }
  });
});

// REQ-SKL-005 — A decision goes to the author through the question tool.
describe("skills ask instead of choosing — REQ-SKL-005", () => {
  it("names the host's question tool in every skill", () => {
    for (const { name } of SKILL_MANIFEST) {
      expect(skill(name)).toContain("ferramenta de pergunta do host");
    }
  });

  it("gives every skill a section listing what stops the cycle", () => {
    for (const { name } of SKILL_MANIFEST) {
      expect(skill(name)).toContain("## Quando parar e perguntar");
    }
  });

  it("never instructs picking the most likely candidate", () => {
    for (const { name } of SKILL_MANIFEST) {
      expect(skill(name)).not.toMatch(/escolha o (mais|candidato)/i);
      expect(skill(name)).not.toMatch(/assuma o mais provável/i);
    }
  });
});

// REQ-SKL-006 — A configured board that cannot be reached stops the skill.
describe("an unreachable board stops the skill — REQ-SKL-006", () => {
  it("declares the stop in every step that talks to the board", () => {
    for (const name of TALKS_TO_THE_BOARD) {
      expect(skill(name)).toMatch(/inalcançável/);
      expect(skill(name)).toMatch(/\*\*[Pp]are\*\*|\bPare\b/);
    }
  });

  it("never offers falling back to the boardless mode", () => {
    for (const name of TALKS_TO_THE_BOARD) {
      expect(skill(name)).toMatch(/[Nn]ão (caia|proponha|arquive)/);
    }
  });

  it("says the mode is read from the configuration, not inferred", () => {
    expect(skill("specd-explore")).toMatch(/nunca da aparência|nunca conclua/i);
  });
});

// REQ-SKL-007 — the proposing skill reviews every statement it writes.
describe("propose reviews the statements it writes — REQ-SKL-007", () => {
  const propose = skill("specd-propose");

  it("checks that a statement carries one subject", () => {
    expect(propose).toMatch(/Um assunto\?/);
    expect(propose).toMatch(/Um `SHALL` por statement/);
  });

  it("checks the quantification against the reach of the anchors", () => {
    expect(propose).toMatch(
      /quantifica\u00e7\u00e3o cabe no alcance da \u00e2ncora/i,
    );
    expect(propose).toContain("afirma quatro coisas e verifica uma");
  });

  it("checks that every acceptance criterion could be tested", () => {
    expect(propose).toMatch(/Todo crit\u00e9rio tem teste poss\u00edvel\?/);
  });

  it("declares how a requirement about skill behaviour satisfies that check", () => {
    expect(propose).toContain("Requisito sobre comportamento de skill é a");
    expect(propose).toContain("no-llm-in-decision-path");
    expect(propose).toMatch(
      /n\u00e3o reprove o\s+requisito por ser o que \u00e9/,
    );
  });

  it("sends what it cannot decide to the author, and rewrites nothing", () => {
    expect(propose).toContain("ferramenta de pergunta do host");
    expect(propose).toMatch(/n\u00e3o reescreve enunciado/);
  });

  it("keeps the anchor question out of the proposal, where it has no answer", () => {
    expect(propose).toContain("o símbolo pode não existir");
    expect(propose).toContain("specd-archive-change");
  });
});

// REQ-SKL-008 — the archiving skill reviews what changed since the proposal.
describe("archive reviews what changed — REQ-SKL-008", () => {
  const archive = skill("specd-archive-change");

  it("asks whether the anchor realizes what the statement affirms", () => {
    expect(archive).toMatch(
      /a \u00e2ncora realiza o que o\s+statement afirma/i,
    );
  });

  it("takes in a requirement rewritten during the apply", () => {
    expect(archive).toContain("reescrito durante o apply");
  });

  it("takes in a requirement that did not exist at proposal time", () => {
    expect(archive).toContain("requisito que não existia no propose");
  });

  it("keeps one rule about an open task, and says the CLI does not enforce it", () => {
    expect(archive).toContain("pré-condição dura, não pergunta");
    expect(archive).not.toMatch(/task ficou `pending`/);
    expect(archive).toContain("O CLI não impõe isso");
  });

  it("takes in an anchor that went from dangling to resolved", () => {
    expect(archive).toContain("passou de pendurada a resolvida");
    expect(archive).toContain("declaração\n  inalterada");
  });

  it("leaves out what did not change", () => {
    expect(archive).toMatch(/Fica de fora o requisito que n\u00e3o mudou/);
  });

  it("stops the archive and asks, instead of rewriting the anchor", () => {
    expect(archive).toContain("para o arquivamento");
    expect(archive).toMatch(/n\u00e3o reescreve \u00e2ncora/);
  });
});
