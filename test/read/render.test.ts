import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderForReading } from "../../src/read/render.js";

const READING = { full: false };

describe("renderForReading — REQ-READ-004", () => {
  it("drops the frontmatter and says it did", () => {
    const html = renderForReading(
      "---\ncapability: cli\nretired: []\n---\n\n# Title\n",
      READING,
    );

    expect(html).not.toContain("capability");
    expect(html).toContain("front matter omitted");
    expect(html).toContain("<h1>Title</h1>");
  });

  it("drops an anchor block and names it as anchors", () => {
    const html = renderForReading(
      '## R\n\n```yaml anchors\n- file: src/cli/index.ts\n  symbol: "registerCommands"\n```\n',
      READING,
    );

    expect(html).not.toContain("registerCommands");
    expect(html).toContain("anchors omitted");
  });

  it("drops any other fence, naming the language when it has one", () => {
    const html = renderForReading(
      "```ts\nexport const x = 1;\n```\n\n```\nplain\n```\n",
      READING,
    );

    expect(html).not.toContain("export const x");
    expect(html).not.toContain("plain");
    expect(html).toContain("ts code omitted");
    expect(html).toContain("code omitted");
  });

  it("reaches a fence nested inside a list", () => {
    const html = renderForReading(
      "- item\n\n  ```ts\n  const hidden = 1;\n  ```\n",
      READING,
    );

    expect(html).not.toContain("hidden");
    expect(html).toContain("ts code omitted");
  });

  it("turns a table into a list that names its columns", () => {
    const html = renderForReading(
      "| Code | Meaning |\n| --- | --- |\n| 0 | Success |\n| 1 | Gate failed |\n",
      READING,
    );

    expect(html).not.toContain("<table>");
    expect(html).toContain("Code: 0; Meaning: Success");
    expect(html).toContain("Code: 1; Meaning: Gate failed");
  });

  it("leaves prose, headings and inline code alone", () => {
    const html = renderForReading(
      "## Heading\n\nProse with `codespan` inside.\n",
      READING,
    );

    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("codespan");
  });

  it("omits nothing under --full", () => {
    const html = renderForReading(
      "---\ncapability: cli\n---\n\n```yaml anchors\n- file: src/cli/index.ts\n```\n",
      { full: true },
    );

    expect(html).toContain("src/cli/index.ts");
    expect(html).not.toContain("omitted");
  });
});

// The fence this has to cut is the one this repository actually writes, so the
// test reads a real capability rather than a fixture shaped like one.
describe("renderForReading over a real capability", () => {
  it("removes every anchor block from .specd/specs/cli.md", () => {
    const source = readFileSync(
      join(process.cwd(), ".specd", "specs", "cli.md"),
      "utf-8",
    );
    const html = renderForReading(source, READING);

    expect(source).toContain("```yaml anchors");
    // Anchor bodies are gone. `registerCommands` is not asserted against: the
    // prose cites it as a codespan, and cutting prose is not this requirement.
    expect(html).not.toContain("src/cli/index.ts");
    expect(html).not.toContain("src/verify/index.ts");
    expect(html).toContain("anchors omitted");
    // The prose the listener came for survives.
    expect(html).toContain("Single gate");
  });
});

describe("markStatementLanguage — REQ-READ-007", () => {
  it("marks the statement paragraph as English", () => {
    const html = renderForReading(
      "### REQ-CLI-001 — Single gate\n\n" +
        "**Statement.** The specd CLI SHALL expose exactly one gate.\n\n" +
        "**Acceptance.**\n\n- Nenhum outro comando retorna exit code 1\n",
      READING,
    );

    expect(html).toContain('<p lang="en">');
    expect(html).toContain("SHALL expose exactly one gate");
  });

  it("leaves the surrounding Portuguese prose unmarked", () => {
    const html = renderForReading(
      "**Statement.** The specd CLI SHALL do it.\n\nProsa em português.\n",
      READING,
    );

    expect(html).toContain("<p>Prosa em português.</p>");
    expect(html.match(/lang="en"/g)).toHaveLength(1);
  });

  it("marks under --full too, because --full is about omission", () => {
    const html = renderForReading(
      "**Statement.** The specd CLI SHALL do it.\n",
      { full: true },
    );

    expect(html).toContain('<p lang="en">');
  });

  // The attribute is all this promises. Whether a reader switches voice is a
  // third party's behaviour, and asserting it here would claim evidence this
  // repository cannot produce.
  it("adds nothing audible: the text is the same without the attribute", () => {
    const source = "**Statement.** The specd CLI SHALL do it.\n";
    const marked = renderForReading(source, READING);

    expect(marked.replace(' lang="en"', "")).toBe(
      "<p><strong>Statement.</strong> The specd CLI SHALL do it.</p>\n",
    );
  });
});
