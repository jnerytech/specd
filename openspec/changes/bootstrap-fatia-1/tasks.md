# Tasks — bootstrap-fatia-1

Behavior contract: REQ-IDs in `.specd/specs/`. Task details and acceptance: `.specd/changes/2026-07-fatia-1/tasks/`. Do not redefine behavior here.

## 1. Foundation (this change's task 0 — already scaffolded)

- [x] 1.1 TypeScript toolchain: tsconfig (ESM, strict, ES2022, outDir dist), vitest, eslint, prettier; `npm run verify` green

## 2. Core chain (sequential)

- [x] 2.1 Task 002 — config resolver [REQ-CFG-001, REQ-CFG-002, REQ-CFG-003] (`.specd/.../tasks/002-config-resolver.md`)
- [x] 2.2 Task 003 — spec parser [REQ-FMT-001, REQ-FMT-002, REQ-FMT-003, REQ-FMT-008] (`003-spec-parser.md`)
- [x] 2.3 Task 004 — EARS parser [REQ-EARS-001..005] (`004-ears-parser.md`)
- [x] 2.4 Task 005 — anchor ladder [REQ-ANC-002, REQ-ANC-003, REQ-ANC-004, REQ-ANC-005] (`005-anchor-ladder.md`)
- [ ] 2.5 Task 006 — verify pipeline [REQ-VER-001, REQ-VER-002, REQ-VER-006, REQ-VER-007, REQ-VER-008, REQ-CLI-001, REQ-CLI-004] (`006-verify-pipeline.md`)
- [ ] 2.6 Task 007 — architecture tests [REQ-CLI-002, REQ-CLI-005] (`007-architecture-tests.md`)

## 3. Independent (parallel-capable)

- [ ] 3.1 Task 001 — anchor bootstrap report [REQ-ANC-001, REQ-ANC-003, REQ-CLI-003] (`001-anchor-bootstrap-report.md`)
- [ ] 3.2 Task 008 — explore collectors [REQ-EXP-001..006] (`008-explore-collectors.md`)

## 4. Closing (depends on 2.1 and 2.5)

- [ ] 4.1 Task 009 — init and status [REQ-CFG-004, REQ-CFG-005, REQ-CFG-006, REQ-CLI-006] (`009-init-and-status.md`)
- [ ] 4.2 Dogfooding: `specd verify` runs on this repository and fails on real dangling anchors (Fatia 1 success criterion)
