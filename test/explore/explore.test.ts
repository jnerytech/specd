import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SOURCE_TYPES } from "../../src/config/schema.js";
import { ConfigError } from "../../src/config/errors.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { explore, ExploreError } from "../../src/explore/index.js";
import type { ExploreManifest } from "../../src/explore/manifest.js";
import { bundlePath } from "../../src/explore/paths.js";
import { COLLECTORS } from "../../src/explore/sources/index.js";
import { cleanupWorkspaces, makeWorkspace } from "../verify/helpers.js";

const CHANGE = "2026-07-demo";
const servers: Server[] = [];

afterEach(async () => {
  cleanupWorkspaces();
  while (servers.length > 0) {
    const server = servers.pop() as Server;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function workspace(config: string): string {
  const created = makeWorkspace({ config });
  spawnSync("git", ["init", "-q"], { cwd: created.root });
  spawnSync("git", ["commit", "-q", "--allow-empty", "-m", "first"], {
    cwd: created.root,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@e.c",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@e.c",
    },
  });
  return created.root;
}

// Serves one JSON payload; returns its base URL.
async function serveJson(payload: unknown): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server did not bind a port");
  }
  return `http://127.0.0.1:${address.port}/`;
}

function readManifest(root: string): ExploreManifest {
  return JSON.parse(
    readFileSync(join(bundlePath(root, CHANGE), "manifest.json"), "utf8"),
  ) as ExploreManifest;
}

// REQ-EXP-002 — Four source types
describe("collector registry", () => {
  it("registers an implementation for every source type", () => {
    expect(Object.keys(COLLECTORS).sort()).toEqual([...SOURCE_TYPES].sort());
    for (const type of SOURCE_TYPES) {
      expect(COLLECTORS[type].type).toBe(type);
    }
  });

  it("rejects an unknown type in the TOML", () => {
    const root = workspace(
      '[[explore.sources]]\nname = "x"\ntype = "carrier-pigeon"\n',
    );
    expect(() => resolveConfig({ cwd: root })).toThrow(ConfigError);
    expect(() => resolveConfig({ cwd: root })).toThrow(/carrier-pigeon/);
  });

  it("rejects a source without a name", () => {
    const root = workspace('[[explore.sources]]\ntype = "git"\n');
    expect(() => resolveConfig({ cwd: root })).toThrow(
      /missing the required key "name"/,
    );
  });
});

// REQ-EXP-003 — Required sources gate the bundle
describe("required sources", () => {
  const failing = (required: boolean) =>
    `[[explore.sources]]\nname = "log"\ntype = "git"\nrequired = ${required}\nargs = ["not-a-git-command"]\n`;

  it("a failing required source aborts the command", async () => {
    const root = workspace(failing(true));
    await expect(
      explore({ card: "ABC-1", change: CHANGE, cwd: root }),
    ).rejects.toThrow(ExploreError);
  });

  it("writes the manifest even when the run is blocked", async () => {
    const root = workspace(failing(true));
    await explore({ card: "ABC-1", change: CHANGE, cwd: root }).catch(
      () => undefined,
    );

    const manifest = readManifest(root);
    expect(manifest.usable).toBe(false);
    expect(manifest.sources[0]?.status).toBe("failed");
    expect(manifest.sources[0]?.error).toBeTruthy();
  });

  it("names the failing source in the error", async () => {
    const root = workspace(failing(true));
    await expect(
      explore({ card: "ABC-1", change: CHANGE, cwd: root }),
    ).rejects.toThrow(/log \(git\)/);
  });

  it("a failing optional source does not abort the command", async () => {
    const root = workspace(failing(false));
    const result = await explore({ card: "ABC-1", change: CHANGE, cwd: root });

    expect(result.manifest.usable).toBe(true);
    expect(result.manifest.sources[0]?.status).toBe("failed");
    expect(result.manifest.sources[0]?.required).toBe(false);
  });
});

// REQ-EXP-004 — Manifest records per-source status
describe("manifest", () => {
  it("records every configured source, including the ones that failed", async () => {
    const root = workspace(
      '[[explore.sources]]\nname = "log"\ntype = "git"\nargs = ["log", "--oneline"]\n\n' +
        '[[explore.sources]]\nname = "broken"\ntype = "git"\nargs = ["nope"]\n',
    );
    const result = await explore({
      card: "ABC-1",
      change: CHANGE,
      cwd: root,
      now: new Date("2026-07-28T12:00:00.000Z"),
    });

    expect(result.manifest.sources.map((s) => [s.name, s.status])).toEqual([
      ["log", "ok"],
      ["broken", "failed"],
    ]);
    expect(result.manifest.sources[0]?.output).toBe("log.json");
    expect(result.manifest.collectedAt).toBe("2026-07-28T12:00:00.000Z");
    expect(result.manifest.card.id).toBe("ABC-1");
  });
});

// REQ-EXP-005 — Redaction before persistence
describe("redaction", () => {
  it("a redacted field never appears in the persisted file", async () => {
    const url = await serveJson({
      card: { id: 7, owner: { name: "ada", email: "ada@example.com" } },
    });
    const root = workspace(
      `[[explore.sources]]\nname = "card"\ntype = "http"\nurl = "${url}"\nredact = ["body.card.owner.email"]\n`,
    );

    const result = await explore({ card: "ABC-1", change: CHANGE, cwd: root });
    expect(result.manifest.sources[0]?.status).toBe("ok");

    const written = readFileSync(
      join(bundlePath(root, CHANGE), "card.json"),
      "utf8",
    );
    expect(written).not.toContain("ada@example.com");
    expect(written).toContain("ada");
    const payload = JSON.parse(written) as {
      body: { card: { owner: Record<string, unknown> } };
    };
    expect(payload.body.card.owner).toEqual({ name: "ada" });
  });
});

// REQ-EXP-006 — Bundle is versioned
describe("bundle location", () => {
  it("writes inside the change directory", async () => {
    const root = workspace(
      '[[explore.sources]]\nname = "log"\ntype = "git"\nargs = ["log", "--oneline"]\n',
    );
    const result = await explore({ card: "ABC-1", change: CHANGE, cwd: root });

    expect(result.bundlePath).toBe(
      join(root, ".specd", "changes", CHANGE, "explore"),
    );
    expect(existsSync(join(result.bundlePath, "manifest.json"))).toBe(true);
    expect(existsSync(join(result.bundlePath, "log.json"))).toBe(true);
  });

  it("creates no .gitignore entry for the bundle", async () => {
    const root = workspace(
      '[[explore.sources]]\nname = "log"\ntype = "git"\nargs = ["log", "--oneline"]\n',
    );
    await explore({ card: "ABC-1", change: CHANGE, cwd: root });

    expect(existsSync(join(root, ".gitignore"))).toBe(false);
    // git sees the bundle as an ordinary untracked file, ready to be committed.
    const listed = spawnSync(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      { cwd: root, encoding: "utf8" },
    );
    expect(listed.stdout).toContain(
      `.specd/changes/${CHANGE}/explore/manifest.json`,
    );
  });
});
