import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectPaths } from "../../src/read/collect.js";
import { buildDocument } from "../../src/read/document.js";
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
