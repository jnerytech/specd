import { describe, expect, it } from "vitest";
import { USAGE, registerCommands } from "../../src/cli/index.js";
import { GLOBAL_OPTIONS, renderUsage } from "../../src/cli/usage.js";

// REQ-CLI-009 — the usage text is rendered from the registered surface.
//
// With the list generated, "every registered command appears" is true by
// construction and these assertions are partly tautological. They guard the
// seam rather than the invariant: somebody reverting the list to a literal, or
// adding an entry point to `main` without declaring it as a global option.
describe("usage text", () => {
  it("names every registered command with its summary", () => {
    for (const command of registerCommands().values()) {
      expect(USAGE).toContain(command.name);
      expect(USAGE).toContain(command.summary);
    }
  });

  it("names the entry points handled before dispatch", () => {
    for (const option of GLOBAL_OPTIONS) {
      expect(USAGE).toContain(option.flags);
      expect(USAGE).toContain(option.summary);
    }
    // The two that worked and were missing from the literal, which is the drift
    // this requirement exists to close.
    expect(USAGE).toContain("--version");
    expect(USAGE).toContain("-h");
  });

  it("lists a command that is only in the table, with no text edited", () => {
    const rendered = renderUsage([
      { name: "invented", summary: "exists only in this test" },
    ]);
    expect(rendered).toContain("invented");
    expect(rendered).toContain("exists only in this test");
  });

  it("keeps the header and the hooks run caveat as written prose", () => {
    expect(USAGE).toContain("Usage: specd <command> [options]");
    expect(USAGE).toContain(
      "Exit codes: 0 success, 1 gate failure, 2 operational failure.",
    );
    expect(USAGE).toContain("it answers in the host's");
    expect(USAGE).toContain("src/hooks/protocol.ts");
  });

  // They moved to the scope they document. Leaving a copy here is the third
  // copy REQ-CLI-011 exists to forbid.
  it("carries no per-command option block", () => {
    expect(USAGE).not.toContain("Options for");
  });
});
