# Design — migracao-modelo-b

Full technical design: `docs/design/2026-07-modelo-b-e-archive.md`. That document
is the reasoning; this one records what was decided and what stayed open.

## Decisions taken before implementation

| # | decision | consequence |
| --- | --- | --- |
| 1 | Modelo B: the delta is the writing surface, `specs/` holds realized truth, `archive` applies and moves | `parseDelta` and `archive` become writable |
| 3 | `anchor fix` without a suggestion exits 2, not 1 | generalized to "exit 1 is a verdict, exit 2 is a refusal to act" |
| 6 | `archive` gets a capability of its own, REQ-ARC-001..010 | the largest spec gap in Fatia 2's scope closes |
| 9 | evidence grades in three tiers instead of validating one way | survives squash, rebase and shallow clone |
| 17 | REQ-EXP-007 loses its anchor rather than gaining a plausible one | P7: decorative anchor is worse than absent anchor |
| 18 | Fatia 3 opens before Fatia 2 closes | REQ-VER-003 gets a home; concurrent open changes become legitimate |

## The overlay formulation

The delta is not a parallel spec file. The effective spec is `specs/` with the
deltas of open changes applied on top; `verify` runs over the effective spec and
`archive` persists it.

```
 .specd/specs/ ────▶ effectiveSpecs()  ────▶ Requirement[] + origin
 changes/*/delta ──▶ ⊕ADDED ⊕MODIFIED ⊖REMOVED
                            │
              verify: runs layers    archive: writes the same
              over the result        result to disk
```

Three consequences carry the design:

1. `archive` becomes "persist what `verify` already computes". The failure mode
   "archive applied something different from what verify validated" cannot exist.
2. A requirement under MODIFIED is not broken in two places at once — the delta
   copy shadows the `specs/` copy, so only the new text is checked. Without this,
   a change that moves a symbol would keep the gate red for its whole duration.
3. REMOVED disappears from the effective spec, so its anchors stop being checked.
   Correct: it is on its way out.

## Anchor policy grades by origin

REQ-ANC-006 asked "is this identifier in the active change's delta?". Under the
overlay each requirement already carries where it came from, so the question
disappears.

| policy | origin `specs` | origin `delta` | use |
| --- | --- | --- | --- |
| `strict` | error | error | CI on `main` |
| `graduated` | error | warning | default |
| `lenient` | warning | warning | adoption on a legacy repo, with `anchor suggest` |

**This demotes the `readActiveChange` defect.** It was called the worst of the
four recorded bugs because a closed delta silenced 44 requirements; that failure
mode dies with Modelo A. The bug remains and stays first in Fatia 2's order —
`coverage`, `evidence`, `archive` and `status` still need to know which change
they are talking about — but the "corrupts the differentiator" argument expired.
Recorded because the ordering decision was taken while it was still on the table.

## Why the migration is not a delta operation

Moving REQ-VER-004 from `specs/` to a delta is not ADDED (it exists), not
MODIFIED (the text does not change) and not REMOVED (it is not leaving the
product). The delta grammar has no word for it, and inventing a fourth section is
exactly what `corrections-fatia-1` spent a change removing.

It does not need one. The ten were never realized, so they were never entitled to
be in `specs/` — this is a correction of illegal state, performed once. After
Fatia 2, `archive` is the only way into `specs/` and it refuses to run while any
affected anchor dangles, so the state stops being reachable.

## Where the change cuts

This change is the `propose` of Fatia 2, done by hand because `propose` does not
exist. Fatia 2 is the `apply`. The delta Fatia 2 implements is reviewed here,
before any code is written — which is the cycle the product sells.

Fatia 2's `tasks/` are deliberately not written here. Task decomposition belongs
to the change that executes it, and REQ-VER-004 will require every ADDED
requirement to carry a task before Fatia 2 can archive.

## OpenSpec exit condition

Fatia 2 is the last change tracked in both systems. Concretely: once
`specd archive 2026-07-fatia-2` exits 0 and `specd verify` is green with no
warning, opening a change under `openspec/changes/` is a regression. Dual
tracking existed only while a `.specd` change could not be closed.

## Still open after this change

Carried into Fatia 2, none of them blocking `parseDelta` or `archive`:

| item | proposal |
| --- | --- |
| evidence and squash merge | resolved by decision 9; watch whether the warning tier is enough in practice |
| `specd status` grouping | which change is "current" for display, now that there is no single active change |
| ADDED insertion point | appended to the end of the capability file; files drift out of identifier order, and `verify.md` already has |
| duplicate identifier across capabilities | `archive` aborts as a conflict; no requirement forbids it at authoring time |
| schema layer scope | reads the whole effective spec, `specs/` and deltas; no requirement states it |
| the shadow spec document | must be versioned as non-normative history or declared superseded; see `proposal.md` |
