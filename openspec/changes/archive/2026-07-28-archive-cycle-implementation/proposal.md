## Why

change `verify-gate-and-anchor-ladder` shipped a gate and no way to close a change. The repository could not archive its own finished work, and `.specd/specs/` accumulated requirements no change claimed. `migracao-modelo-b` corrected the placement; this change builds the machinery that keeps it correct.

It is also the last change tracked in both OpenSpec and `.specd/changes/`. Dual tracking existed only while a `.specd` change could not be closed. Once `specd archive` works, opening a change under `openspec/changes/` is a regression.

## What Changes

**The overlay is the core.** `effectiveSpecs()` applies the deltas of open changes on top of `.specd/specs/` — `specs ⊕ ADDED ⊕ MODIFIED ⊖ REMOVED` — and tags every requirement with its origin. Every layer consumes the result and `archive` persists it, so "archive wrote something different from what verify validated" cannot happen.

- **`readOpenChanges`** replaces `readActiveChange`. Plural, with `archive/` excluded explicitly. No consumer picks one change out of several, so no-guessing-on-conflict stops being violated by `sort()[0]`.
- **`parseDelta` and `parseTask`.** A requirement block in a delta has the same shape as one in a capability, so this reframes `parseRequirement` rather than adding a parser.
- **The schema layer reads the effective spec**, not only the capabilities. Without that the gate would be green because it was not looking: it went from examining 41 requirements to 65.
- **Anchor policy grades by origin** (REQ-ANC-006). Dangling in `.specd/specs/` is drift; dangling in an open change's delta is pending work.
- **Coverage and evidence layers.** Evidence in three tiers, one per outcome: empty commits on a `done` task rejects, an unreachable SHA warns, an unavailable history exits 2.
- **`specd archive`** (REQ-ARC-001..010) and **`specd anchor fix`** (REQ-ANC-008).
- **`specd status`** locates a requirement, and reports each open change's age and warning debt.
- **A directory without `.specd/specs/` exits 2** instead of passing vacuously.

## Capabilities

### New Capabilities

- `archive-cycle-implementation`: pointer spec mapping this change's work to the REQ-IDs of `.specd/specs/` and the change `archive-cycle-and-effective-specs` delta, by reference. The authoritative contract is `.specd/`.

### Modified Capabilities

None. `openspec/specs/` stays empty by the decision taken when `verify-gate-implementation` was archived.

## Impact

- New: `src/parser/{delta,task,sections,frontmatter}.ts`, `src/verify/{changes,effective}.ts`, `src/verify/layers/{coverage,evidence}.ts`, `src/archive/{index,apply}.ts`, `src/anchors/fix.ts`, `src/status/{locate,changes}.ts`, `src/core/operational.ts`.
- Removed: `src/verify/active-change.ts`, `src/status/tasks.ts` — both replaced by the validating readers their requirements' anchors always named.
- 58 new tests across 6 files; 286 total.
- `.specd/config.toml` gains `coverage` and `evidence`. `provenance` stays off.

## Self-application

The acceptance criterion, run in order:

```
specd archive 2026-07-28-verify-gate-and-anchor-ladder   → exit 0
specd archive 2026-07-28-archive-cycle-and-effective-specs   → exit 0, 6 capability files written
specd verify                    → exit 0, one warning, from change `provenance-and-mcp-transport`
```

Requirement conservation holds throughout: 65 before, 65 after — 64 realized in `.specd/specs/`, 1 in flight in the change `provenance-and-mcp-transport` delta.

## Findings

**Step 1 passed vacuously, and that is worth stating plainly.** `2026-07-28-verify-gate-and-anchor-ladder`'s `delta.md` is a Modelo A manifest — identifiers in bullet lists under `### cli` headings. The new `parseDelta` reads zero requirement blocks in it, so `archive` applied nothing and moved the directory. The outcome is correct, because the 39 requirements change `verify-gate-and-anchor-ladder` delivered were written straight into `.specd/specs/` when `archive` did not exist. But it is correct by accident: the tool verified nothing. Step 2 is the real proof.

**The parser is silent about a delta it cannot read.** A section containing prose or bullets rather than requirement blocks yields zero requirements and no diagnostic. REQ-FMT-005's acceptance criteria do not ask for that check, and a gate enforcing more than the spec says is as unaccountable as one enforcing less — so it was not added. It should become a requirement in a later change: "content under ADDED or MODIFIED that is not a requirement block is reported".

**Two YAML traps reject rather than coerce.** `id: 001` parses as the integer 1, and an all-digit SHA parses as a number. Both are rejected with a message naming the fix, because coercing would silently produce an identifier that stops matching the file it names.

**The `openspec/` exclusion is still missing** from `SEARCH_EXCLUDE_PREFIXES` in `src/anchors/resolve.ts`. Carried from `delta-format-and-package-identity`, unaffected by this change.
