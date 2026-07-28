## Why

`.specd/specs/` held ten requirements describing behaviour that has never existed in code. Four failed the gate, six were downgraded to warnings by a delta that claimed them and never delivered. A permanently red gate teaches people to ignore the gate, and a green one built on a stale delta is worse.

The cause is not the gate. Under the Modelo B decision, `.specd/specs/` contains realized truth only, and a requirement whose code is not written lives in the `delta.md` of an open change until `specd archive` applies it. Those ten were never realized, so **they were never entitled to be in `specs/`**.

This is a correction of illegal state, not a workflow step. The distinction matters because it fixes the shape of the fix: nothing is being un-archived, no new delta operation is needed, and the situation is not recurring.

**It cannot recur.** Once Fatia 2 ships, a requirement enters `specs/` only through `archive`, and `archive` refuses to run while any affected anchor dangles (REQ-ANC-007). The illegal state stops being reachable. **No fourth delta section will ever be needed** — not for deferral, which `corrections-fatia-1` already removed, and not for migration, which this change performs once and closes.

This change is text. No `src/` changes.

## What Changes

**Migration out of `specs/` (ten requirements)**
- Eight move to `.specd/changes/2026-07-fatia-2/delta.md` as ADDED: REQ-ANC-007, REQ-ANC-008, REQ-VER-004, REQ-VER-005, REQ-FMT-004, REQ-FMT-005, REQ-FMT-006, REQ-FMT-007. All are implemented by Fatia 2.
- REQ-VER-003 moves to `.specd/changes/2026-07-fatia-3/delta.md`. Fatia 2 cannot hold it: as written it rejects any change lacking `explore/manifest.json`, which would reject Fatia 2 itself. Fatia 3 exists so the requirement has a home; see its `proposal.md`.
- REQ-EXP-007 does **not** move. It is realized — vacuously, since nothing validates `draft.md` — and its dangling anchor was an anchor error, not missing behaviour. **It loses its anchor entirely.** A negative requirement has nothing to point at, and an anchor aimed at the verifier would resolve while proving nothing. Decorative anchor is worse than absent anchor: it trades honest silence for a false signal of coverage. P7, and REQ-ANC-001 already makes anchors optional.

**Requirements rewritten while moving**
- REQ-FMT-005 and REQ-FMT-006 gain Modelo B semantics: ADDED and MODIFIED both carry complete requirement text; the destination capability is declared by a `**Capability.**` field inside the ADDED block.
- REQ-ANC-008 changes exit code 1 to 2. "No suggestion to apply" is a refusal to act, not a verdict, and exit 1 belongs to `specd verify` alone (P2).
- REQ-VER-005 splits into three, one per outcome the maintainer decided: empty `evidence.commits` on a `done` task rejects (REQ-VER-005); a listed SHA unreachable in history warns (REQ-VER-010); an unavailable history exits 2 (REQ-VER-011). Anchors prove code now, evidence proves work then — different axes, P7. The rule survives squash, rebase and shallow clone while keeping the anti-fraud property that matters: a completion claim with no support at all still fails.

**MODIFIED in Fatia 2's delta (text stays in `specs/` until archive)**
- REQ-ANC-006: the graduated policy grades by origin — `specs/` is realized so a dangling anchor is an error; a change delta is work in flight so it is a warning. It no longer consults "the active change", which dissolves the ambiguity and removes the anchor layer's dependency on `readActiveChange`.
- REQ-CLI-001 and REQ-CLI-004: **exit 1 is a verdict, exit 2 is a refusal to act.** Without this, `archive` refusing on a coverage failure and `anchor fix` refusing without a suggestion both contradict P2 in silence.

**New requirements (fifteen)**
- `archive` capability, REQ-ARC-001 through REQ-ARC-010. No such capability existed; only REQ-ANC-007 constrained the command. Covers explicit change naming, preconditions, per-section application, destination, memory, no-commit, ordering and idempotent reapplication.
- REQ-CFG-007: `specd status` reports where a requirement identifier currently lives. Under Modelo B the identifier stays stable and the address does not.
- REQ-CFG-008 and REQ-CFG-009: `specd status` reports how long each open change has been open and how many requirements it holds in warning. Fatia 3 will hold an orphan for an indefinite period, and a change that holds orphans without closing downgrades everything it lists — the same pathology this change corrects. These make stalling visible without the tool passing judgement.

**Documentation**
- `AGENTS.md` and `CLAUDE.md` state Modelo B as a governing rule, so an agent implementing Fatia 2 does not write new requirements straight into `specs/`.

## Capabilities

### New Capabilities

- `modelo-b-migration`: pointer spec mapping this change's corrections to the REQ-IDs of `.specd/specs/` and of the Fatia 2 and Fatia 3 deltas, by reference. The authoritative contract is `.specd/`; this file restates nothing.

### Modified Capabilities

None. `openspec/specs/` stays empty by the decision taken when `bootstrap-fatia-1` was archived: the durable contract lives in `.specd/`, enforced by `specd verify`.

## Impact

- `.specd/specs/` — nine sections removed across `spec-format.md`, `anchors.md`, `verify.md`; one anchor block removed from `explore.md`. 50 requirements become 41.
- `.specd/changes/2026-07-fatia-2/` — new: `delta.md` (20 ADDED, 3 MODIFIED) and `proposal.md`.
- `.specd/changes/2026-07-fatia-3/` — new: `delta.md` (1 ADDED) and `proposal.md`.
- `test/dogfood.test.ts` — rewritten. It asserted the gate was red; that was the Fatia 1 criterion and is now false. It asserts the Modelo B invariant instead.
- `AGENTS.md`, `CLAUDE.md` — Modelo B and the Fatia 2 ordering.
- No `src/` changes. No new dependencies.

### Conservation

Text migration of this size loses requirements in transcription unless counted. Identifiers before and after:

| | count |
| --- | --- |
| `.specd/specs/` before | 50 |
| `.specd/specs/` after | 41 |
| open change deltas | 24 distinct new-or-moved (27 blocks, 3 of them MODIFIED restatements) |
| union after | 65 |
| lost | **0** |
| added | 15 |

50 → 41 in `specs/` + 9 migrated + 15 new = 65. Verified by set difference, not by reading. All 27 delta statements were run through the EARS parser: 27 parsed, one `SHALL` clause each, zero rejected.

### Deviations from the brief, and why

- **REQ-VER-005 became three requirements, not one MODIFIED.** The maintainer specified three distinct outcomes. One statement claiming three behaviours passes REQ-EARS-003 by clause count while being exactly the coordination that requirement admits it cannot detect. Splitting new requirements costs nothing — no identifier churn, no anchor history — which is what made splitting the *existing* REQ-VER-001 and REQ-VER-006 a bad trade in `corrections-fatia-1` and makes it a good one here. Same reasoning produced REQ-CFG-008 and REQ-CFG-009 from one request.
- **The capability destination is a `**Capability.**` field, not a `### <capability>` subsection.** Subsections would push requirement blocks to heading level 4 inside deltas, forcing `archive` to promote headings on application and breaking the byte-identity that REQ-ARC-010 relies on. A field keeps requirements at level 3 in both places, reuses `parseRequirement` with no parameter, and reduces application to removing one line.

### The shadow spec

The original product proposal — reported to hold 63 requirements under `REQ-SPEC-*`, `REQ-BOARD-*`, `REQ-MEM-*` and `REQ-SEC-*` prefixes — **is not in this repository.** `git ls-files` does not list it; `.reference/` holds only the openspec and compozy clones, which are gitignored. It has now produced four citations of requirements that do not exist here: REQ-SPEC-012 and a `synced_hash` mechanism during the Fatia 1 review, REQ-SPEC-011 and REQ-MEM-005 during the Modelo B design.

**That document is design history, not contract.** The contract is `.specd/specs/` plus the deltas of open changes, and nothing else. A requirement identifier that does not appear there does not bind this repository, whatever the document says.

Two consequences:

1. **It must be versioned or explicitly declared out.** An unversioned document that keeps producing binding-sounding identifiers is a second source of truth with no detector. Either it enters the repository — `docs/history/` is the natural place, marked non-normative — or a line in `README.md` states that it is superseded and will not be reconciled.
2. **What it covers that has no capability today is backlog, not spec.** Deliberately identified without the `REQ-` prefix, so no future citation can be mistaken for a contract:

   | id | theme | evidence it exists in this repo |
   | --- | --- | --- |
   | `BL-BOARD-01` | board integration beyond `explore`: reading cards, writing back, `synced_hash` reconciliation | `board.project` and `token_env` in config; `sync` named in REQ-CLI-001 and REQ-CLI-003 acceptance |
   | `BL-MEM-01` | memory model: what is written, when it is pruned, how limits are enforced | `[memory]` with `change_limit_lines` and `task_limit_lines` in `.specd/config.toml`; REQ-CFG-006 mentions memory files exceeding limits; no requirement defines them |
   | `BL-SEC-01` | secrets and permissions beyond `token_env`: what `explore` may read, what redaction guarantees | REQ-CFG-003 and REQ-EXP-005 cover fragments; no threat model |
   | `BL-EXEC-01` | execution and orchestration: `propose`, `apply`, hooks | named as out of scope in every proposal so far; no capability |

   Whether each becomes a capability or is retired as history needs the document in hand. This table records the themes derivable from the repository alone, and is explicitly not a reconstruction of the 63.
