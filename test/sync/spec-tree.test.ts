import { afterEach, describe, expect, it } from "vitest";
import { buildSpecTree } from "../../src/sync/index.js";
import {
  capability,
  cleanupWorkspaces,
  delta,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

const DEMO = capability({ name: "demo", id: "REQ-DEMO-001" });

// REQ-SYNC-016 — the signal `buildSpecTree` used to throw away.
//
// Offline on purpose: the mapping from "an open change removes this identifier"
// to "this capability owns it" is decided entirely on disk, and it decides
// whether a client's card survives an open change. Leaving it to the
// integration suite would put a destructive decision behind Docker.
describe("buildSpecTree retiring", () => {
  it("reports nothing when no change removes anything", () => {
    const { root } = makeWorkspace({ specs: { demo: DEMO } });
    expect([...buildSpecTree(root).retiring]).toEqual([]);
  });

  it("attributes a proposed removal to the capability that owns it", () => {
    const { root } = makeWorkspace({
      specs: { demo: DEMO },
      change: {
        name: "2026-07-kill",
        delta: delta({ change: "2026-07-kill", removed: ["REQ-DEMO-001"] }),
      },
    });
    expect(buildSpecTree(root).retiring.get("demo")).toEqual(["REQ-DEMO-001"]);
  });

  // The requirement has already left the effective spec, so the owner can only
  // come from the capability file on disk. This is the assertion that proves it
  // is read from there and not from the overlay.
  it("finds the owner even though the requirement left the effective spec", () => {
    const { root } = makeWorkspace({
      specs: { demo: DEMO },
      change: {
        name: "2026-07-kill",
        delta: delta({ change: "2026-07-kill", removed: ["REQ-DEMO-001"] }),
      },
    });
    const tree = buildSpecTree(root);
    expect(tree.roots).toEqual([]);
    expect(tree.retiring.get("demo")).toEqual(["REQ-DEMO-001"]);
  });

  // `effectiveSpecs` already reports "REMOVED but exists nowhere" as an error.
  // A second, quieter opinion here would be the tool arguing with itself, and
  // guessing an owner would be P4 broken for no gain.
  it("skips an identifier no capability claims", () => {
    const { root } = makeWorkspace({
      specs: { demo: DEMO },
      change: {
        name: "2026-07-kill",
        delta: delta({ change: "2026-07-kill", removed: ["REQ-GHOST-001"] }),
      },
    });
    expect([...buildSpecTree(root).retiring]).toEqual([]);
  });

  // The disjointness the `findOrphanedLinks` tie-break depends on, asserted
  // instead of assumed. A requirement whose identifier is already in `retired`
  // is refused by the parser, so it never reaches `capability.requirements` and
  // therefore never reaches `retiring`. If that ever stops holding, an
  // identifier could be declared dead and proposed dead at once, and the branch
  // that resolves it would start deciding something for real.
  it("cannot put one identifier in both lists", () => {
    const { root } = makeWorkspace({
      specs: {
        demo: capability({ name: "demo", id: "REQ-DEMO-001" }).replace(
          "retired: []",
          "retired: [REQ-DEMO-001]",
        ),
      },
      change: {
        name: "2026-07-kill",
        delta: delta({ change: "2026-07-kill", removed: ["REQ-DEMO-001"] }),
      },
    });
    const tree = buildSpecTree(root);
    expect(tree.retired.get("demo")).toEqual(["REQ-DEMO-001"]);
    // Refused by the parser, so it owns nothing and cannot also be retiring.
    expect(tree.retiring.get("demo")).toBeUndefined();
  });

  it("keeps `retired` and `retiring` apart", () => {
    const { root } = makeWorkspace({
      specs: {
        demo: capability({ name: "demo", id: "REQ-DEMO-001" }).replace(
          "retired: []",
          "retired: [REQ-DEMO-009]",
        ),
      },
      change: {
        name: "2026-07-kill",
        delta: delta({ change: "2026-07-kill", removed: ["REQ-DEMO-001"] }),
      },
    });
    const tree = buildSpecTree(root);
    expect(tree.retired.get("demo")).toEqual(["REQ-DEMO-009"]);
    expect(tree.retiring.get("demo")).toEqual(["REQ-DEMO-001"]);
  });
});
