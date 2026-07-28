import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadCapabilities,
  parseCapability,
} from "../../src/parser/capability.js";
import { hasErrors, type Diagnostic } from "../../src/parser/diagnostics.js";

const SPECS_DIR = join(import.meta.dirname, "..", "..", ".specd", "specs");

function frontmatter(capability = "auth"): string {
  return `---\ncapability: ${capability}\nretired: []\n---\n\n# ${capability}\n\n`;
}

function requirement(id = "REQ-AUTH-003", body?: string): string {
  return (
    `### ${id} — Title\n\n` +
    (body ??
      `**Statement.** The X SHALL Y.\n\n**Acceptance.**\n- criterion\n\n` +
        "```yaml anchors\n- file: src/x.ts\n```\n")
  );
}

function messages(diagnostics: Diagnostic[]): string {
  return diagnostics.map((d) => `${d.severity}: ${d.message}`).join("\n");
}

// The parser reads this very repository's capabilities without error.
//
// The list is derived from the directory rather than written out: `archive`
// arrived when `specd archive` created it, and a hardcoded list would have to
// be edited every time the tool does its job. What is worth asserting is that
// every file on disk parses and that the name inside matches the file.
describe("this repository's capabilities", () => {
  const { capabilities, diagnostics } = loadCapabilities(SPECS_DIR);

  it("parses every capability file with no diagnostics", () => {
    const onDisk = readdirSync(SPECS_DIR)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.replace(/\.md$/, ""))
      .sort();

    expect(messages(diagnostics)).toBe("");
    expect(capabilities.map((c) => c.name).sort()).toEqual(onDisk);
    expect(onDisk.length).toBeGreaterThan(0);
  });

  it("turns every `### REQ-…` heading into a requirement", () => {
    const ids = capabilities.flatMap((c) => c.requirements.map((r) => r.id));
    expect(ids).toContain("REQ-FMT-001");
    expect(ids).toContain("REQ-ANC-002");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries statement, acceptance and anchors for each requirement", () => {
    const spec = capabilities.find((c) => c.name === "spec-format");
    const fmt008 = spec?.requirements.find((r) => r.id === "REQ-FMT-008");
    expect(fmt008?.title).toBe("Anchors live on requirements");
    expect(fmt008?.statement).toContain("SHALL accept anchor declarations");
    expect(fmt008?.acceptance).toHaveLength(2);
    expect(fmt008?.anchors.map((a) => a.anchor)).toEqual([
      {
        file: "src/parser/anchors.ts",
        symbol: "export function parseAnchorBlock",
      },
    ]);
  });
});

// REQ-FMT-001 — Capability file layout
describe("frontmatter", () => {
  it("rejects a file without frontmatter", () => {
    const { capability, diagnostics } = parseCapability(
      `# auth\n\n### REQ-AUTH-003 — Title\n`,
      "auth.md",
    );
    expect(capability).toBeUndefined();
    expect(hasErrors(diagnostics)).toBe(true);
    expect(messages(diagnostics)).toContain("Missing YAML frontmatter");
  });

  it("rejects frontmatter without capability", () => {
    const { capability, diagnostics } = parseCapability(
      `---\nretired: []\n---\n\n# auth\n`,
      "auth.md",
    );
    expect(capability).toBeUndefined();
    expect(messages(diagnostics)).toContain('missing "capability"');
  });

  it("warns when retired is absent", () => {
    const { capability, diagnostics } = parseCapability(
      `---\ncapability: auth\n---\n\n# auth\n`,
      "auth.md",
    );
    expect(capability?.name).toBe("auth");
    expect(hasErrors(diagnostics)).toBe(false);
    expect(messages(diagnostics)).toContain('no "retired" list');
  });

  it("rejects a retired entry that is not a requirement identifier", () => {
    const { diagnostics } = parseCapability(
      `---\ncapability: auth\nretired: ["nope"]\n---\n\n# auth\n`,
      "auth.md",
    );
    expect(messages(diagnostics)).toContain('"retired" contains "nope"');
  });
});

// REQ-FMT-002 — Requirement identifier format
describe("requirement headings", () => {
  it("rejects an out-of-pattern identifier citing the expected pattern", () => {
    const { capability, diagnostics } = parseCapability(
      frontmatter() + requirement("REQ-auth-3"),
      "auth.md",
    );
    expect(capability?.requirements).toEqual([]);
    expect(hasErrors(diagnostics)).toBe(true);
    const message = messages(diagnostics);
    expect(message).toContain('Invalid requirement identifier "REQ-auth-3"');
    expect(message).toContain("^REQ-[A-Z][A-Z0-9]*-\\d{3}$");
  });

  it("warns when the prefix does not abbreviate the capability", () => {
    const { capability, diagnostics } = parseCapability(
      frontmatter("billing") + requirement("REQ-AUTH-003"),
      "billing.md",
    );
    expect(capability?.requirements.map((r) => r.id)).toEqual(["REQ-AUTH-003"]);
    expect(hasErrors(diagnostics)).toBe(false);
    expect(messages(diagnostics)).toContain(
      'uses prefix "AUTH", which does not abbreviate capability "billing"',
    );
  });

  it("ignores level-3 headings that do not claim to be requirements", () => {
    const { capability, diagnostics } = parseCapability(
      frontmatter() + `### Notes\n\nSome prose.\n` + requirement(),
      "auth.md",
    );
    expect(capability?.requirements.map((r) => r.id)).toEqual(["REQ-AUTH-003"]);
    expect(diagnostics).toEqual([]);
  });

  it("rejects a duplicate identifier", () => {
    const { capability, diagnostics } = parseCapability(
      frontmatter() + requirement() + requirement(),
      "auth.md",
    );
    expect(capability?.requirements).toHaveLength(1);
    expect(messages(diagnostics)).toContain("Duplicate requirement");
  });

  it("does not read headings inside a fenced block as requirements", () => {
    const source =
      frontmatter() +
      requirement() +
      "```md\n### REQ-AUTH-004 — Example in docs\n```\n";
    const { capability, diagnostics } = parseCapability(source, "auth.md");
    expect(capability?.requirements.map((r) => r.id)).toEqual(["REQ-AUTH-003"]);
    expect(diagnostics).toEqual([]);
  });
});

// REQ-FMT-003 — Requirements carry no status
describe("status on a requirement", () => {
  it.each(["status: done", "**Status.** done"])(
    "rejects a requirement declaring %s",
    (line) => {
      const { diagnostics } = parseCapability(
        frontmatter() +
          requirement(
            "REQ-AUTH-003",
            `**Statement.** The X SHALL Y.\n\n${line}\n`,
          ),
        "auth.md",
      );
      expect(hasErrors(diagnostics)).toBe(true);
      const message = messages(diagnostics);
      expect(message).toContain('declares a "status" field');
      expect(message).toContain("belongs to the task");
    },
  );

  it("does not flag prose that merely mentions status", () => {
    const { diagnostics } = parseCapability(
      frontmatter() +
        requirement(
          "REQ-AUTH-003",
          "**Statement.** The X SHALL Y.\n\n**Acceptance.**\n- `status` belongs to the task\n",
        ),
      "auth.md",
    );
    expect(hasErrors(diagnostics)).toBe(false);
  });
});

// REQ-FMT-008 — Anchors live on requirements
describe("anchor blocks in a capability", () => {
  it("warns and ignores a block declared outside a requirement", () => {
    const source =
      frontmatter() +
      "```yaml anchors\n- file: src/stray.ts\n```\n\n" +
      requirement();
    const { capability, diagnostics } = parseCapability(source, "auth.md");
    expect(hasErrors(diagnostics)).toBe(false);
    expect(messages(diagnostics)).toContain("outside a requirement");
    expect(
      capability?.requirements.flatMap((r) =>
        r.anchors.map((a) => a.anchor.file),
      ),
    ).toEqual(["src/x.ts"]);
  });

  it("reports a malformed anchor inside a requirement as an error", () => {
    const { diagnostics } = parseCapability(
      frontmatter() +
        requirement(
          "REQ-AUTH-003",
          "**Statement.** The X SHALL Y.\n\n```yaml anchors\n- symbol: orphan\n```\n",
        ),
      "auth.md",
    );
    expect(hasErrors(diagnostics)).toBe(true);
    expect(messages(diagnostics)).toContain('missing the required "file"');
  });

  it("reports an unterminated fence", () => {
    const { diagnostics } = parseCapability(
      frontmatter() +
        requirement(
          "REQ-AUTH-003",
          "**Statement.** The X SHALL Y.\n\n```yaml anchors\n- file: src/x.ts\n",
        ),
      "auth.md",
    );
    expect(messages(diagnostics)).toContain("Unterminated fenced code block");
  });
});

// A requirement with no statement has nothing for the EARS layer to check.
describe("statement and acceptance", () => {
  it("rejects a requirement without a statement", () => {
    const { diagnostics } = parseCapability(
      frontmatter() + requirement("REQ-AUTH-003", "Some prose only.\n"),
      "auth.md",
    );
    expect(hasErrors(diagnostics)).toBe(true);
    expect(messages(diagnostics)).toContain('has no "**Statement.**"');
  });

  it("warns when a requirement has no acceptance criteria", () => {
    const { diagnostics } = parseCapability(
      frontmatter() +
        requirement("REQ-AUTH-003", "**Statement.** The X SHALL Y.\n"),
      "auth.md",
    );
    expect(hasErrors(diagnostics)).toBe(false);
    expect(messages(diagnostics)).toContain('no "**Acceptance.**" criteria');
  });
});
