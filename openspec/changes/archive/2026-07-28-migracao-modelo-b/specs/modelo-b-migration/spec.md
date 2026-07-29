# modelo-b-migration

## Purpose

Pointer spec. The authoritative behaviour contract lives in `.specd/specs/` and, for work not yet realized, in the `delta.md` of open changes under `.specd/changes/`. This file maps the migration to those REQ-IDs by reference and MUST NOT restate or redefine them.

Where a scenario targets a change artifact or a project document rather than a capability, it names the file instead.

## ADDED Requirements

### Requirement: `.specd/specs/` holds realized truth only

The migration SHALL leave `.specd/specs/` containing no requirement whose anchors do not resolve, and SHALL place every unrealized requirement in the delta of an open change without losing any identifier.

#### Scenario: No dangling anchor survives in the capability tree

- **GIVEN** REQ-ANC-006 (`.specd/specs/anchors.md`), under which a dangling anchor outside the active change delta is an error
- **WHEN** `specd verify --fast` runs at the repository root
- **THEN** the anchors layer passes with zero errors and zero warnings, and the gate exits 0

#### Scenario: Every migrated identifier lands in an open change

- **GIVEN** the ten requirements whose anchors dangled: REQ-ANC-007, REQ-ANC-008, REQ-VER-003, REQ-VER-004, REQ-VER-005, REQ-FMT-004, REQ-FMT-005, REQ-FMT-006, REQ-FMT-007, REQ-EXP-007
- **WHEN** the deltas of `2026-07-28-archive-cycle-and-effective-specs` and `2026-07-28-provenance-and-mcp-transport` are read
- **THEN** the first nine appear under ADDED with complete text, and REQ-EXP-007 remains in `.specd/specs/explore.md` because it is realized and only its anchor was wrong

#### Scenario: No requirement is lost in transcription

- **GIVEN** 50 identifiers in `.specd/specs/` before the migration
- **WHEN** the union of `.specd/specs/` and the deltas of open changes is computed after it
- **THEN** the union contains all 50 originals plus 15 new identifiers, 41 of them in `.specd/specs/`, and the set difference of before minus after is empty

#### Scenario: A negative requirement keeps no decorative anchor

- **GIVEN** REQ-EXP-007, which requires that nothing validate `draft.md`, and REQ-ANC-001 (`.specd/specs/anchors.md`), which makes anchors optional
- **WHEN** `.specd/specs/explore.md` is read
- **THEN** REQ-EXP-007 declares no anchor block and states why, because an anchor that resolved would prove nothing about a requirement whose content is an absence

### Requirement: The delta becomes the writing surface

The migration SHALL rewrite the delta format requirements so that ADDED and MODIFIED carry complete requirement text, and SHALL specify the archive command that applies them.

#### Scenario: ADDED and MODIFIED are symmetric

- **GIVEN** REQ-FMT-005 and REQ-FMT-006 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** a requirement block appears under either section
- **THEN** it carries statement, acceptance and anchors in the same form as a capability file, at heading level 3, and an ADDED block additionally declares its destination in a `**Capability.**` field

#### Scenario: Archive has a capability

- **GIVEN** that before this change only REQ-ANC-007 constrained `specd archive`
- **WHEN** `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md` is read
- **THEN** REQ-ARC-001 through REQ-ARC-010 specify explicit change naming, preconditions, per-section application, destination, memory handling, absence of commits, write ordering and idempotent reapplication

#### Scenario: Anchor policy stops consulting the active change

- **GIVEN** REQ-ANC-006 as modified in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** a dangling anchor is graded under the `graduated` policy
- **THEN** severity follows the origin of the requirement — error for `.specd/specs/`, warning for a change delta — and no lookup of an active change participates

### Requirement: Exit code 1 stays a verdict

The migration SHALL make explicit that only `specd verify` returns 1, and that a command refusing to act on a quality precondition returns 2.

#### Scenario: Anchor fix refuses without judging

- **GIVEN** REQ-ANC-008 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** `specd anchor fix` is invoked for a requirement holding no suggestion
- **THEN** the command exits 2, because it cannot act rather than having judged

#### Scenario: Archive refuses without judging

- **GIVEN** REQ-ARC-002 and REQ-CLI-001 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** the coverage, evidence or anchor preconditions of the named change fail
- **THEN** `specd archive` exits 2 without writing anything and names `specd verify` as where the verdict is

### Requirement: Evidence grades instead of validating once

The migration SHALL separate the three evidence outcomes into requirements of their own, one per behaviour.

#### Scenario: Unsupported completion still fails

- **GIVEN** REQ-VER-005 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** a task declares status `done` with an empty `evidence.commits`
- **THEN** the evidence layer rejects it

#### Scenario: A rewritten history warns rather than failing

- **GIVEN** REQ-VER-010 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** a listed SHA is no longer reachable because the project squashed or rebased
- **THEN** the layer reports a warning and does not reject, because anchors prove code now and evidence proves work then

#### Scenario: A missing history is operational, not a verdict

- **GIVEN** REQ-VER-011 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`
- **WHEN** `specd verify` runs where the repository history is unavailable
- **THEN** it exits 2 and reports no evidence violation, distinguishing "could not check" from "checked and failed"

### Requirement: Stalled changes stay visible

The migration SHALL add reporting that makes an open change holding unrealized requirements visible without the tool judging it.

#### Scenario: Status locates a requirement

- **GIVEN** REQ-CFG-007 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`, and that under Modelo B a requirement's address changes over its lifetime while its identifier does not
- **WHEN** `specd status` runs
- **THEN** every identifier is reported with the file holding it and whether it is realized, in flight, or in modification

#### Scenario: Age and warning debt are reported per change

- **GIVEN** REQ-CFG-008 and REQ-CFG-009 as written in `.specd/changes/2026-07-28-archive-cycle-and-effective-specs/delta.md`, and that `2026-07-28-provenance-and-mcp-transport` exists to hold REQ-VER-003 for an indefinite period
- **WHEN** `specd status` runs
- **THEN** each open change reports how long it has been open and how many of its requirements hold a dangling anchor, and the command still exits 0 per REQ-CFG-006

### Requirement: The illegal state cannot recur

The migration SHALL record why this operation is not repeatable and why no fourth delta section is needed.

#### Scenario: Archive becomes the only entrance to the capability tree

- **GIVEN** REQ-ARC-003, REQ-ARC-004 and REQ-ARC-005, and REQ-ANC-007 which refuses the operation while any affected anchor dangles
- **WHEN** change `archive-cycle-and-effective-specs` ships
- **THEN** a requirement can enter `.specd/specs/` only through `specd archive`, so a requirement without realized code cannot arrive there

#### Scenario: Agent instructions carry the rule

- **GIVEN** that `AGENTS.md` previously named `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/` as the current scope and did not describe Modelo B
- **WHEN** `AGENTS.md` and `CLAUDE.md` are read
- **THEN** they state that the delta is the writing surface, that writing a new requirement directly into `.specd/specs/` recreates the corrected illegal state, and that the anchor policy grades by origin
