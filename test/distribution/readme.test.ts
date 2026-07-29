import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
// `docs/instalacao.md` is here because it is nothing but install commands, and
// the unscoped name is a trap precisely there: a page that offers `npx specd`
// as the way in sends every reader to a package that is not this one. The three
// files above name the package in passing; that one is where someone copies.
const DOCUMENTS = ["README.md", "AGENTS.md", "CLAUDE.md", "docs/instalacao.md"];

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

function manifest(): { name: string; bin: Record<string, string> } {
  return JSON.parse(read("package.json")) as {
    name: string;
    bin: Record<string, string>;
  };
}

function binPath(): string {
  const paths = Object.values(manifest().bin);
  expect(paths).toHaveLength(1);
  return paths[0] as string;
}

// REQ-CLI-007 — The documentation names the package and the executable that
// package.json declares.
//
// The previous version of this suite asserted that the README kept saying the
// package was unpublished. Nothing here could check whether that was true —
// registry state is network and `verify` is offline (gate-no-network) — so what looked like
// a check was a lock, holding the sentence in place exactly while it stopped
// being true. Meanwhile package.test.ts already asserted the name was
// "@jnerytech/specd" and the README said it was "specd".
//
// The rule that replaced it: a test that cannot check a claim must not pin it.
// Package name is a local fact, it is in the manifest, and it drifts the same
// way. Publication state is a remote fact and none of the gate's business.
describe("the documentation names the declared package", () => {
  it("names the package that package.json declares", () => {
    for (const file of DOCUMENTS) {
      expect(read(file)).toContain(manifest().name);
    }
  });

  it("fails if the name changes and the documentation does not follow", () => {
    // The unscoped name is not this package. A document that offers it as the
    // way in sends the reader to a 404 — the wall this requirement exists to
    // pull down.
    for (const file of DOCUMENTS) {
      const withoutScope = read(file).replaceAll(manifest().name, "");
      expect(withoutScope).not.toMatch(/(?:npx|npm i(?:nstall)? -g) specd\b/);
    }
  });

  it("shows the executable that package.json declares", () => {
    // "./dist/cli.js" in the manifest, "dist/cli.js" as typed by a human.
    expect(read("README.md")).toContain(binPath().replace(/^\.\//, ""));
  });

  it("fails if bin moves and the README does not follow", () => {
    expect(read("README.md")).not.toContain("dist/main.js");
    expect(binPath()).toBe("dist/cli.js");
  });

  it("shows the build step, because the shipped path is build output", () => {
    const readme = read("README.md");
    expect(readme).toContain("npm install");
    expect(readme).toContain("npm run build");
  });

  it("says the same thing in the agent instructions", () => {
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      expect(read(file)).toContain("dist/cli.js");
    }
  });

  // The rule of this requirement, applied to its own suite. Asserting registry
  // state in prose would recreate the lock under a different wording.
  it("pins no claim about registry state", () => {
    const suite = read("test/distribution/readme.test.ts");
    expect(suite).not.toMatch(/toMatch\(\/[^/]*publicado/);
  });
});
