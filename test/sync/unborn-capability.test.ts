import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertCapabilitiesExist, sync } from "../../src/sync/index.js";
import { SyncError } from "../../src/sync/errors.js";
import type { BoardAdapter } from "../../src/sync/adapter.js";
import { readOpenChanges } from "../../src/verify/changes.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const BOARD = `[board]
provider = "redmine"
url = "http://board.invalid"
project = "demo"
token_env = "SPECD_TEST_TOKEN"
card = "optional"

[board.mapping]
capability = "Epic"
requirement = "Story"
collapse = ["task"]

[[board.fields]]
name = "Cliente"
constant = "ACME"
`;

// Every write rejects. A refusal that reached the board would fail here rather
// than pass quietly, which is the whole claim of REQ-SYNC-018.
function refusingAdapter(): BoardAdapter {
  return {
    provider: "test",
    create: () => Promise.reject(new Error("nothing may be created")),
    update: () => Promise.reject(new Error("nothing may be updated")),
    link: () => Promise.reject(new Error("nothing may be linked")),
    close: () => Promise.reject(new Error("nothing may be closed")),
    transition: () => Promise.reject(new Error("nothing may be transitioned")),
    read: () => Promise.reject(new Error("no request may be made")),
    describeFields: () => Promise.resolve([]),
  };
}

// Records every call instead of rejecting it, so a test can assert that the
// normal path still reaches the board — and that the refusal never does.
function recordingAdapter() {
  const calls: string[] = [];
  const adapter: BoardAdapter = {
    provider: "test",
    create: (draft) => {
      calls.push(`create:${draft.title}`);
      return Promise.resolve({
        id: String(calls.length),
        url: `http://board.invalid/issues/${calls.length}`,
      });
    },
    update: () => {
      calls.push("update");
      return Promise.resolve();
    },
    link: () => {
      calls.push("link");
      return Promise.resolve();
    },
    close: () => {
      calls.push("close");
      return Promise.resolve();
    },
    transition: () => {
      calls.push("transition");
      return Promise.resolve();
    },
    read: () => {
      calls.push("read");
      return Promise.resolve(undefined);
    },
    describeFields: () => {
      calls.push("describeFields");
      return Promise.resolve([
        {
          id: 1,
          name: "Cliente",
          format: "string",
          required: false,
          multiple: false,
        },
      ]);
    },
  };
  return { calls, adapter };
}

// A change whose delta introduces a capability that has no file on disk, which
// is what Modelo B produces before `archive` runs.
function workspace(options: { newCapability: boolean }) {
  const target = options.newCapability ? "unborn" : "demo";
  return makeWorkspace({
    config: BOARD,
    specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    change: {
      name: "2026-07-demo",
      delta: delta({
        change: "2026-07-demo",
        added: [deltaRequirement({ id: "REQ-DEMO-002", capability: target })],
      }),
    },
  });
}

// REQ-SYNC-018 — the refusal, before the first write.
describe("sync refuses a capability born in a delta — REQ-SYNC-018", () => {
  it("exits without creating anything on the board", async () => {
    const { root, globalPath } = workspace({ newCapability: true });

    await expect(
      sync({ cwd: root, globalPath, adapter: refusingAdapter() }),
    ).rejects.toBeInstanceOf(SyncError);
  });

  it("names the capability, the change and the path that is missing", async () => {
    const { root, globalPath } = workspace({ newCapability: true });

    const failure = await sync({
      cwd: root,
      globalPath,
      adapter: refusingAdapter(),
    }).catch((cause: unknown) => cause as Error);

    expect(failure.message).toContain("unborn");
    expect(failure.message).toContain("2026-07-demo");
    expect(failure.message).toContain(join(".specd", "specs", "unborn.md"));
  });

  it("says where the capability is born", async () => {
    const { root, globalPath } = workspace({ newCapability: true });

    const failure = await sync({
      cwd: root,
      globalPath,
      adapter: refusingAdapter(),
    }).catch((cause: unknown) => cause as Error);

    expect(failure.message).toContain("specd archive");
  });

  it("refuses the dry run the same way, without a request", async () => {
    const { root, globalPath } = workspace({ newCapability: true });

    await expect(
      sync({
        cwd: root,
        globalPath,
        dryRun: true,
        adapter: refusingAdapter(),
      }),
    ).rejects.toBeInstanceOf(SyncError);
  });

  it("asks the board nothing before refusing, not even the field definitions", async () => {
    const { root, globalPath } = workspace({ newCapability: true });
    const { calls, adapter } = recordingAdapter();

    await expect(
      sync({ cwd: root, globalPath, adapter }),
    ).rejects.toBeInstanceOf(SyncError);

    // The configuration declares a field, so a refusal placed after
    // `loadFieldBindings` would have asked for the definitions by now.
    expect(calls).toEqual([]);
  });

  it("still syncs a requirement of a delta whose capability exists", async () => {
    const { root, globalPath } = workspace({ newCapability: false });
    const { calls, adapter } = recordingAdapter();

    const report = await sync({ cwd: root, globalPath, adapter });

    expect(calls).toContain("describeFields");
    expect(calls.some((call) => call.startsWith("create:"))).toBe(true);
    expect(report.counts.create).toBeGreaterThan(0);
  });

  it("lets a requirement of a delta through when its capability exists", () => {
    const { root } = workspace({ newCapability: false });
    const changes = readOpenChanges(root);

    expect(() =>
      assertCapabilitiesExist(
        root,
        [
          {
            key: "REQ-DEMO-002",
            capability: "demo",
            level: "requirement",
            type: "Story",
            title: "t",
            body: "b",
          } as never,
        ],
        changes,
      ),
    ).not.toThrowError();
  });

  it("reports every missing capability, not only the first", () => {
    const { root } = workspace({ newCapability: true });
    const planned = ["unborn", "also-unborn"].map(
      (name) =>
        ({
          key: name,
          capability: name,
          level: "capability",
          type: "Epic",
          title: "t",
          body: "b",
        }) as never,
    );

    const failure = (() => {
      try {
        assertCapabilitiesExist(root, planned, readOpenChanges(root));
        return undefined;
      } catch (cause) {
        return cause as Error;
      }
    })();

    expect(failure?.message).toContain("unborn");
    expect(failure?.message).toContain("also-unborn");
  });
});
