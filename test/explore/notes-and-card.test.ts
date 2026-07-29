import { readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalError } from "../../src/core/operational.js";
import { explore } from "../../src/explore/index.js";
import {
  assertCardMatchesChange,
  parseCardRef,
} from "../../src/explore/card-ref.js";
import { NOTES_FILE, notesPath } from "../../src/explore/paths.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  deltaRequirement,
  makeWorkspace,
  proposal,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const CHANGE = "2026-07-demo";
const NOTES = "# Exploration\n\nWhat the code actually looks like.\n";

function workspace(card?: { ref: string; url: string }) {
  return makeWorkspace({
    // No source is configured, so nothing reaches the network.
    config: "",
    specs: { demo: capability({ name: "demo", id: "REQ-DEMO-001" }) },
    change: {
      name: CHANGE,
      delta: delta({
        change: CHANGE,
        added: [deltaRequirement({ id: "REQ-DEMO-002", capability: "demo" })],
      }),
      proposal: proposal({
        change: CHANGE,
        ...(card === undefined ? {} : { card }),
      }),
    },
  });
}

// REQ-EXP-010 — The exploration notes sit beside the bundle and are never
// validated.
describe("explore notes — REQ-EXP-010", () => {
  it("names where the notes belong without writing them", async () => {
    const { root } = workspace();

    const result = await explore({ card: "4821", change: CHANGE, cwd: root });

    expect(result.notesPath).toBe(notesPath(root, CHANGE));
    expect(() => readFileSync(result.notesPath, "utf8")).toThrowError();
  });

  it("leaves the notes untouched across two runs", async () => {
    const { root } = workspace();
    await explore({ card: "4821", change: CHANGE, cwd: root });
    writeFileSync(notesPath(root, CHANGE), NOTES);

    await explore({ card: "4821", change: CHANGE, cwd: root });

    expect(readFileSync(notesPath(root, CHANGE), "utf8")).toBe(NOTES);
  });

  it("keeps the notes out of the manifest", async () => {
    const { root } = workspace();
    await explore({ card: "4821", change: CHANGE, cwd: root });
    writeFileSync(notesPath(root, CHANGE), NOTES);

    const result = await explore({ card: "4821", change: CHANGE, cwd: root });

    expect(JSON.stringify(result.manifest)).not.toContain(NOTES_FILE);
  });
});

// REQ-EXP-011 — A card that contradicts the change stops the run.
describe("card conflict — REQ-EXP-011", () => {
  const declared = { ref: "4821", url: "https://board.example/issues/4821" };

  it("proceeds when the argument names the declared card", () => {
    expect(() =>
      assertCardMatchesChange(parseCardRef("4821"), declared, CHANGE),
    ).not.toThrowError();
  });

  it("proceeds when the same card is cited as a URL", () => {
    expect(() =>
      assertCardMatchesChange(
        parseCardRef("https://board.example/issues/4821"),
        declared,
        CHANGE,
      ),
    ).not.toThrowError();
  });

  it("proceeds when the change declares no card", () => {
    expect(() =>
      assertCardMatchesChange(parseCardRef("4821"), undefined, CHANGE),
    ).not.toThrowError();
  });

  it("stops when the argument names another card, citing both", () => {
    const failure = (() => {
      try {
        assertCardMatchesChange(parseCardRef("4999"), declared, CHANGE);
        return undefined;
      } catch (cause) {
        return cause;
      }
    })();

    expect(failure).toBeInstanceOf(OperationalError);
    expect((failure as Error).message).toContain("4821");
    expect((failure as Error).message).toContain("4999");
  });

  it("refuses before writing anything into the bundle", async () => {
    const { root } = workspace(declared);

    await expect(
      explore({ card: "4999", change: CHANGE, cwd: root }),
    ).rejects.toBeInstanceOf(OperationalError);
    expect(() =>
      readFileSync(`${root}/.specd/changes/${CHANGE}/explore/manifest.json`),
    ).toThrowError();
  });

  it("collects when the declared card is the one being explored", async () => {
    const { root } = workspace(declared);

    const result = await explore({ card: "4821", change: CHANGE, cwd: root });

    expect(result.manifest.card.id).toBe("4821");
  });
});
