# Tasks — fatia-2

Behaviour contract: the REQ-IDs of `.specd/specs/` and of
`.specd/changes/archive/2026-07-fatia-2/delta.md`. Rationale: `design.md`.

The same work is tracked in `.specd/changes/archive/2026-07-fatia-2/tasks/`, in
specd's own format. This is the last change carried in both.

## 1. Open changes and the overlay

- [x] 1.1 Write `readOpenChanges`, returning every unarchived change and excluding `archive/` explicitly
- [x] 1.2 Write `effectiveSpecs()`: `specs ⊕ ADDED ⊕ MODIFIED ⊖ REMOVED`, each requirement carrying its origin [REQ-ANC-006]
- [x] 1.3 Report a conflict when two open changes claim one identifier, instead of letting the last parsed win [REQ-CLI-003]
- [x] 1.4 Delete `src/verify/active-change.ts`; nothing picks a single active change any more

## 2. Parsers

- [x] 2.1 Extract `splitRequirementSections` so capability and delta share one section splitter
- [x] 2.2 Write `parseDelta`: three sections, full requirement blocks, `**Capability.**` for ADDED [REQ-FMT-005]
- [x] 2.3 Write `assertFullReplacement`: a block without acceptance is a patch, not a requirement [REQ-FMT-006]
- [x] 2.4 Write `parseTask` and `TaskFrontmatterSchema`; reject numeric identifiers rather than coercing them [REQ-FMT-007]
- [x] 2.5 Delete `src/status/tasks.ts`, the tolerant reader that stood in for it

## 3. Layers

- [x] 3.1 Point the schema layer at the effective spec, not only the capabilities
- [x] 3.2 Write `checkRetiredReuse` for the cases the capability parser cannot see [REQ-FMT-004]
- [x] 3.3 Grade anchors by origin; remove the active-change lookup [REQ-ANC-006]
- [x] 3.4 Write the coverage layer, checking exactly what its acceptance criteria name [REQ-VER-004]
- [x] 3.5 Write the evidence layer in three tiers: reject, warn, exit 2 [REQ-VER-005, REQ-VER-010, REQ-VER-011]
- [x] 3.6 Make an absent `.specd/specs/` exit 2 instead of passing vacuously [REQ-CLI-004]

## 4. Commands

- [x] 4.1 Write `specd archive`: explicit change name, preconditions, application by section, destination, memory, no commit, ordering, idempotence [REQ-ARC-001 … REQ-ARC-010, REQ-ANC-007]
- [x] 4.2 Write `specd anchor fix`, exiting 2 when there is nothing to apply [REQ-ANC-008]
- [x] 4.3 Write `locateRequirement`, `changeAge` and `warningDebt` for `specd status` [REQ-CFG-007, REQ-CFG-008, REQ-CFG-009]
- [x] 4.4 Register both commands in the CLI and the usage text [REQ-CLI-001]

## 5. Verification

- [x] 5.1 Tests for the delta parser, the task parser, the overlay, coverage, evidence, archive and anchor fix — 58 new, 286 total
- [x] 5.2 Rewrite the anchor-policy tests for grading by origin; the old ones encoded the mechanism this change replaced
- [x] 5.3 Enable `coverage` and `evidence` in `.specd/config.toml`; leave `provenance` off with the reason written down
- [x] 5.4 Write ten tasks for Fatia 2 and one for Fatia 3, so coverage has something to check
- [x] 5.5 `specd archive 2026-07-fatia-1` → exit 0
- [x] 5.6 `specd archive 2026-07-fatia-2` → exit 0, six capability files written
- [x] 5.7 `specd verify` → exit 0, one warning, from the open Fatia 3
- [x] 5.8 Confirm conservation: 65 identifiers before, 65 after
- [x] 5.9 Fix the two formatting defects the first application exposed, found by reading the diff archive left unstaged
- [x] 5.10 Derive the capability list in `test/parser/capability.test.ts` from the directory; the eighth arrived because the tool created it
- [x] 5.11 `npm run verify` green

## 6. Record

- [x] 6.1 Record that step 5.5 passed vacuously — Fatia 1's delta is a Modelo A manifest the new parser reads as empty
- [x] 6.2 Record that a delta the parser reads as empty produces no diagnostic, and that this should become a requirement
- [x] 6.3 Record the OpenSpec exit condition: this is the last change tracked in both systems
