# fatia-2-implementation

## Purpose

Pointer spec. The authoritative behaviour contract lives in `.specd/specs/` — this file maps the work of this change to those REQ-IDs by reference and MUST NOT restate or redefine them. Acceptance criteria of each referenced requirement are the test specification.

## ADDED Requirements

### Requirement: The change cycle closes on itself

Fatia 2 SHALL deliver a `specd archive` that applies a change's delta to the capabilities and files the change away, verified by archiving the two changes that produced it.

#### Scenario: Archive applies a delta it read

- **GIVEN** REQ-ARC-003, REQ-ARC-004 and REQ-ARC-005 (`.specd/specs/archive.md`)
- **WHEN** `specd archive 2026-07-fatia-2` runs
- **THEN** it exits 0, writes 23 ADDED sections and 3 MODIFIED replacements across five capabilities, creates `.specd/specs/archive.md`, and moves the change to `.specd/changes/archive/2026-07-fatia-2`

#### Scenario: The gate is green afterwards, with pending work still visible

- **GIVEN** REQ-ANC-006 as modified by this change
- **WHEN** `specd verify` runs after both archives
- **THEN** it exits 0 with exactly one warning, for REQ-VER-003 held by the open Fatia 3, and no error

#### Scenario: No requirement is lost across the cycle

- **GIVEN** 65 identifiers in the effective spec before archiving
- **WHEN** the effective spec is recomputed after both archives
- **THEN** it still holds 65 — 64 realized in `.specd/specs/`, 1 in flight

### Requirement: The delta is read, not merely listed

Fatia 2 SHALL parse the delta and task artifacts so that every layer sees the same model.

#### Scenario: The effective spec is the overlay

- **GIVEN** REQ-FMT-005 and REQ-FMT-006 (`.specd/specs/spec-format.md`)
- **WHEN** `effectiveSpecs()` runs over `.specd/specs/` and the open change deltas
- **THEN** ADDED requirements appear with origin `delta`, MODIFIED requirements shadow their realized copy, and REMOVED requirements leave the effective spec

#### Scenario: The schema layer stops looking away

- **GIVEN** that the layer previously read only `.specd/specs/`
- **WHEN** it runs after this change
- **THEN** it examines the whole effective spec — 65 requirements rather than 41 — so a malformed requirement in a delta fails the gate

#### Scenario: Two open changes claiming one requirement is a conflict

- **GIVEN** REQ-CLI-003 (`.specd/specs/cli.md`) and P4
- **WHEN** two deltas both declare the same identifier
- **THEN** the schema layer reports the conflict naming both changes, and neither silently wins

### Requirement: Severity comes from placement

Fatia 2 SHALL grade a dangling anchor by where its requirement is written rather than by which change names its identifier.

#### Scenario: Drift and pending work are distinguishable

- **GIVEN** REQ-ANC-006 as modified by this change
- **WHEN** an anchor dangles
- **THEN** it is an error if the requirement is written in `.specd/specs/`, and a warning if it is written in an open change's delta

#### Scenario: Naming an identifier no longer silences drift

- **GIVEN** that under the previous policy a delta listing an identifier downgraded its anchor to a warning
- **WHEN** an open change names a realized requirement without carrying its text
- **THEN** the dangling anchor of that requirement is still an error

#### Scenario: Status separates the two in its report

- **GIVEN** REQ-CFG-009 (`.specd/specs/config.md`)
- **WHEN** `specd status` runs
- **THEN** anchors dangling under an open change appear under that change, and anchors no change claims appear under a separate drift heading

### Requirement: Coverage and evidence hold changes accountable

Fatia 2 SHALL check that declared requirements have owners and that completion claims have support.

#### Scenario: A promise with no owner fails

- **GIVEN** REQ-VER-004 (`.specd/specs/verify.md`)
- **WHEN** a change declares a requirement under ADDED or MODIFIED that no task of that change references in its `req` field
- **THEN** the coverage layer rejects it

#### Scenario: Completion with no support at all fails

- **GIVEN** REQ-VER-005 (`.specd/specs/verify.md`)
- **WHEN** a task declares status `done` with an empty `evidence.commits`
- **THEN** the evidence layer rejects it

#### Scenario: A rewritten history degrades the record without failing the gate

- **GIVEN** REQ-VER-010 (`.specd/specs/verify.md`)
- **WHEN** a listed SHA is unreachable because the project squashed or rebased
- **THEN** the layer warns and the gate stays green, because anchors prove code now and evidence proves work then

#### Scenario: An unavailable history is not a verdict

- **GIVEN** REQ-VER-011 (`.specd/specs/verify.md`)
- **WHEN** the evidence layer runs where no git history is reachable
- **THEN** the command exits 2 and reports no evidence violation

### Requirement: Refusing to act is never a verdict

Fatia 2 SHALL keep exit code 1 for the verdict of `specd verify` and use exit code 2 wherever another command cannot act.

#### Scenario: Archive refuses on unmet preconditions

- **GIVEN** REQ-ARC-002 and REQ-CLI-001 (`.specd/specs/cli.md`)
- **WHEN** the coverage, evidence or anchor preconditions of the named change fail
- **THEN** `specd archive` exits 2 without writing anything and names `specd verify` as where the verdict is

#### Scenario: Anchor fix refuses without a suggestion

- **GIVEN** REQ-ANC-008 (`.specd/specs/anchors.md`), whose exit code this change corrected from 1 to 2
- **WHEN** `specd anchor fix` runs for a requirement whose anchors carry no suggestion
- **THEN** it exits 2

#### Scenario: An empty directory is not a passing check

- **GIVEN** the exit code contract (REQ-CLI-004)
- **WHEN** `specd verify` runs where `.specd/specs/` does not exist
- **THEN** it exits 2, because "nothing to check" and "checked and passed" must not be the same result

### Requirement: Archive rewrites the contract under review

Fatia 2 SHALL make every write of `specd archive` reviewable and recoverable.

#### Scenario: Nothing is staged or committed

- **GIVEN** REQ-ARC-007 (`.specd/specs/archive.md`) and P4
- **WHEN** `specd archive` completes
- **THEN** no commit exists and no file is staged, so a person reads the diff before it becomes history

#### Scenario: Every target is computed before any is written

- **GIVEN** REQ-ARC-009 (`.specd/specs/archive.md`)
- **WHEN** any capability cannot be applied
- **THEN** no capability is written and the change directory does not move

#### Scenario: A rerun after a partial application completes it

- **GIVEN** REQ-ARC-010 (`.specd/specs/archive.md`)
- **WHEN** `specd archive` runs again over a capability that already holds an ADDED requirement with identical text
- **THEN** it treats the requirement as already applied, duplicates no section, and finishes the move

#### Scenario: Memory travels and stays out of the contract

- **GIVEN** REQ-ARC-008 (`.specd/specs/archive.md`) and P6
- **WHEN** a change with a `memory/` directory is archived
- **THEN** the directory moves with the change and none of its content reaches any capability
