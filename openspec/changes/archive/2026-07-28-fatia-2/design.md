# Design — fatia-2

Reasoning: `docs/design/2026-07-modelo-b-e-archive.md`. This records what the
implementation settled and what it left open.

## The overlay, and what it collapses

```
 .specd/specs/ ────▶ effectiveSpecs() ────▶ Requirement[] + origin
 changes/*/delta ──▶ ⊕ADDED ⊕MODIFIED ⊖REMOVED
                            │
              verify: layers run          archive: writes the same
              over the result             result to disk
```

Three things fall out rather than being built:

1. `archive` persists what `verify` already computes, so the two cannot disagree.
2. A MODIFIED block shadows its realized copy, so a change that moves a symbol
   does not hold the gate red for its whole duration.
3. REMOVED leaves the effective spec, so its anchors stop being checked.

## Decisions taken during implementation

| decision | why |
| --- | --- |
| Coverage checks only what REQ-VER-004's acceptance names | A task claiming an identifier its change does not declare is a real smell, but no criterion asks for it. A gate enforcing more than the spec says is as unaccountable as one enforcing less. |
| `assertAllAnchorsResolved` is its own exported symbol | REQ-ANC-007 and REQ-ARC-002 both anchor into `src/archive/index.ts`. One symbol serving both would resolve on a half-written implementation, which P7 exists to prevent. |
| Numeric YAML values are rejected, not coerced | `id: 001` is the integer 1. Coercing yields `"1"` — an identifier that silently stops matching its file. |
| Evidence consults git only when a task claims a commit | A repository with no completed work verifies without git at all, so REQ-VER-011's exit 2 fires when it means something. |
| ADDED appends to the end of the capability file | Deterministic. Inserting in identifier order would imply capabilities are sorted, and `verify.md` already carries REQ-VER-009 between 006 and 007 because that is where it belongs by meaning. |

## What the self-application proved, and what it did not

Step 2 is the proof: `archive` read a 26-requirement delta, applied 23 ADDED and
3 MODIFIED across five capabilities, created `archive.md` from nothing, wrote
nothing until every target was computed, moved the directory last, and staged
nothing.

Step 1 is not a proof. Fatia 1's delta is a Modelo A manifest that the new parser
reads as empty, so the command applied nothing and moved the directory. Right
outcome, no verification behind it. See `proposal.md`.

The first application also exposed two formatting defects — a doubled blank line
where the `**Capability.**` field was removed, and a missing blank line before
the following section. Both were found by reading the diff `archive` produced,
which is the argument for REQ-ARC-007: the command leaves everything unstaged
precisely so a person sees this before it becomes history.

## Still open

| item | note |
| --- | --- |
| A delta the parser reads as empty is silent | Should become a requirement: content under ADDED or MODIFIED that is not a requirement block is reported. |
| Fatia 1's delta stays in Modelo A form | Rewriting it would be the third edit of a closed change's artifact. It is archived; nothing reads it now. |
| `openspec/` missing from `SEARCH_EXCLUDE_PREFIXES` | Carried from `corrections-fatia-1`. |
| Duplicate identifier across capabilities | `archive` aborts on it; no requirement forbids it at authoring time. |
| The shadow-spec document | `docs/history/` is prepared with its banner; the document itself has not been supplied and is not in the repository. |

## OpenSpec exit

This is the last change tracked in both systems. `.specd/changes/` is now the
only tracker, and it can close what it opens.
