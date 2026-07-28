# Design — bootstrap-fatia-1

## Source of truth

All behavior is specified in `.specd/specs/`. This document adds no behavior; it records implementation decisions only. When a decision here conflicts with a requirement, the requirement wins.

## Module layout

The anchors in `.specd/specs/` declare exact file paths and symbols (e.g. `src/config/resolve.ts :: export function resolveConfig`). Anchors are contract: modules must be created at the declared path with the declared symbol. If a symbol must be renamed, the spec is updated in the same commit.

Top-level layout implied by the anchors:

```
src/
  cli/          # command registration, exit codes (REQ-CLI-*)
  core/         # ConflictError and shared primitives
  config/       # resolver, schema, credentials (REQ-CFG-001..003)
  parser/       # capability, requirement, delta, task, anchors (REQ-FMT-*)
  ears/         # patterns, parse (REQ-EARS-*)
  anchors/      # model, resolve, search, strategy, strategies/grep (REQ-ANC-*)
  verify/       # pipeline, layers/, report (REQ-VER-*)
  explore/      # collectors, manifest, redact, paths (REQ-EXP-*)
  init/         # config template, stack detection, gitattributes (REQ-CFG-004..005)
  status/       # status report (REQ-CFG-006)
test/
  architecture/ # no-llm-in-verify, no-network-in-verify (REQ-CLI-002, REQ-CLI-005)
```

## Toolchain

- TypeScript strict, ESM, target ES2022, `src/` → `dist/` via `tsc`.
- Vitest for tests (also carries the architecture tests of task 007).
- ESLint (flat config, typescript-eslint) + Prettier.
- `npm run verify` = format + lint + test + build; it is the project validation command declared in `.specd/config.toml`.

## Invariants enforced mechanically

- P1/P3: architecture tests walk the import graph from `src/verify/index.ts` and fail on LLM or network modules (task 007).
- P2/exit codes: only `verify` exits 1 for quality; operational failures exit 2.
- P4: ambiguity → error with diagnostic, never auto-resolution.

## Task order

Per AGENTS.md: 002 → 003 → 004 → 005 → 006 → 007, with 001 and 008 parallel-capable, 009 after 002 and 006.
