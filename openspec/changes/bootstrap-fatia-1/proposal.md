# Proposal — bootstrap-fatia-1

## Why

The specd tool is fully specified in `.specd/specs/` (7 capabilities, 48 requirements) but has zero implementation. Fatia 1 (`.specd/changes/2026-07-fatia-1/`) is the scoped slice that proves the product's differentiator — anchor-based drift detection — on real repositories. This OpenSpec change tracks the implementation of its nine tasks.

## What Changes

- Implement the nine tasks defined in `.specd/changes/2026-07-fatia-1/tasks/` (001–009).
- Deliver the commands `specd init`, `specd explore`, `specd verify`, `specd status` and `specd anchor suggest`.
- Deliver the internal engines: config resolver, capability/spec parser, EARS parser, anchor resolution ladder, verify pipeline, architecture tests, explore collectors.

**Source of truth:** all behavior is defined by the REQ-IDs in `.specd/specs/`. This change never redefines behavior — every task below references the governing REQ-IDs, and acceptance criteria in those requirements are the test specification.

Out of scope (per `.specd/changes/2026-07-fatia-1/proposal.md`): `propose`, `apply`, `sync`, `archive`, `anchor fix`, memory, hooks.

## Capabilities

### New Capabilities

None in OpenSpec form. The capabilities already exist as the authoritative contract in `.specd/specs/` (`cli`, `spec-format`, `ears`, `anchors`, `verify`, `explore`, `config`). This change adds a single pointer spec:

- `fatia-1-implementation`: maps implementation work to the REQ-IDs of `.specd/specs/` by reference only.

### Modified Capabilities

None.

## Impact

- New code under `src/` following the module paths declared by the anchors in `.specd/specs/` (anchors are contract, not suggestion).
- New tests under `test/`, including architecture tests enforcing P1 (no LLM in verify) and P3 (no network in verify).
- Exit code contract: 0 success, 1 gate failure (only `specd verify`), 2 operational failure.
- No new runtime dependencies without justification; no LLM client and no network module reachable from `verify()`.
