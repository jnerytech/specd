import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

describe("cli entrypoint", () => {
  it("prints the package version and exits 0", () => {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "src/cli.ts"],
      { encoding: "utf8" },
    );
    expect(output.trim()).toBe(`specd ${version}`);
  });
});
