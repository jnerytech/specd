## Why

change `verify-gate-and-anchor-ladder` shipped a working gate, and left its own artifacts in violation of rules that same gate enforces. `delta.md` carries a `## DEFERRED` section that REQ-FMT-005 does not admit, so the delta will fail the moment `parseDelta` exists. REQ-CLI-006 declares an acceptance criterion that is currently false and that no test checks. Three requirements carry acceptance criteria describing behaviour no clause of their statement claims.

None of this is caught today, because the layers that would catch it are the ones change `archive-cycle-and-effective-specs` will build. Correcting it first means change `archive-cycle-and-effective-specs` starts from a baseline where the gate and the specs agree — and where the first thing `parseDelta` reads is a legal delta.

This change is text and one package rename. No new behaviour.

## What Changes

**Delta format (#1)**
- Remove the `## DEFERRED` section from `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/delta.md`. REQ-FMT-005 admits only ADDED, MODIFIED and REMOVED.
- Move the four deferred identifiers (REQ-ANC-007, REQ-ANC-008, REQ-VER-004, REQ-VER-005) into that change's `proposal.md` as prose. Deferral is a scoping statement, not a delta operation — archive has nothing to do with it.

**Package identity (#2)** — **BREAKING** for anyone who installed the scoped name
- `package.json` name changes from `@jnerytech/specd` to `specd`.
- REQ-CLI-006's title in `delta.md` becomes "Zero-install distribution", matching `cli.md`. The two files recorded two different decisions, not a typo.
- REQ-CLI-006's acceptance is rewritten to separate what code can satisfy from what only publishing can: the packed tarball installing and exposing a working binary is testable offline; `npx specd` resolving to this package is a registry fact and moves to the operational prerequisite it already was.
- A test packs the tarball, installs it into a temporary directory offline, and runs the resulting binary. Today `test/init/init.test.ts` asserts `bin.specd` and never executes anything.

**Orphan acceptance criteria (#5a)**
- REQ-ANC-005's WASM-grammar criterion moves to REQ-CLI-006, where the "no native dependency" constraint already lives.
- REQ-VER-006's stdout/stderr criterion becomes a new requirement. Capturing command output is a behaviour of its own, not a consequence of executing argv without a shell.
- REQ-EXP-003's manifest-written-on-failure criterion becomes a new requirement. It is an ordering guarantee — write, then fail — and the most consequential behaviour in that requirement was the one no clause mentioned.

**Honest EARS check (#5b)**
- REQ-EARS-003 is rewritten to state what it actually does: count `SHALL` clauses. It is a syntactic tripwire, not proof of single behaviour. A single-clause statement can still describe several behaviours and pass.
- Its acceptance also gains the backtick rule the parser already implements and no requirement documents.
- No coordinated-clause heuristic is added.

**anchor-necessary-not-sufficient (#6)**
- AGENTS.md and CLAUDE.md gain a seventh principle: an anchor is necessary, never sufficient. It records the discipline change `verify-gate-and-anchor-ladder` followed three times without a rule requiring it.

## Capabilities

### New Capabilities

- `delta-format-and-package-identity`: pointer spec mapping this change's corrections to the REQ-IDs of `.specd/specs/` by reference. The authoritative contract is `.specd/specs/`; this file restates nothing.

### Modified Capabilities

None. `openspec/specs/` is empty by decision taken when `verify-gate-implementation` was archived: the durable contract lives in `.specd/specs/`, enforced by `specd verify`.

## Impact

- `.specd/specs/` — `cli.md`, `anchors.md`, `verify.md`, `explore.md`, `ears.md`. Two requirements added (both anchored at code that already exists, so no new dangling anchors), one acceptance criterion moved, one requirement rewritten.
- `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/` — `delta.md` loses a section, `proposal.md` gains prose. This edits an artifact of an archived change deliberately: the alternative is leaving a delta that the next slice's parser rejects.
- `package.json`, `package-lock.json`, `README.md`, `AGENTS.md`, `CLAUDE.md` — name change and anchor-necessary-not-sufficient.
- `test/init/init.test.ts` — one new test exercising the packed tarball.
- No `src/` changes.

### Out of scope

Deliberately untouched, reserved for the capability change that follows: REQ-VER-003 being over-broad (provenance rejects any change directory lacking a bundle, including hand-written ones), the unspecified MCP transport, and the freshness-hash mechanism for spec↔task staleness.

### Findings recorded, not acted on

These surfaced while scoping and are written down so they are not rediscovered:

- **`specd status` has no detector for a disabled layer.** A layer present in `LAYER_ORDER` but absent from `verify.levels` is reported nowhere. `provenance` is currently specified, unimplemented and disabled — three degrees of not-done, none visible.
- **`readActiveChange` returns the oldest change, not the active one.** `src/verify/active-change.ts` takes `listChanges(root)[0]` from an ascending sort. Correct with one change directory, silently wrong with two. This is why this change stays in OpenSpec and does not open a second `.specd/changes/` entry.
- **`.specd` spec edits are not tracked by a `.specd` change.** This change edits capabilities without a corresponding delta in specd's own format, because a `.specd` change cannot be closed until `archive` exists. The dogfooding loop is open at that end.
- **Shadow spec, reported but unverifiable here.** The maintainer reports that the original product proposal uses `REQ-SPEC-*`, `REQ-BOARD-*`, `REQ-MEM-*` and `REQ-SEC-*` prefixes. No such identifier appears anywhere in this repository; the document is external. Whether those become capabilities or are retired as history is a decision that needs the document in hand.
- **The anchor fallback search excludes `.specd/` but not `openspec/`.** Discovered by this change poisoning its own signal: `design.md` discusses `checkRetiredReuse`, so REQ-FMT-004's dangling anchor now "suggests" a design document as the symbol's new home. `src/anchors/suggest.ts` already excludes `openspec/`; `SEARCH_EXCLUDE_PREFIXES` in `src/anchors/resolve.ts` does not. Same class of defect fixed during change `verify-gate-and-anchor-ladder` for the spec tree, missed for the change tree. Severity and gate outcome are unaffected — only the suggestion text is wrong.
- **A clean directory passes the gate vacuously.** `specd verify` in a directory with no `.specd/specs/` exits 0. Defensible, but it means "green" and "nothing to check" are indistinguishable.
