import { afterEach, describe, expect, it } from "vitest";
import { collectDefault, collectPaths } from "../../src/read/collect.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const SPECS = {
  cli: capability({ name: "cli", id: "REQ-CLI-001" }),
  verify: capability({ name: "verify", id: "REQ-VER-001" }),
};

function project() {
  return makeWorkspace({
    specs: SPECS,
    files: {
      ".specd/changes/2026-07-open/delta.md": "# Delta\n",
      ".specd/changes/2026-07-open/proposal.md": "# Proposal\n",
      ".specd/changes/2026-07-open/tasks/001-first.md": "# Task\n",
      ".specd/changes/archive/2026-06-closed/delta.md": "# Closed\n",
      ".specd/changes/archive/2026-06-closed/tasks/001-old.md": "# Old\n",
    },
  });
}

describe("collectDefault — REQ-READ-001", () => {
  it("takes the capabilities and the open changes", () => {
    const { root } = project();
    const paths = collectDefault(root, { all: false }).map(
      (f) => f.displayPath,
    );

    expect(paths).toContain(".specd/specs/cli.md");
    expect(paths).toContain(".specd/specs/verify.md");
    expect(paths).toContain(".specd/changes/2026-07-open/delta.md");
    expect(paths).toContain(".specd/changes/2026-07-open/tasks/001-first.md");
  });

  it("leaves the archive out", () => {
    const { root } = project();
    const paths = collectDefault(root, { all: false }).map(
      (f) => f.displayPath,
    );

    expect(paths.some((path) => path.includes("/archive/"))).toBe(false);
  });

  it("includes the archive under --all", () => {
    const { root } = project();
    const paths = collectDefault(root, { all: true }).map((f) => f.displayPath);

    expect(paths).toContain(".specd/changes/archive/2026-06-closed/delta.md");
    expect(paths).toContain(
      ".specd/changes/archive/2026-06-closed/tasks/001-old.md",
    );
  });

  // REQ-READ-003 depends on this: the order is settled at collection so the
  // document builder never has a second opinion about it.
  it("puts the capabilities before the changes, and is stable", () => {
    const { root } = project();
    const first = collectDefault(root, { all: false }).map(
      (f) => f.displayPath,
    );
    const second = collectDefault(root, { all: false }).map(
      (f) => f.displayPath,
    );

    expect(first).toEqual(second);
    const lastSpec = first.findLastIndex((path) =>
      path.startsWith(".specd/specs/"),
    );
    const firstChange = first.findIndex((path) =>
      path.startsWith(".specd/changes/"),
    );
    expect(lastSpec).toBeLessThan(firstChange);
  });

  it("refuses a project whose .specd/ holds no Markdown", () => {
    const { root } = makeWorkspace({ emptyProject: true });

    expect(() => collectDefault(root, { all: false })).toThrow(
      /nothing to read/,
    );
  });
});

describe("collectPaths — REQ-READ-002", () => {
  it("takes a single file without walking its directory", () => {
    const { root } = project();
    const files = collectPaths(root, [".specd/specs/cli.md"]);

    expect(files).toHaveLength(1);
    expect(files[0]?.displayPath).toBe(".specd/specs/cli.md");
  });

  it("walks a directory recursively, Markdown only", () => {
    const { root } = makeWorkspace({
      files: {
        "docs/a.md": "# A\n",
        "docs/nested/b.md": "# B\n",
        "docs/notes.txt": "not markdown",
        "docs/script.ts": "export const x = 1;",
      },
    });
    const paths = collectPaths(root, ["docs"]).map((f) => f.displayPath);

    expect(paths).toEqual(["docs/a.md", "docs/nested/b.md"]);
  });

  it("skips .git and node_modules", () => {
    const { root } = makeWorkspace({
      files: {
        "docs/a.md": "# A\n",
        "docs/node_modules/pkg/readme.md": "# Vendor\n",
        "docs/.git/notes.md": "# Git\n",
      },
    });
    const paths = collectPaths(root, ["docs"]).map((f) => f.displayPath);

    expect(paths).toEqual(["docs/a.md"]);
  });

  it("keeps several paths in the order they were written", () => {
    const { root } = makeWorkspace({
      files: { "b.md": "# B\n", "a.md": "# A\n" },
    });
    const paths = collectPaths(root, ["b.md", "a.md"]).map(
      (f) => f.displayPath,
    );

    expect(paths).toEqual(["b.md", "a.md"]);
  });

  it("names the path it could not find", () => {
    const { root } = project();

    expect(() => collectPaths(root, ["docs/missing.md"])).toThrow(
      /docs\/missing\.md/,
    );
  });

  it("refuses a file that is not Markdown", () => {
    const { root } = makeWorkspace({ files: { "notes.txt": "plain" } });

    expect(() => collectPaths(root, ["notes.txt"])).toThrow(/reads Markdown/);
  });

  it("refuses a directory holding no Markdown rather than serving nothing", () => {
    const { root } = makeWorkspace({ files: { "docs/notes.txt": "plain" } });

    expect(() => collectPaths(root, ["docs"])).toThrow(/nothing to read/);
  });
});
