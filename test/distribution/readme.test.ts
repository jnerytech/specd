import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

function binPath(): string {
  const manifest = JSON.parse(read("package.json")) as {
    bin: Record<string, string>;
  };
  const paths = Object.values(manifest.bin);
  expect(paths).toHaveLength(1);
  return paths[0] as string;
}

// REQ-CLI-007 — The README names an invocation that works before publication.
//
// The only absolute wall of the onboarding, and it is the first step: `npx
// specd` answers 404 and no document said what to do instead. Whoever stops at
// the first command never becomes a user, and the product dies where nobody
// looks.
//
// Only part of this is machine-checkable, and pretending otherwise would be a
// test that passes without checking anything — P8 inside CI. What is checkable
// is the coupling: the path the README tells people to run is the path
// `package.json` actually ships.
describe("README names the bin path", () => {
  it("shows the executable that package.json declares", () => {
    const readme = read("README.md");
    // "./dist/cli.js" in the manifest, "dist/cli.js" as typed by a human.
    expect(readme).toContain(binPath().replace(/^\.\//, ""));
  });

  it("fails if bin moves and the README does not follow", () => {
    const readme = read("README.md");
    expect(readme).not.toContain("dist/main.js");
    expect(binPath()).toBe("dist/cli.js");
  });

  it("shows the build step, because the shipped path is build output", () => {
    const readme = read("README.md");
    expect(readme).toContain("npm install");
    expect(readme).toContain("npm run build");
  });

  it("says that npx does not work yet instead of only showing it", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/não está publicado|não publicado/);
    // And it still documents npx, for after publication.
    expect(readme).toContain("npx specd");
  });

  it("says the same thing in the agent instructions", () => {
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      const source = read(file);
      expect(source).toContain("dist/cli.js");
      expect(source).toMatch(/não publicado/);
    }
  });
});
