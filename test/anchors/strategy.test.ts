import { describe, expect, it } from "vitest";
import { strategyFor } from "../../src/anchors/strategy.js";
import { grepStrategy } from "../../src/anchors/strategies/grep.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import { ConfigError } from "../../src/config/errors.js";

// REQ-ANC-004 — Strategy selected by file extension
describe("strategy selection", () => {
  it("uses the extension mapping even when the default is treesitter", () => {
    expect(strategyFor("config/app.yml", "treesitter").name).toBe("grep");
    expect(strategyFor("package.json", "treesitter").name).toBe("grep");
  });

  it("uses anchors.default for an unmapped extension", () => {
    expect(strategyFor("src/index.ts", "grep").name).toBe("grep");
  });

  it("matches the extension case-insensitively", () => {
    expect(strategyFor("config/App.YML", "treesitter").name).toBe("grep");
  });
});

// REQ-ANC-005 — Grep is the only v1 strategy
describe("treesitter is refused", () => {
  it("raises a readable configuration error instead of falling back", () => {
    let thrown: unknown;
    try {
      strategyFor("src/index.ts", "treesitter");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).exitCode).toBe(EXIT.OPERATIONAL_FAILURE);
    const message = (thrown as ConfigError).message;
    expect(message).toContain("treesitter");
    expect(message).toContain("grep is the only strategy implemented");
    expect(message).toContain('anchors.default = "grep"');
  });

  // The "no WASM grammar in the bundle" criterion moved to REQ-CLI-006, where
  // the native-dependency constraint already lives; its test moved with it to
  // test/distribution/package.test.ts. REQ-ANC-005 now states only strategy
  // selection.
});

// REQ-ANC-002 step 3 — grep is a literal string search, nothing more.
describe("grep strategy", () => {
  it("matches a literal substring", () => {
    expect(
      grepStrategy.matches("export function greet() {}", "function greet"),
    ).toBe(true);
    expect(
      grepStrategy.matches("export function greet() {}", "function wave"),
    ).toBe(false);
  });

  it("reports the 1-based line of the first occurrence", () => {
    expect(grepStrategy.find("a\nb\ntarget\n", "target")).toBe(3);
    expect(grepStrategy.find("a\nb\n", "target")).toBeUndefined();
  });
});
