# Tasks — migracao-modelo-b

Text only. No file under `src/` is modified.
Behaviour contract: REQ-IDs in `.specd/specs/` and in the deltas of `2026-07-fatia-2` and `2026-07-fatia-3`. Rationale per decision: `design.md` and `docs/design/2026-07-modelo-b-e-archive.md`.

## 1. Fatia 2 delta — migrated requirements

- [x] 1.1 Create `.specd/changes/2026-07-fatia-2/delta.md` with frontmatter `change` and `target`
- [x] 1.2 Move REQ-FMT-004 and REQ-FMT-007 into ADDED with their text unchanged, each declaring `**Capability.**` [REQ-FMT-006]
- [x] 1.3 Move REQ-FMT-005 into ADDED, rewritten so ADDED and MODIFIED both carry full text and ADDED declares its destination capability [REQ-FMT-005]
- [x] 1.4 Move REQ-FMT-006 into ADDED, generalized from MODIFIED to both sections [REQ-FMT-006]
- [x] 1.5 Move REQ-ANC-007 into ADDED, adding the criterion that "affected" means cited in ADDED or MODIFIED of the change being archived [REQ-ANC-007]
- [x] 1.6 Move REQ-ANC-008 into ADDED with exit code 1 changed to 2 [REQ-ANC-008, REQ-CLI-001]
- [x] 1.7 Move REQ-VER-004 into ADDED, resolving the four open questions about what counts as coverage: `req` frontmatter only, any status counts, own change only, REMOVED needs no task [REQ-VER-004]
- [x] 1.8 Move REQ-VER-005 into ADDED reduced to the empty-commits gate, and add REQ-VER-010 and REQ-VER-011 for the other two outcomes [REQ-VER-005, REQ-VER-010, REQ-VER-011]

## 2. Fatia 2 delta — new requirements

- [x] 2.1 Write REQ-ARC-001 through REQ-ARC-010 under ADDED, capability `archive` [REQ-ARC-001 … REQ-ARC-010]
- [x] 2.2 Write REQ-CFG-007 for requirement location reporting [REQ-CFG-007]
- [x] 2.3 Write REQ-CFG-008 and REQ-CFG-009 for open change age and warning debt [REQ-CFG-008, REQ-CFG-009]
- [x] 2.4 Write MODIFIED for REQ-ANC-006, grading by origin instead of by active change [REQ-ANC-006]
- [x] 2.5 Write MODIFIED for REQ-CLI-001 and REQ-CLI-004, making "exit 1 is a verdict, exit 2 is a refusal to act" explicit [REQ-CLI-001, REQ-CLI-004]
- [x] 2.6 Write `.specd/changes/2026-07-fatia-2/proposal.md` with scope, ordering and the self-application criterion

## 3. Fatia 3

- [x] 3.1 Create `.specd/changes/2026-07-fatia-3/delta.md` holding REQ-VER-003 with its text unchanged [REQ-VER-003]
- [x] 3.2 Write `.specd/changes/2026-07-fatia-3/proposal.md` explaining why the change exists before being worked, and naming REQ-CFG-008 and REQ-CFG-009 as the guard against stalling

## 4. Remove the illegal state from `.specd/specs/`

- [x] 4.1 Delete REQ-FMT-004, REQ-FMT-005, REQ-FMT-006 and REQ-FMT-007 from `spec-format.md`
- [x] 4.2 Delete REQ-ANC-007 and REQ-ANC-008 from `anchors.md`
- [x] 4.3 Delete REQ-VER-003, REQ-VER-004 and REQ-VER-005 from `verify.md`
- [x] 4.4 Remove REQ-EXP-007's anchor block from `explore.md`, replacing it with the reason a negative requirement carries none [REQ-EXP-007, REQ-ANC-001]

## 5. Verification

- [x] 5.1 Run `specd verify --fast`: the anchors layer must pass with zero errors and zero warnings [REQ-ANC-006]
- [x] 5.2 Count identifiers before and after; the set difference of before minus after must be empty
- [x] 5.3 Run every delta statement through the EARS parser: each must parse and hold exactly one `SHALL` clause [REQ-EARS-001, REQ-EARS-003, REQ-EARS-004]
- [x] 5.4 Rewrite `test/dogfood.test.ts`, which asserted the gate was red — the Fatia 1 criterion, now false — to assert the Modelo B invariant instead
- [x] 5.5 Run `npm run verify`

## 6. Documentation

- [x] 6.1 State Modelo B in `AGENTS.md`: the delta is the writing surface, writing into `.specd/specs/` recreates the illegal state, the anchor policy grades by origin
- [x] 6.2 Replace the Fatia 1 ordering and scope with Fatia 2's; mirror into `CLAUDE.md`
- [x] 6.3 Record in `proposal.md` that the migration cannot recur and that no fourth delta section will be needed
- [x] 6.4 Record in `proposal.md` that the original product proposal is not in this repository, that it is design history rather than contract, and enumerate what it covers with `BL-` identifiers so no future citation reads as binding
