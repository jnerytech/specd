import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { archive } from "../../../src/archive/index.js";
import { readBoardLinks } from "../../../src/sync/link.js";
import {
  loadRedmineEnv,
  makeProject,
  readCapability,
  redmineApi,
  REQUIREMENTS,
  type RedmineEnv,
} from "./fixture.js";

let env: RedmineEnv;
const roots: string[] = [];

const CLIENTE = `
[[board.fields]]
name = "Cliente"
constant = "ACME"
`;

// `Resolved` is seeded and is not a closed status, which is the whole point:
// REQ-SYNC-017 exists so a change can be handed over without being buried.
const ARCHIVED_STATUS = "Resolved";

function project(capability: string, mappingToml: string): string {
  const root = makeProject({
    env,
    capability,
    requirements: REQUIREMENTS,
    fieldsToml: CLIENTE,
    mappingToml,
  });
  roots.push(root);

  const dir = join(root, ".specd", "changes", "demo-change");
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(
    join(dir, "proposal.md"),
    `---\nchange: demo-change\nstatus: active\n` +
      `card:\n  ref: "1"\n  url: "${env.url}/issues/1"\n---\n\n# demo-change\n`,
    "utf8",
  );
  writeFileSync(
    join(dir, "delta.md"),
    `---
change: demo-change
---

# Delta

## ADDED

### REQ-DEMO-003 — Third

**Capability.** ${capability}

**Statement.** The demo system SHALL do the third thing.

**Acceptance.**

- terceiro critério
`,
    "utf8",
  );

  // REQ-ARC-016: `archive` demands the proposal record, and an empty one is a
  // mark rather than an absence — these fixtures have nothing to record.
  writeFileSync(
    join(dir, "propose.json"),
    `${JSON.stringify({ version: 1, change: "demo-change", requirements: [] }, null, 2)}\n`,
    "utf8",
  );

  const git = (...args: string[]): string =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "specd test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "specd test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    });
  if (!existsSync(join(root, ".git"))) git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "--allow-empty", "-m", "fixture");
  const sha = git("rev-parse", "HEAD").trim();

  writeFileSync(
    join(dir, "tasks", "001-third.md"),
    `---\nid: "001-third"\nchange: demo-change\nreq: [REQ-DEMO-003]\n` +
      `status: done\nevidence:\n  commits: ["${sha}"]\n---\n\n## Objetivo\n\nTerceira coisa.\n`,
    "utf8",
  );
  return root;
}

async function statusOf(id: string): Promise<string> {
  const issue = (await redmineApi(env).issue(id)) as {
    status: { name: string };
  };
  return issue.status.name;
}

beforeAll(() => {
  env = loadRedmineEnv();
  process.env["SPECD_BOARD_TOKEN"] = env.apiKey;
});

afterAll(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

describe("archive --sync transitions against a live Redmine", () => {
  // REQ-ARC-014 / REQ-SYNC-017 — the item is handed over, not buried.
  it("moves every item of the archived change to the configured status", async () => {
    const root = project(
      "arc-handover",
      `archived_status = "${ARCHIVED_STATUS}"`,
    );

    const result = await archive("demo-change", { cwd: root, sync: true });

    expect(result.transitioned?.status).toBe(ARCHIVED_STATUS);
    expect(result.transitioned?.items).toContain("REQ-DEMO-003");
    expect(result.transitioned?.items).toContain("arc-handover");

    const links = readBoardLinks(readCapability(root, "arc-handover"));
    for (const key of result.transitioned?.items ?? []) {
      const ref = links[key]?.ref as string;
      // Read from the board, not from the response of the write: a 204 is not
      // evidence that the status moved.
      expect(await statusOf(ref)).toBe(ARCHIVED_STATUS);
    }
  });

  it("attempts no transition when no archived_status is configured", async () => {
    const root = project("arc-no-status", "");

    const result = await archive("demo-change", { cwd: root, sync: true });

    expect(result.transitioned).toEqual({ items: [] });

    const links = readBoardLinks(readCapability(root, "arc-no-status"));
    const ref = links["REQ-DEMO-003"]?.ref as string;
    // The content was reconciled; the status was left where the board had it.
    expect(await statusOf(ref)).toBe("New");
  });

  it("refuses a status the board does not have, and leaves the archive standing", async () => {
    const root = project("arc-bad-status", 'archived_status = "Homologação"');

    await expect(
      archive("demo-change", { cwd: root, sync: true }),
    ).rejects.toThrowError(/Homologação/);

    // REQ-ARC-012: the spec moved ahead of the board and nothing was undone.
    expect(
      existsSync(join(root, ".specd", "changes", "archive", "demo-change")),
    ).toBe(true);
  });
});
