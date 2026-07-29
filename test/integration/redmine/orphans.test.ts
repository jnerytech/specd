import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sync } from "../../../src/sync/index.js";
import { readBoardLinks } from "../../../src/sync/link.js";
import {
  copyRequirement,
  dropRequirement,
  loadRedmineEnv,
  makeProject,
  openRemovalChange,
  readCapability,
  redmineApi,
  renameRequirement,
  REQUIREMENTS,
  retire,
  rewordStatement,
  type RedmineEnv,
} from "./fixture.js";

// REQ-SYNC-014 and REQ-SYNC-015, measured against the container.
//
// The middle case is the one that reproduces run 006: a rename closed a client's
// card and created another, discarding whatever a person had left on the first.
// Without it against the real board, the fix is an argument.

let env: RedmineEnv;
const roots: string[] = [];
const CLIENTE = `
[[board.fields]]
name = "Cliente"
constant = "ACME"
`;

function project(capability: string) {
  const root = makeProject({
    env,
    capability,
    requirements: REQUIREMENTS,
    fieldsToml: CLIENTE,
  });
  roots.push(root);
  return root;
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

describe("orphaned links against a live Redmine", () => {
  // Path 1 — declared death.
  it("closes the card when the identifier is listed as retired", async () => {
    const root = project("orphan-retired");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "orphan-retired"))[
      "REQ-DEMO-002"
    ]?.ref as string;

    retire(root, "orphan-retired", "REQ-DEMO-002");
    const report = await sync({ cwd: root });
    expect(report.counts.closed).toBe(1);

    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(true);
    expect(
      readBoardLinks(readCapability(root, "orphan-retired"))["REQ-DEMO-002"],
    ).toBeUndefined();
  });

  // Path 2 — the run 006 case. A rename, and nothing declared.
  it("refuses a rename and names both sides, leaving the card open", async () => {
    const root = project("orphan-rename");
    await sync({ cwd: root });
    const before = readBoardLinks(readCapability(root, "orphan-rename"));
    const ref = before["REQ-DEMO-002"]?.ref as string;

    renameRequirement(root, "orphan-rename", "REQ-DEMO-002", "REQ-DEMO-009");

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    expect((error as Error).name).toBe("UndeclaredOrphanError");
    expect((error as { exitCode: number }).exitCode).toBe(2);
    expect((error as Error).message).toContain("REQ-DEMO-002");
    expect((error as Error).message).toContain("REQ-DEMO-009");
    expect((error as Error).message).toContain("probably a rename");

    // The card is untouched and still open — this is the whole point.
    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(false);

    // And nothing was created for the new identifier, nor written to the spec.
    const after = readBoardLinks(readCapability(root, "orphan-rename"));
    expect(after["REQ-DEMO-009"]).toBeUndefined();
    expect(after["REQ-DEMO-002"]?.ref).toBe(ref);
  });

  // Following the message's own instructions has to actually work.
  it("accepts the rename once the link key is moved by hand", async () => {
    const root = project("orphan-rename-fixed");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "orphan-rename-fixed"))[
      "REQ-DEMO-002"
    ]?.ref as string;

    renameRequirement(
      root,
      "orphan-rename-fixed",
      "REQ-DEMO-002",
      "REQ-DEMO-009",
    );
    // The one-line edit the error tells the author to make.
    const { writeFileSync } = await import("node:fs");
    const { capabilityPath } = await import("./fixture.js");
    const path = capabilityPath(root, "orphan-rename-fixed");
    writeFileSync(
      path,
      readCapability(root, "orphan-rename-fixed").replace(
        "  REQ-DEMO-002:",
        "  REQ-DEMO-009:",
      ),
      "utf8",
    );

    const report = await sync({ cwd: root });
    expect(report.counts.closed).toBe(0);
    expect(report.counts.create).toBe(0);
    // The title carries the identifier, so the rename is a push, not a new card.
    expect(report.counts.push).toBe(1);

    const issue = await redmineApi(env).issue(ref);
    expect(issue["subject"]).toContain("REQ-DEMO-009");
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(false);
  });

  // Path 3 — gone, and nothing looks like it.
  it("refuses a disappearance with no candidate, and closes nothing", async () => {
    const root = project("orphan-vanished");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "orphan-vanished"))[
      "REQ-DEMO-002"
    ]?.ref as string;

    // Removed without being retired — a typo, or a careless delete.
    dropRequirement(root, "orphan-vanished", "REQ-DEMO-002");

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    expect((error as Error).name).toBe("UndeclaredOrphanError");
    expect((error as Error).message).not.toContain("probably a rename");
    expect((error as Error).message).toContain("retired");

    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(false);
  });

  // REQ-SYNC-015: the refusal is global, like the conflict refusal.
  it("writes nothing for the healthy items of the same run", async () => {
    const root = project("orphan-blast-radius");
    await sync({ cwd: root });
    const links = readBoardLinks(readCapability(root, "orphan-blast-radius"));
    const survivor = links["REQ-DEMO-001"]?.ref as string;
    const before = (await redmineApi(env).issue(survivor))["updated_on"];

    dropRequirement(root, "orphan-blast-radius", "REQ-DEMO-002");
    // Also edit the survivor, so a partial run would be visible.
    const { writeFileSync } = await import("node:fs");
    const { capabilityPath } = await import("./fixture.js");
    writeFileSync(
      capabilityPath(root, "orphan-blast-radius"),
      readCapability(root, "orphan-blast-radius").replace(
        "### REQ-DEMO-001 — First",
        "### REQ-DEMO-001 — First, edited",
      ),
      "utf8",
    );

    await expect(sync({ cwd: root })).rejects.toThrowError(
      /was not told to close/,
    );
    expect((await redmineApi(env).issue(survivor))["updated_on"]).toBe(before);
  });

  // The Fatia 8 correction, in the state `archive` leaves behind: the
  // identifier is in `retired` and the same body is now under another one.
  // Before this, the declared path skipped the body check entirely and the card
  // closed without a word.
  it("refuses a declared death whose body reappeared, and leaves the card open", async () => {
    const root = project("orphan-declared-rename");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "orphan-declared-rename"))[
      "REQ-DEMO-002"
    ]?.ref as string;

    // What `archive` writes for `REMOVED: REQ-DEMO-002` plus
    // `ADDED: REQ-DEMO-009` carrying the same body: the new block appears, the
    // old one goes and its identifier lands in `retired`.
    copyRequirement(
      root,
      "orphan-declared-rename",
      "REQ-DEMO-002",
      "REQ-DEMO-009",
    );
    retire(root, "orphan-declared-rename", "REQ-DEMO-002");

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    expect((error as Error).name).toBe("UndeclaredOrphanError");
    expect((error as { exitCode: number }).exitCode).toBe(2);
    expect((error as Error).message).toContain("listed as retired");
    expect((error as Error).message).toContain("REQ-DEMO-009");

    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(false);

    const after = readBoardLinks(
      readCapability(root, "orphan-declared-rename"),
    );
    expect(after["REQ-DEMO-009"]).toBeUndefined();
    expect(after["REQ-DEMO-002"]?.ref).toBe(ref);
  });

  // REQ-SYNC-014 — the declared limit, measured rather than supposed.
  //
  // The protection is by body, so a rename that also edits a word of the
  // statement produces no candidate, and the card closes. Knowing the size of
  // the hole is worth more than assuming there is none.
  it("closes the card when the rename also edits the body", async () => {
    const root = project("orphan-declared-reworded");
    await sync({ cwd: root });
    const ref = readBoardLinks(
      readCapability(root, "orphan-declared-reworded"),
    )["REQ-DEMO-002"]?.ref as string;

    copyRequirement(
      root,
      "orphan-declared-reworded",
      "REQ-DEMO-002",
      "REQ-DEMO-009",
    );
    retire(root, "orphan-declared-reworded", "REQ-DEMO-002");
    rewordStatement(
      root,
      "orphan-declared-reworded",
      "REQ-DEMO-009",
      "The demo system SHALL do the second thing, reworded.",
    );

    const report = await sync({ cwd: root });
    expect(report.counts.closed).toBe(1);
    expect(report.counts.create).toBe(1);

    // The card really closes. This is the declared limit of REQ-SYNC-014, and
    // the assertion exists so that it is a measured hole and not a supposition.
    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(true);
  });

  // REQ-SYNC-016 — a death an open change proposes is not a death yet.
  it("leaves the card alone while the removal is only proposed", async () => {
    const root = project("orphan-proposed");
    await sync({ cwd: root });
    const ref = readBoardLinks(readCapability(root, "orphan-proposed"))[
      "REQ-DEMO-002"
    ]?.ref as string;
    const before = (await redmineApi(env).issue(ref))["updated_on"];

    openRemovalChange(root, "2026-07-proposed", "REQ-DEMO-002");

    const report = await sync({ cwd: root });
    expect(report.counts.retiring).toBe(1);
    expect(report.counts.closed).toBe(0);
    expect(
      report.actions.find((action) => action.key === "REQ-DEMO-002")?.outcome,
    ).toBe("retiring");

    // Untouched on the board, and the link stays where `archive` will find it.
    const issue = await redmineApi(env).issue(ref);
    expect((issue["status"] as { is_closed: boolean }).is_closed).toBe(false);
    expect(issue["updated_on"]).toBe(before);
    expect(
      readBoardLinks(readCapability(root, "orphan-proposed"))["REQ-DEMO-002"]
        ?.ref,
    ).toBe(ref);
  });

  // Body still outranks the proposal.
  //
  // The block stays in the capability — otherwise the identifier would have no
  // owner and the death would read as `none`, and the test would pass for the
  // wrong reason. The delta proposes removing it while an identical body
  // appears under a second identifier: proposed *and* ambiguous.
  it("refuses when a proposed removal's body reappears elsewhere", async () => {
    const root = project("orphan-proposed-rename");
    await sync({ cwd: root });

    openRemovalChange(root, "2026-07-proposed-rename", "REQ-DEMO-002");
    copyRequirement(
      root,
      "orphan-proposed-rename",
      "REQ-DEMO-002",
      "REQ-DEMO-009",
    );

    const error = await sync({ cwd: root }).catch((cause: unknown) => cause);
    expect((error as Error).name).toBe("UndeclaredOrphanError");
    expect((error as Error).message).toContain("probably a rename");
    expect((error as Error).message).toContain("REQ-DEMO-009");
  });
});
