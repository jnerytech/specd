# fatia-1-implementation

## Purpose

Pointer spec. The authoritative behavior contract lives in `.specd/specs/` — this file maps Fatia 1 implementation work to those REQ-IDs by reference and MUST NOT restate or redefine them. Acceptance criteria of each referenced requirement are the test specification.

## ADDED Requirements

### Requirement: Implementation conforms to referenced .specd requirements

The implementation SHALL satisfy every requirement referenced by the nine tasks of `.specd/changes/2026-07-fatia-1/tasks/`, as written in `.specd/specs/`.

#### Scenario: Task 001 — anchor bootstrap report

- **GIVEN** the requirements REQ-ANC-001, REQ-ANC-003, REQ-CLI-003 (`.specd/specs/anchors.md`, `.specd/specs/cli.md`)
- **THEN** `specd anchor suggest` conforms to them, verified by their acceptance criteria

#### Scenario: Task 002 — config resolver

- **GIVEN** the requirements REQ-CFG-001, REQ-CFG-002, REQ-CFG-003 (`.specd/specs/config.md`)
- **THEN** the config resolver conforms to them, verified by their acceptance criteria

#### Scenario: Task 003 — spec parser

- **GIVEN** the requirements REQ-FMT-001, REQ-FMT-002, REQ-FMT-003, REQ-FMT-008 (`.specd/specs/spec-format.md`)
- **THEN** the capability parser conforms to them, verified by their acceptance criteria

#### Scenario: Task 004 — EARS parser

- **GIVEN** the requirements REQ-EARS-001, REQ-EARS-002, REQ-EARS-003, REQ-EARS-004, REQ-EARS-005 (`.specd/specs/ears.md`)
- **THEN** the EARS parser conforms to them, verified by their acceptance criteria

#### Scenario: Task 005 — anchor ladder

- **GIVEN** the requirements REQ-ANC-002, REQ-ANC-003, REQ-ANC-004, REQ-ANC-005 (`.specd/specs/anchors.md`)
- **THEN** the anchor resolution ladder conforms to them, verified by their acceptance criteria

#### Scenario: Task 006 — verify pipeline

- **GIVEN** the requirements REQ-VER-001, REQ-VER-002, REQ-VER-006, REQ-VER-007, REQ-VER-008, REQ-CLI-001, REQ-CLI-004 (`.specd/specs/verify.md`, `.specd/specs/cli.md`)
- **THEN** the verify pipeline conforms to them, verified by their acceptance criteria

#### Scenario: Task 007 — architecture tests

- **GIVEN** the requirements REQ-CLI-002, REQ-CLI-005 (`.specd/specs/cli.md`)
- **THEN** the architecture tests conform to them, verified by their acceptance criteria

#### Scenario: Task 008 — explore collectors

- **GIVEN** the requirements REQ-EXP-001, REQ-EXP-002, REQ-EXP-003, REQ-EXP-004, REQ-EXP-005, REQ-EXP-006 (`.specd/specs/explore.md`)
- **THEN** the explore collectors conform to them, verified by their acceptance criteria

#### Scenario: Task 009 — init and status

- **GIVEN** the requirements REQ-CFG-004, REQ-CFG-005, REQ-CFG-006, REQ-CLI-006 (`.specd/specs/config.md`, `.specd/specs/cli.md`)
- **THEN** `specd init` and `specd status` conform to them, verified by their acceptance criteria
