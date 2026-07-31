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

  it("keeps one rule about an open task, and says the CLI does not enforce it", () => {
    expect(archive).toContain("pré-condição dura, não pergunta");
    expect(archive).not.toMatch(/task ficou `pending`/);
    expect(archive).toContain("O CLI não impõe isso");
  });

  it("leaves out what matches the record", () => {
    expect(archive).toMatch(
      /Fica de fora o requisito id\u00eantico ao registro/,
    );
  });

  it("stops the archive and asks, instead of rewriting the anchor", () => {
    expect(archive).toContain("para o arquivamento");
    expect(archive).toMatch(/n\u00e3o reescreve \u00e2ncora/);
  });
});

// REQ-SKL-009 — no other skill of the cycle writes the record.
describe("apply never touches the record — REQ-SKL-009", () => {
  const apply = skill("specd-apply-change");

  it("forbids writing the propose record", () => {
    expect(apply).toContain("Nunca toque no `propose.json`");
    expect(apply).toContain("recorte dar vazio sempre");
  });
});

// REQ-SKL-009 — the proposal leaves the record by running the command.
describe("propose leaves the record — REQ-SKL-009", () => {
  const propose = skill("specd-propose");

  it("runs the command instead of assembling the file", () => {
    expect(propose).toContain("specd propose-record --change");
    expect(propose).toMatch(/N\u00e3o monte esse arquivo \u00e0 m\u00e3o/);
  });

  it("names what a transcription error would cost", () => {
    expect(propose).toContain("recorte vazio");
    expect(propose).toContain("direção perigosa");
  });

  it("closes the rewrite window when the implementation starts", () => {
    expect(propose).toMatch(/enquanto toda task est\u00e1 `pending`/);
    expect(propose).toMatch(/o comando \*\*recusa\*\*/);
  });

  it("writes it after the tasks, and says why the command demands them", () => {
    expect(propose).toMatch(/Depois do passo 4/);
    expect(propose).toContain("ausência de task não prova");
  });
});

// REQ-SKL-008 — the cut is read from the record, and its absence is declared.
describe("archive reads the cut from the record — REQ-SKL-008", () => {
  const archive = skill("specd-archive-change");

  it("names the record as the source of the cut", () => {
    expect(archive).toContain("propose.json");
    expect(archive).toMatch(/O recorte \u00e9 \*\*lido\*\*, n\u00e3o deduzido/);
  });

  it("keeps the three entries, stated against the record", () => {
    expect(archive).toContain("diferem do registrado");
    expect(archive).toContain("ausente do registro");
    expect(archive).toContain("registro anotou pendurada");
  });

  it("treats an unreadable record like an absent one", () => {
    expect(archive).toContain("ilegível ou de versão que você não conhece");
    expect(archive).toContain("ausência de marco\nlegível");
  });

  it("declares the wide cut when no record exists, out loud", () => {
    expect(archive).toMatch(/Sem `propose\.json` na change/);
    expect(archive).toContain("largo por ausência de marco");
    expect(archive).toContain("vestido de verde");
  });
});

// REQ-SKL-010 — a board with nothing collected stops the exploring skill.
describe("nothing collected with a board stops explore — REQ-SKL-010", () => {
  const explore = skill("specd-explore");

  it("stops on `collected: none` when a board is configured", () => {
    expect(explore).toMatch(/Com board configurado e `collected: none`, pare/);
  });

  it("says the stop holds even though the command exited 0", () => {
    expect(explore).toContain("mesmo que o comando tenha\nsaído 0");
    expect(explore).toContain("vacuamente verdadeiro");
  });

  it("distinguishes nothing declared from declared and failed", () => {
    expect(explore).toContain("nenhuma fonte declarada");
    expect(explore).toContain("as declaradas falharam");
  });

  it("forbids declaring a source on its own, and asks instead", () => {
    expect(explore).toMatch(/N\u00e3o declare fonte por conta pr\u00f3pria/);
    expect(explore).toContain("ferramenta de pergunta do host");
  });

  it("does not stop without a board", () => {
    expect(explore).toMatch(
      /Sem board configurado, `collected: none` n\u00e3o para nada/,
    );
  });
});
