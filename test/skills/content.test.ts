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
