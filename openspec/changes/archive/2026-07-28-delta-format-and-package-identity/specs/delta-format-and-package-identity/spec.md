# delta-format-and-package-identity

## Purpose

Pointer spec. The authoritative behaviour contract lives in `.specd/specs/` — this file maps the corrections of this change to those REQ-IDs by reference and MUST NOT restate or redefine them. Acceptance criteria of each referenced requirement are the test specification.

Where a correction has no REQ-ID because it targets a change artifact or a project document rather than a capability, the scenario names the file instead.

## ADDED Requirements

### Requirement: change `verify-gate-and-anchor-ladder` artifacts conform to the rules change `verify-gate-and-anchor-ladder` enforces

The corrections SHALL leave every artifact of `2026-07-28-verify-gate-and-anchor-ladder` and every requirement it touched consistent with `.specd/specs/`, verified by the acceptance criteria of the referenced requirements.

#### Scenario: Delta declares only the three legal sections

- **GIVEN** REQ-FMT-005 (`.specd/specs/spec-format.md`), which admits only ADDED, MODIFIED and REMOVED
- **WHEN** `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/delta.md` is read
- **THEN** it contains no `## DEFERRED` section, and the four deferred identifiers appear as prose in that change's `proposal.md`

#### Scenario: Deferral by absence is unchanged

- **GIVEN** REQ-ANC-006 (`.specd/specs/anchors.md`), under which a requirement absent from the delta yields an error
- **WHEN** `specd verify` runs after the section is deleted
- **THEN** REQ-ANC-007, REQ-ANC-008, REQ-VER-004 and REQ-VER-005 still produce errors, because the section was never machine-read

#### Scenario: Package name matches the distribution decision

- **GIVEN** REQ-CLI-006 (`.specd/specs/cli.md`)
- **WHEN** `package.json` is read
- **THEN** `name` is `specd` without a scope, and the requirement's title in `delta.md` reads "Zero-install distribution", matching `cli.md`

#### Scenario: Distribution acceptance separates code property from registry fact

- **GIVEN** REQ-CLI-006, whose acceptance asserted `npx specd verify` works in a clean directory
- **WHEN** the acceptance is rewritten
- **THEN** it asserts only what the package and its manifest can satisfy, and the registry reservation is stated in `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/proposal.md` as an operational prerequisite rather than an acceptance criterion

#### Scenario: The packaged artifact is executed by a test

- **GIVEN** REQ-CLI-006's rewritten acceptance
- **WHEN** the test suite runs offline
- **THEN** a test packs the tarball, installs it into a temporary directory without contacting a registry, and executes the resulting `specd` binary

#### Scenario: Bundle constraint sits with the distribution requirement

- **GIVEN** REQ-ANC-005 and REQ-CLI-006 (`.specd/specs/anchors.md`, `.specd/specs/cli.md`)
- **WHEN** the WASM-grammar criterion is relocated
- **THEN** it appears in REQ-CLI-006's acceptance beside the existing native-dependency constraint, and REQ-ANC-005's acceptance describes only strategy selection

#### Scenario: Project layer output capture is its own requirement

- **GIVEN** REQ-VER-006 (`.specd/specs/verify.md`), whose acceptance required stdout and stderr in the report while no clause of its statement claimed it
- **WHEN** the criterion is promoted
- **THEN** a new requirement in the verify capability states that behaviour, anchored at code that already exists, and REQ-VER-006 retains only the argv-without-shell and exit-code behaviour

#### Scenario: Manifest durability is its own requirement

- **GIVEN** REQ-EXP-003 (`.specd/specs/explore.md`), whose acceptance required the manifest to be written even on failure while no clause of its statement claimed it
- **WHEN** the criterion is promoted
- **THEN** a new requirement in the explore capability states that the manifest is written before a required-source failure is reported, anchored at code that already exists

#### Scenario: Neither new requirement introduces a dangling anchor

- **GIVEN** REQ-ANC-002 (`.specd/specs/anchors.md`), the resolution ladder
- **WHEN** `specd verify` runs after both requirements are added
- **THEN** every anchor of both resolves, and the gate reports no new error

#### Scenario: The EARS check states what it measures

- **GIVEN** REQ-EARS-003 (`.specd/specs/ears.md`), titled "Single behaviour per requirement"
- **WHEN** the requirement is rewritten
- **THEN** its acceptance states that the check counts `SHALL` clauses and is a syntactic tripwire, that a single-clause statement may still describe several behaviours and pass, and that a `SHALL` inside inline code is a mention rather than a clause

#### Scenario: No coordinated-clause heuristic is added

- **GIVEN** the decision recorded in `design.md`
- **WHEN** `src/ears/parse.ts` is inspected after the change
- **THEN** it is unmodified, and the check still counts clauses only

#### Scenario: Anchor sufficiency is recorded as a principle

- **GIVEN** no-llm-in-decision-path (`AGENTS.md`), which keeps semantic judgement out of the decision path
- **WHEN** `AGENTS.md` and `CLAUDE.md` are read
- **THEN** both carry a seventh principle stating that a resolving anchor proves location and not satisfaction, and that an anchor is never pointed at a partial implementation

#### Scenario: The correction introduces no runtime behaviour

- **GIVEN** the scope declared in `proposal.md`
- **WHEN** the change is complete
- **THEN** no file under `src/` is modified, and `npm run verify` passes with the existing suite plus the one added test
