import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalError } from "../../src/core/operational.js";
import {
  desiredEntries,
  hookCommand,
  installHooks,
  SETTINGS_PATH,
  WRITE_TOOL_MATCHER,
} from "../../src/hooks/install.js";
import { uninstallHooks } from "../../src/hooks/uninstall.js";

const made: string[] = [];
afterEach(() => {
  while (made.length > 0)
    rmSync(made.pop() as string, { recursive: true, force: true });
});

function project(settings?: string): string {
  const root = mkdtempSync(join(tmpdir(), "specd-hooks-"));
  made.push(root);
  mkdirSync(join(root, ".specd", "specs"), { recursive: true });
  if (settings !== undefined) {
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, SETTINGS_PATH.replace("/", "/")), settings);
  }
  return root;
}

function read(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, SETTINGS_PATH), "utf8")) as Record<
    string,
    unknown
  >;
}

interface Group {
  matcher?: string;
  hooks: { type?: string; command?: string }[];
}

function groups(root: string, event: string): Group[] {
  const hooks = read(root)["hooks"] as Record<string, Group[]>;
  return hooks[event] ?? [];
}

function commands(root: string, event: string): string[] {
  return groups(root, event).flatMap((group) =>
    group.hooks.map((entry) => entry.command as string),
  );
}

const THIRD_PARTY = {
  hooks: {
    Stop: [
      {
        hooks: [{ type: "command", command: "some-other-tool --check" }],
      },
    ],
  },
  statusLine: { type: "command", command: "my-statusline" },
};

// REQ-HOOK-007 — the fast gate on both events by default.
describe("the command written into settings.json", () => {
  it("carries --fast on both events by default", () => {
    for (const entry of desiredEntries()) {
      expect(entry.command).toContain("--fast");
    }
  });

  it("drops --fast from Stop with --full-on-stop", () => {
    const entries = desiredEntries({ fullOnStop: true });
    const stop = entries.find((entry) => entry.event === "stop");
    const post = entries.find((entry) => entry.event === "post-tool-use");
    expect(stop?.command).not.toContain("--fast");
    expect(post?.command).toContain("--fast");
  });

  it("matches only the tools that write files", () => {
    const post = desiredEntries().find((e) => e.event === "post-tool-use");
    expect(post?.matcher).toBe(WRITE_TOOL_MATCHER);
    expect(post?.matcher).toContain("Edit");
    expect(post?.matcher).not.toContain("Read");
    // Stop fires once, for the session; there is nothing to match on.
    expect(desiredEntries().find((e) => e.event === "stop")?.matcher).toBe(
      undefined,
    );
  });

  it("lets the invocation be named, for a repository running its own build", () => {
    expect(
      hookCommand({
        event: "stop",
        fast: true,
        executable: "node dist/cli.js",
      }),
    ).toBe("node dist/cli.js hooks run stop --fast");
  });
});

// REQ-HOOK-001 — merge, never rewrite.
describe("install merges", () => {
  it("creates the file when it does not exist", () => {
    const root = project();
    const result = installHooks({ cwd: root });
    expect(result.wrote).toBe(true);
    expect(commands(root, "Stop")).toEqual(["specd hooks run stop --fast"]);
    expect(commands(root, "PostToolUse")).toEqual([
      "specd hooks run post-tool-use --fast",
    ]);
  });

  it("preserves a third-party hook in the same event", () => {
    const root = project(JSON.stringify(THIRD_PARTY, null, 2));
    installHooks({ cwd: root });
    expect(commands(root, "Stop")).toContain("some-other-tool --check");
    expect(commands(root, "Stop")).toContain("specd hooks run stop --fast");
  });

  it("preserves keys outside hooks", () => {
    const root = project(JSON.stringify(THIRD_PARTY, null, 2));
    installHooks({ cwd: root });
    expect(read(root)["statusLine"]).toEqual(THIRD_PARTY.statusLine);
  });

  it("leaves the file unstaged", () => {
    const root = project();
    installHooks({ cwd: root });
    // No git repository exists here at all: if install had staged anything it
    // would have had to create or find one, and it does neither.
    expect(() => read(root)).not.toThrow();
  });
});

// REQ-HOOK-002 — identical is a no-op, divergent is a refusal.
describe("reinstall", () => {
  it("does not duplicate anything when run twice", () => {
    const root = project();
    installHooks({ cwd: root });
    const second = installHooks({ cwd: root });
    expect(second.wrote).toBe(false);
    expect(second.unchanged).toHaveLength(2);
    expect(commands(root, "Stop")).toEqual(["specd hooks run stop --fast"]);
    expect(commands(root, "PostToolUse")).toHaveLength(1);
  });

  it("refuses when the existing specd entry differs", () => {
    const root = project();
    installHooks({ cwd: root });
    expect(() => installHooks({ cwd: root, fullOnStop: true })).toThrow(
      OperationalError,
    );
    // The message has to name both, because the whole point is that specd is
    // not choosing between them.
    try {
      installHooks({ cwd: root, fullOnStop: true });
    } catch (cause) {
      expect((cause as Error).message).toContain("specd hooks run stop --fast");
      expect((cause as Error).message).toContain("existing:");
      expect((cause as Error).message).toContain("wanted:");
    }
    // And nothing was written.
    expect(commands(root, "Stop")).toEqual(["specd hooks run stop --fast"]);
  });

  it("replaces the divergent entry with --force", () => {
    const root = project();
    installHooks({ cwd: root });
    const forced = installHooks({ cwd: root, fullOnStop: true, force: true });
    expect(forced.replaced).toEqual(["specd hooks run stop"]);
    expect(commands(root, "Stop")).toEqual(["specd hooks run stop"]);
  });
});

// REQ-HOOK-003 — a file specd cannot read is never overwritten.
describe("malformed settings", () => {
  const cases: Record<string, string> = {
    "invalid JSON": "{ not json",
    "array at the top level": "[]",
    "hooks as an array": '{"hooks": []}',
    "an event that is not an array": '{"hooks": {"Stop": {}}}',
    "a group that is not an object": '{"hooks": {"Stop": ["x"]}}',
    "inner hooks that are not an array": '{"hooks": {"Stop": [{"hooks": 3}]}}',
  };

  for (const [name, content] of Object.entries(cases)) {
    it(`refuses ${name} and leaves the bytes alone`, () => {
      const root = project(content);
      const before = readFileSync(join(root, SETTINGS_PATH), "utf8");
      expect(() => installHooks({ cwd: root })).toThrow(OperationalError);
      expect(readFileSync(join(root, SETTINGS_PATH), "utf8")).toBe(before);
    });

    // --force authorises replacing configuration specd could read. It is not a
    // licence to destroy configuration nobody can name afterwards.
    it(`does not let --force past ${name}`, () => {
      const root = project(content);
      const before = readFileSync(join(root, SETTINGS_PATH), "utf8");
      expect(() => installHooks({ cwd: root, force: true })).toThrow(
        OperationalError,
      );
      expect(readFileSync(join(root, SETTINGS_PATH), "utf8")).toBe(before);
    });
  }

  it("names the file in the message", () => {
    const root = project("{ not json");
    expect(() => installHooks({ cwd: root })).toThrow(/settings\.json/);
  });
});

// REQ-HOOK-004 — remove only what specd wrote.
describe("uninstall", () => {
  it("removes the specd entries and keeps the third-party one", () => {
    const root = project(JSON.stringify(THIRD_PARTY, null, 2));
    installHooks({ cwd: root });
    const result = uninstallHooks({ cwd: root });
    expect(result.removed).toHaveLength(2);
    expect(commands(root, "Stop")).toEqual(["some-other-tool --check"]);
    expect(read(root)["statusLine"]).toEqual(THIRD_PARTY.statusLine);
  });

  it("drops a container its own removal emptied", () => {
    const root = project();
    installHooks({ cwd: root });
    uninstallHooks({ cwd: root });
    // Every group held only specd entries, so `hooks` itself goes.
    expect(read(root)["hooks"]).toBeUndefined();
  });

  it("preserves a container that was already empty", () => {
    const root = project(
      JSON.stringify({ hooks: { PreToolUse: [], Stop: [] } }, null, 2),
    );
    installHooks({ cwd: root });
    uninstallHooks({ cwd: root });
    const hooks = read(root)["hooks"] as Record<string, unknown[]>;
    // `PreToolUse` was empty before specd touched anything: it is the user's
    // configuration, even though it configures nothing.
    expect(hooks["PreToolUse"]).toEqual([]);
  });

  it("says so when there is nothing to remove", () => {
    const root = project(JSON.stringify(THIRD_PARTY, null, 2));
    const result = uninstallHooks({ cwd: root });
    expect(result.wrote).toBe(false);
    expect(result.removed).toEqual([]);
  });

  it("is a no-op when the file does not exist", () => {
    const result = uninstallHooks({ cwd: project() });
    expect(result.wrote).toBe(false);
  });
});
