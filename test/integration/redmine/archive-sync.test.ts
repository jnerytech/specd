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

// A change that adds one requirement and removes one, so both halves of the
// archive are exercised: the new card, and the retirement that lets REQ-SYNC-014
// close the old one.
function makeBase(capability: string, board = true): string {
  const root = makeProject({
    env,
    capability,
    requirements: REQUIREMENTS,
    fieldsToml: CLIENTE,
  });
  roots.push(root);

  if (!board) {
    writeFileSync(
      join(root, ".specd", "config.toml"),
      '[project]\nlanguage = "pt-BR"\n',
      "utf8",
    );
  }
  return root;
}

// Adds the change on top of an existing project. Separate from `makeBase`
// because a requirement under REMOVED leaves the effective spec the moment the
// change is opened — so a card for it has to be created *before* the change
// exists, which is also what happens in real life.
function addChange(root: string, capability: string): string {
  const dir = join(root, ".specd", "changes", "demo-change");
  mkdirSync(join(dir, "tasks"), { recursive: true });
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

## MODIFIED

Nenhum.

## REMOVED

- REQ-DEMO-002
`,
    "utf8",
  );
  // The evidence layer consults git when a task claims completion, and
  // `archive` runs coverage and evidence before applying anything. A throwaway
  // project therefore needs a real history with a real commit.
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
    `---
id: "001-third"
change: demo-change
req: [REQ-DEMO-003]
status: done
evidence:
  commits: ["${sha}"]
---

## Objetivo

Terceira coisa.
`,
    "utf8",
  );
  return root;
}

function withChange(capability: string, board = true): string {
  return addChange(makeBase(capability, board), capability);
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

describe("archive --sync against a live Redmine", () => {
  // REQ-ARC-013 — the count, without touching the network.
  it("reports what stayed out of sync when the flag is absent", async () => {
    const root = withChange("arc-report");
    const result = await archive("demo-change", { cwd: root });

    expect(result.synced).toBeUndefined();
    expect(result.unsynced?.missing).toContain("REQ-DEMO-003");
    expect(result.unsynced?.missing).toContain("arc-report");
    expect(result.unsynced?.total).toBeGreaterThan(0);

    // Nothing reached the board.
    expect(readBoardLinks(readCapability(root, "arc-report"))).toEqual({});
  });

  it("says zero out loud rather than omitting it", async () => {
    // A change that only removes has nothing to add or rewrite, so the honest
    // count is zero — and zero has to be said, not left out.
    const root = withChange("arc-zero");
    writeFileSync(
      join(root, ".specd", "changes", "demo-change", "delta.md"),
      `---
change: demo-change
---

# Delta

## ADDED

Nenhum.

## MODIFIED

Nenhum.

## REMOVED

- REQ-DEMO-002
`,
      "utf8",
    );
    writeFileSync(
      join(root, ".specd", "changes", "demo-change", "tasks", "001-third.md"),
      `---
id: "001-third"
change: demo-change
req: [REQ-DEMO-001]
status: pending
evidence:
  commits: []
---

## Objetivo

Nada a adicionar.
`,
      "utf8",
    );

    const result = await archive("demo-change", { cwd: root });
    expect(result.unsynced).toEqual({ total: 0, missing: [], stale: [] });
  });

  it("does not report a count at all when no board is configured", async () => {
    const root = withChange("arc-noboard", false);
    const result = await archive("demo-change", { cwd: root });
    expect(result.unsynced).toBeUndefined();
    expect(result.synced).toBeUndefined();
  });

  // REQ-ARC-011 — opt-in, and after the capabilities are written.
  it("syncs after applying when asked, and closes the retired requirement", async () => {
    // The card has to exist before the change does: a requirement under REMOVED
    // leaves the effective spec as soon as the change is opened.
    const root = makeBase("arc-sync");
    const { sync } = await import("../../../src/sync/index.js");
    await sync({ cwd: root });
    const doomed = readBoardLinks(readCapability(root, "arc-sync"))[
      "REQ-DEMO-002"
    ]?.ref as string;
    expect(doomed).toBeDefined();

    addChange(root, "arc-sync");

    // REQ-SYNC-016. While the change is open the death is proposed and not
    // declared, so a plain `sync` leaves the card alone and says so — it used
    // to refuse, which blocked `sync` for the whole life of the change.
    // `archive --sync` is what turns the proposal into `retired`, and then into
    // a closed card.
    // The two moments, in one run. The requirement the change ADDs becomes real
    // on the board right away, because the board projects the plan; the one it
    // REMOVEs stays open, because the death is proposed and not declared.
    const proposed = await sync({ cwd: root });
    expect(proposed.counts.create).toBe(1);
    expect(proposed.counts.retiring).toBe(1);
    expect(proposed.counts.closed).toBe(0);
    expect(
      (await redmineApi(env).issue(doomed))["status"] as { is_closed: boolean },
    ).toMatchObject({ is_closed: false });

    const result = await archive("demo-change", { cwd: root, sync: true });

    expect(result.destination).toContain("archive/demo-change");
    expect(result.synced).toBeDefined();
    // Nothing new to create — the card already exists from the run above. What
    // `archive` adds is the declaration, and that is what closes the old card.
    expect(result.synced?.counts.create).toBe(0);
    expect(result.synced?.counts.retiring).toBe(0);
    expect(result.synced?.counts.closed).toBe(1);

    const links = readBoardLinks(readCapability(root, "arc-sync"));
    expect(links["REQ-DEMO-003"]).toBeDefined();
    expect(links["REQ-DEMO-002"]).toBeUndefined();

    const issue = await redmineApi(env).issue(doomed);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(true);
  });

  // REQ-ARC-011 — a knowable misconfiguration is caught before anything moves.
  it("refuses --sync without a board before applying the delta", async () => {
    const root = withChange("arc-nosync-board", false);
    await expect(
      archive("demo-change", { cwd: root, sync: true }),
    ).rejects.toThrowError(/needs a board/);

    // The change is still open and the capability untouched.
    expect(readCapability(root, "arc-nosync-board")).not.toContain(
      "REQ-DEMO-003",
    );
  });

  // REQ-SYNC-014 through the real cycle: the delta says REMOVED plus ADDED with
  // the same body, `archive` writes `retired` and the new block, and the sync
  // that follows has to refuse instead of closing. This is the rename of an
  // already realized requirement, written in the only vocabulary the delta has.
  it("refuses after archiving a removal whose body came back under a new identifier", async () => {
    const root = makeBase("arc-rename");
    const { sync } = await import("../../../src/sync/index.js");
    await sync({ cwd: root });
    const doomed = readBoardLinks(readCapability(root, "arc-rename"))[
      "REQ-DEMO-002"
    ]?.ref as string;

    // The change removes REQ-DEMO-002 and adds REQ-DEMO-003 carrying its body.
    addChange(root, "arc-rename");
    writeFileSync(
      join(root, ".specd", "changes", "demo-change", "delta.md"),
      `---
change: demo-change
---

# Delta

## ADDED

### REQ-DEMO-003 — Second

**Capability.** arc-rename

**Statement.** The demo system SHALL do the second thing.

**Acceptance.**

- segundo critério

## MODIFIED

Nenhum.

## REMOVED

- REQ-DEMO-002
`,
      "utf8",
    );

    await archive("demo-change", { cwd: root });

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    expect((error as Error).name).toBe("UndeclaredOrphanError");
    expect((error as Error).message).toContain("listed as retired");
    expect((error as Error).message).toContain("REQ-DEMO-003");

    // The card survived the archive: the spec moved and the board did not.
    const issue = await redmineApi(env).issue(doomed);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(false);
    expect(
      readBoardLinks(readCapability(root, "arc-rename"))["REQ-DEMO-003"],
    ).toBeUndefined();
  });

  // REQ-ARC-012 — the spec moves ahead, and stays there.
  it("keeps the archive when the board write fails", async () => {
    const root = withChange("arc-failure");
    const { sync } = await import("../../../src/sync/index.js");
    await sync({ cwd: root });

    // Point the token at nothing, so the reconciliation cannot authenticate.
    process.env["SPECD_BOARD_TOKEN"] = "not-a-valid-api-key";
    const error = await archive("demo-change", {
      cwd: root,
      sync: true,
    }).catch((cause: unknown) => cause);
    process.env["SPECD_BOARD_TOKEN"] = env.apiKey;

    expect((error as Error).name).toBe("ArchiveSyncError");
    expect((error as { exitCode: number }).exitCode).toBe(2);
    expect((error as Error).message).toContain("was not updated");
    expect((error as Error).message).toContain("specd sync");

    // Nothing was undone: the capability holds the applied delta and the change
    // directory is archived.
    expect(readCapability(root, "arc-failure")).toContain("REQ-DEMO-003");
    expect(
      existsSync(join(root, ".specd", "changes", "archive", "demo-change")),
    ).toBe(true);
    expect(existsSync(join(root, ".specd", "changes", "demo-change"))).toBe(
      false,
    );
  });
});
