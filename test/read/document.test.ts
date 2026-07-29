import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectPaths } from "../../src/read/collect.js";
import { buildDocument, FONT_STACK } from "../../src/read/document.js";
import { cleanupWorkspaces, makeWorkspace } from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const READING = { full: false };

function documentOf(files: Record<string, string>, paths: string[]) {
  const { root } = makeWorkspace({ files });
  return buildDocument(collectPaths(root, paths), READING);
}

describe("buildDocument — REQ-READ-003", () => {
  it("puts every file in one document, each under a heading naming its path", () => {
    const html = documentOf(
      { "docs/a.md": "# Alpha\n\nProse.\n", "docs/b.md": "# Beta\n" },
      ["docs"],
    );

    expect(html).toContain('<h2 class="file">docs/a.md</h2>');
    expect(html).toContain('<h2 class="file">docs/b.md</h2>');
    expect(html).toContain("<h1>Alpha</h1>");
    expect(html).toContain("<h1>Beta</h1>");
  });

  it("is byte-identical across runs over the same set", () => {
    const files = { "docs/a.md": "# Alpha\n", "docs/b.md": "# Beta\n" };
    const { root } = makeWorkspace({ files });

    const first = buildDocument(collectPaths(root, ["docs"]), READING);
    const second = buildDocument(collectPaths(root, ["docs"]), READING);

    expect(first).toBe(second);
  });

  it("lists one contents link per file, and each one resolves", () => {
    const html = documentOf(
      { "docs/a.md": "# Alpha\n", "docs/nested/b.md": "# Beta\n" },
      ["docs"],
    );

    const links = [...html.matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)];
    expect(links.map((match) => match[2])).toEqual([
      "docs/a.md",
      "docs/nested/b.md",
    ]);
    for (const [, id] of links) {
      expect(html).toContain(`<section id="${id}">`);
    }
  });

  it("declares how many files and how many words are ahead", () => {
    const html = documentOf({ "docs/a.md": "# Alpha\n\none two three\n" }, [
      "docs",
    ]);

    expect(html).toMatch(/1 file, \d+ words/);
  });

  it("counts what survived the cuts, not what was omitted", () => {
    const { root } = makeWorkspace({
      files: {
        "docs/a.md":
          "one two three\n\n```yaml anchors\n- file: a\n- file: b\n- file: c\n- file: d\n```\n",
      },
    });
    const html = buildDocument(collectPaths(root, ["docs"]), READING);

    // "one two three" plus the "(anchors omitted)" marker — the fence body is
    // gone, so it cannot be in the count.
    const words = Number(/([\d,]+) words/.exec(html)?.[1]?.replace(",", ""));
    expect(words).toBeLessThan(10);
  });

  it("declares the document Portuguese and carries no script", () => {
    const html = documentOf({ "docs/a.md": "# Alpha\n" }, ["docs"]);

    expect(html).toContain('<html lang="pt-BR">');
    expect(html).not.toContain("<script");
  });

  it("stops on a file it cannot read instead of leaving a silent hole", () => {
    const { root } = makeWorkspace({
      files: { "docs/a.md": "# Alpha\n", "docs/b.md": "# Beta\n" },
    });
    const files = collectPaths(root, ["docs"]);
    const broken = [
      ...files,
      {
        absolutePath: join(root, "docs", "gone.md"),
        displayPath: "docs/gone.md",
      },
    ];

    expect(() => buildDocument(broken, READING)).toThrow(/docs\/gone\.md/);
  });
});

describe("themeControl — REQ-READ-008", () => {
  it("offers auto, light and dark, with auto selected", () => {
    const html = documentOf({ "docs/a.md": "# Alpha\n" }, ["docs"]);

    expect(html).toContain(
      '<input type="radio" name="theme" id="theme-auto" checked>',
    );
    expect(html).toContain(
      '<input type="radio" name="theme" id="theme-light">',
    );
    expect(html).toContain('<input type="radio" name="theme" id="theme-dark">');
  });

  it("switches with CSS alone, and follows the system until asked otherwise", () => {
    const html = documentOf({ "docs/a.md": "# Alpha\n" }, ["docs"]);

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("body:has(#theme-light:checked)");
    expect(html).toContain("body:has(#theme-dark:checked)");
  });

  // A theme picker between files would be spoken once per file, which is the
  // failure REQ-READ-004 removes from anchor fences.
  it("appears once, in the header, outside every section", () => {
    const html = documentOf(
      { "docs/a.md": "# Alpha\n", "docs/b.md": "# Beta\n" },
      ["docs"],
    );

    expect(html.match(/<fieldset class="theme">/g)).toHaveLength(1);
    const control = html.indexOf('<fieldset class="theme">');
    expect(control).toBeLessThan(html.indexOf("<section id="));
    expect(control).toBeGreaterThan(html.indexOf("<header>"));
    expect(control).toBeLessThan(html.indexOf("</header>"));
  });

  it("adds nothing to the word count, which covers the content only", () => {
    const withTheme = documentOf({ "docs/a.md": "one two three\n" }, ["docs"]);

    expect(withTheme).toMatch(/1 file, 3 words/);
  });
});

describe("FONT_STACK — REQ-READ-010", () => {
  it("sets a system sans stack on the body, ending in a generic family", () => {
    const html = documentOf({ "docs/a.md": "# Alpha\n" }, ["docs"]);

    expect(html).toContain(FONT_STACK);
    expect(FONT_STACK).toMatch(/sans-serif$/);
    expect(html).not.toContain("Georgia");
  });

  it("keeps monospace where the source was monospace, ending in a generic", () => {
    const html = documentOf({ "docs/a.md": "Prose with `code` in it.\n" }, [
      "docs",
    ]);

    expect(html).toMatch(/code, pre \{ font-family: [^;]*monospace;/);
    expect(html).toContain("<code>code</code>");
  });

  // REQ-READ-005 says nothing leaves the machine. CSS is the route nobody
  // inspects, so a remote face would open that hole from the side.
  it("fetches no font", () => {
    const html = documentOf({ "docs/a.md": "# Alpha\n" }, ["docs"]);

    expect(html).not.toContain("@font-face");
    expect(html).not.toContain("@import");
    expect(html).not.toMatch(/https?:\/\/fonts\./);
  });
});
