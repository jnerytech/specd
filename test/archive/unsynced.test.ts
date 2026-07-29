import { describe, expect, it } from "vitest";
import { countUnsyncedItems } from "../../src/archive/index.js";
import { parseDelta } from "../../src/parser/delta.js";

const DELTA = `---
change: demo-change
---

# Delta

## ADDED

### REQ-D-001 — First

**Capability.** demo

**Statement.** The demo system SHALL do the first thing.

**Acceptance.**
- um critério

## MODIFIED

### REQ-D-000 — Older

**Capability.** demo

**Statement.** The demo system SHALL do the older thing differently.

**Acceptance.**
- outro critério

## REMOVED

Nenhum.
`;

const delta = parseDelta(DELTA, "delta.md").delta!;

// REQ-ARC-013 — Archive without the flag reports what stayed out of sync.
//
// Counted from the applied delta and the recorded links, with no request: a
// local operation that needs the network is one more place the tool stops
// working for a reason that is not its own.
describe("countUnsyncedItems", () => {
  it("counts an added requirement the board has never seen", () => {
    const count = countUnsyncedItems(delta, new Set(["REQ-D-000", "demo"]));
    expect(count.missing).toEqual(["REQ-D-001"]);
    // REQ-D-000 is linked and this change rewrote it, so the card holds the
    // old text: stale, not missing.
    expect(count.stale).toEqual(["REQ-D-000"]);
    expect(count.total).toBe(2);
  });

  it("counts a modified requirement whose card still holds the old text", () => {
    const count = countUnsyncedItems(
      delta,
      new Set(["REQ-D-001", "REQ-D-000", "demo"]),
    );
    expect(count.missing).toEqual([]);
    expect(count.stale).toEqual(["REQ-D-000"]);
  });

  it("counts the capability item itself when it has no link", () => {
    const count = countUnsyncedItems(
      delta,
      new Set(["REQ-D-001", "REQ-D-000"]),
    );
    expect(count.missing).toContain("demo");
  });

  it("reports zero when everything is linked and nothing was modified", () => {
    const added = parseDelta(
      DELTA.replace(
        /## MODIFIED[\s\S]*?## REMOVED/,
        "## MODIFIED\n\nNenhum.\n\n## REMOVED",
      ),
      "delta.md",
    ).delta!;
    const count = countUnsyncedItems(added, new Set(["REQ-D-001", "demo"]));
    expect(count.total).toBe(0);
    expect(count).toEqual({ total: 0, missing: [], stale: [] });
  });

  it("never asks the board: it is a pure function of delta and links", () => {
    // No adapter, no fetch, no configuration. If this ever needs one, the
    // signature is where it would show up.
    expect(countUnsyncedItems.length).toBe(2);
  });
});
