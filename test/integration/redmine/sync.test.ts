import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectContent, syncedHash } from "../../../src/sync/hash.js";
import { sync } from "../../../src/sync/index.js";
import {
  loadRedmineEnv,
  makeProject,
  readCapability,
  redmineApi,
  REQUIREMENTS,
  retire,
  retitle,
  type RedmineEnv,
} from "./fixture.js";
import { readBoardLinks } from "../../../src/sync/link.js";

// The acceptance criteria of change `board-sync-redmine`, measured against the Redmine the seed
// built — not against a double. A double would agree with whatever the adapter
// believes, which is exactly the belief under test.

let env: RedmineEnv;
const roots: string[] = [];
const CLIENTE = `
[[board.fields]]
name = "Cliente"
constant = "ACME"
`;

function project(capability: string, fieldsToml = CLIENTE, tokenEnv?: string) {
  const root = makeProject({
    env,
    capability,
    requirements: REQUIREMENTS,
    fieldsToml,
    ...(tokenEnv === undefined ? {} : { tokenEnv }),
  });
  roots.push(root);
  return root;
}

beforeAll(() => {
  env = loadRedmineEnv();
  process.env["SPECD_BOARD_TOKEN"] = env.apiKey;
  process.env["SPECD_BOARD_MEMBER_TOKEN"] = env.memberApiKey;
});

afterAll(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

describe("sync against a live Redmine", () => {
  it("reports the Redmine it is actually talking to", async () => {
    const api = redmineApi(env);
    const { status } = await api.call("GET", "/projects.json");
    expect(status).toBe(200);
    expect(env.version).toMatch(/^6\./);
  });

  // REQ-SYNC-012 — Running twice changes nothing.
  it("creates once, then reports unchanged and creates nothing on a second run", async () => {
    const root = project("demo-create");
    const api = redmineApi(env);
    const before = await api.issueCount();

    const first = await sync({ cwd: root });
    expect(first.counts.create).toBe(3); // one Epic, two Stories
    expect(first.counts.conflict).toBe(0);
    expect(await api.issueCount()).toBe(before + 3);

    const second = await sync({ cwd: root });
    expect(second.counts.unchanged).toBe(3);
    expect(second.counts.create).toBe(0);
    expect(second.counts.push).toBe(0);
    expect(await api.issueCount()).toBe(before + 3);
  });

  // REQ-SYNC-007 — The link lives in the spec frontmatter.
  it("records ref, url, synced_at and synced_hash, and leaves synced_at alone when nothing moved", async () => {
    const root = project("demo-link");
    await sync({ cwd: root });

    const afterFirst = readBoardLinks(readCapability(root, "demo-link"));
    const link = afterFirst["REQ-DEMO-001"];
    expect(link).toBeDefined();
    expect(link?.ref).toMatch(/^\d+$/);
    expect(link?.url).toBe(`${env.url}/issues/${link?.ref}`);
    expect(link?.synced_hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    await sync({ cwd: root });
    const afterSecond = readBoardLinks(readCapability(root, "demo-link"));
    expect(afterSecond["REQ-DEMO-001"]?.synced_at).toBe(link?.synced_at);
  });

  it("pushes a spec edit and leaves the board's own fields untouched", async () => {
    const root = project("demo-push");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "demo-push"))[
      "REQ-DEMO-001"
    ]?.ref as string;

    const api = redmineApi(env);
    // Board-owned change: specd must not undo it.
    await api.call("PUT", `/issues/${ref}.json`, {
      issue: { status_id: 2 },
    });

    retitle(root, "demo-push", "REQ-DEMO-001", "First, revised");
    const report = await sync({ cwd: root });
    expect(report.counts.create).toBe(0);
    expect(report.counts.push).toBe(1);

    const issue = await api.issue(ref);
    expect(issue["subject"]).toContain("First, revised");
    expect((issue["status"] as { id: number }).id).toBe(2);
  });

  // REQ-SYNC-011 — A board refusal is relayed verbatim, never interpreted.
  it("relays the server's message when a required field is omitted", async () => {
    // No [[board.fields]] at all, so `Cliente` is never sent — and, because
    // nothing depends on the definitions, `/custom_fields.json` is never asked.
    const root = project("demo-refusal", "");
    await expect(sync({ cwd: root })).rejects.toThrowError(
      /Cliente cannot be blank/,
    );

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    const refusal = error as { status: number; body: string; exitCode: number };
    expect(refusal.status).toBe(422);
    // Verbatim: the raw body, exactly as Redmine sent it.
    expect(refusal.body).toBe('{"errors":["Cliente cannot be blank"]}');
    expect(refusal.exitCode).toBe(2);
  });

  // REQ-SYNC-010 — Unreadable field definitions refuse, never assume.
  it("refuses with a diagnostic when the token cannot read the field definitions", async () => {
    const root = project("demo-p8", CLIENTE, "SPECD_BOARD_MEMBER_TOKEN");
    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);

    expect((error as Error).name).toBe("FieldDefinitionsUnavailableError");
    expect((error as Error).message).toContain("HTTP 403");
    expect((error as Error).message).toContain(
      "not the same as those fields being absent",
    );
    expect((error as { exitCode: number }).exitCode).toBe(2);

    // And nothing was written: the capability file still holds no link.
    expect(readBoardLinks(readCapability(root, "demo-p8"))).toEqual({});
  });

  it("is not blocked by the admin-only endpoint when no field is configured", async () => {
    const root = project("demo-p8-nofields", "", "SPECD_BOARD_MEMBER_TOKEN");
    // It gets as far as the board refusing the required field, which proves the
    // definitions endpoint was never consulted.
    await expect(sync({ cwd: root })).rejects.toThrowError(
      /Cliente cannot be blank/,
    );
  });

  // REQ-SYNC-005 — Both sides changed is a conflict, and conflicts are never
  // resolved.
  it("exits non-zero listing the conflict, and writes to neither side", async () => {
    const root = project("demo-conflict");
    await sync({ cwd: root });
    const links = readBoardLinks(readCapability(root, "demo-conflict"));
    const ref = links["REQ-DEMO-001"]?.ref as string;
    const untouchedRef = links["REQ-DEMO-002"]?.ref as string;

    const api = redmineApi(env);
    await api.call("PUT", `/issues/${ref}.json`, {
      issue: { subject: "changed on the board" },
    });
    retitle(root, "demo-conflict", "REQ-DEMO-001", "changed in the spec");
    retitle(root, "demo-conflict", "REQ-DEMO-002", "also changed in the spec");

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    expect((error as { exitCode: number }).exitCode).toBe(2);
    expect((error as Error).message).toContain("REQ-DEMO-001");
    expect((error as Error).message).toContain("changed on the board");
    expect((error as Error).message).toContain("Nothing was written");

    // The non-conflicting sibling was not written either: a half-applied sync
    // leaves a state neither side describes.
    expect((await api.issue(untouchedRef))["subject"]).not.toContain(
      "also changed in the spec",
    );
    expect((await api.issue(ref))["subject"]).toBe("changed on the board");
  });

  // REQ-SYNC-013 — Board timestamps filter the scan and decide nothing.
  //
  // The test that turns the run 004 finding into code: attaching a child moves
  // the parent's `updated_on` without changing the parent's content.
  it("does not conflict when a hierarchy change moves the parent's timestamp", async () => {
    const root = project("demo-reorder");
    await sync({ cwd: root });
    const epicRef = readBoardLinks(readCapability(root, "demo-reorder"))[
      "demo-reorder"
    ]?.ref as string;
    expect(epicRef).toBeDefined();

    const api = redmineApi(env);
    const before = (await api.issue(epicRef))["updated_on"] as string;

    // Redmine's `updated_on` has one-second resolution, so a change made in the
    // same second as the read is real but invisible. Waiting is what makes the
    // premise observable rather than a coin flip.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // A foreign child, attached directly on the board.
    const intruder = await api.createIssue({
      project_id: env.project,
      tracker_id: ((await api.issue(epicRef))["tracker"] as { id: number }).id,
      subject: "filho anexado por fora do specd",
      parent_issue_id: Number(epicRef),
      custom_fields: [{ id: env.clienteFieldId, value: "ACME" }],
    });

    const after = (await api.issue(epicRef))["updated_on"] as string;
    // The premise of the test, asserted rather than assumed.
    expect(after).not.toBe(before);

    const report = await sync({ cwd: root });
    expect(report.counts.conflict).toBe(0);
    const epic = report.actions.find((action) => action.key === "demo-reorder");
    expect(epic?.outcome).toBe("unchanged");

    await api.deleteIssue(intruder);
  });

  // REQ-SYNC-003 — `close` is the single status write, and it is confirmed.
  //
  // Reachable rather than decorative: an operation nothing invokes is a
  // requirement that passes vacuously.
  // change `orphan-guard-and-documented-formats` narrowed this: removing the block is no longer enough. The death
  // has to be declared in `retired`, which is what `archive` writes — otherwise
  // a typo would close a client's card (REQ-SYNC-014).
  it("closes the board item of a requirement declared retired, and confirms it landed", async () => {
    const root = project("demo-close");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "demo-close"))[
      "REQ-DEMO-002"
    ]?.ref as string;

    retire(root, "demo-close", "REQ-DEMO-002");
    const report = await sync({ cwd: root });
    expect(report.counts.closed).toBe(1);

    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(true);

    // The link goes with it: a closed item is not "synced and unchanged".
    expect(
      readBoardLinks(readCapability(root, "demo-close"))["REQ-DEMO-002"],
    ).toBeUndefined();
  });

  // REQ-SYNC-004 — measured against real payloads rather than synthesized ones.
  it("hashes an empty multi-valued field the same as an empty single-valued one", async () => {
    const api = redmineApi(env);
    const id = await api.createIssue({
      project_id: env.project,
      tracker_id: 6,
      subject: `hash shape probe ${Date.now()}`,
      custom_fields: [{ id: env.clienteFieldId, value: "ACME" }],
    });
    const issue = await api.issue(id);
    const fields = issue["custom_fields"] as {
      id: number;
      name: string;
      value: string | string[] | null;
    }[];

    const sprint = fields.find((field) => field.id === env.sprintFieldId);
    const times = fields.find((field) => field.id === env.timesFieldId);
    // The two shapes of absence, as the server actually returns them.
    expect(sprint?.value).toBeNull();
    expect(times?.value).toEqual([]);

    const asSingle = syncedHash(
      projectContent({
        title: "t",
        body: "b",
        fields: [{ id: 9, name: "x", value: sprint?.value ?? null }],
      }),
    );
    const asMultiple = syncedHash(
      projectContent({
        title: "t",
        body: "b",
        fields: [{ id: 9, name: "x", value: times?.value ?? null }],
      }),
    );
    expect(asSingle).toBe(asMultiple);

    await api.deleteIssue(id);
  });
});
