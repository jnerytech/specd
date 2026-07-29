## Context

change `verify-gate-and-anchor-ladder` is archived and its gate runs. `specd verify` on this repository exits 1 on four real dangling anchors, which is the intended state. What it cannot yet detect is inconsistency in the specification artifacts themselves, because `parseDelta`, `parseTask`, `coverage` and `evidence` are the next slice's work.

Every correction here is text. The one exception is `package.json`'s `name` field, which is data rather than behaviour — no `src/` module reads it except `src/cli.ts`, which reads `version` only.

Two constraints shape the decisions below. no-llm-in-decision-path forbids a language model anywhere in the decision path, so nothing here can be resolved by semantic judgement at gate time. no-guessing-on-conflict forbids guessing in conflict, which is why the two genuinely ambiguous points — the `npx` acceptance criterion and whether to open a second `.specd` change — were decided by the maintainer before this document was written, not inferred.

## Goals / Non-Goals

**Goals:**

- Leave `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/delta.md` parseable by the `parseDelta` that change `archive-cycle-and-effective-specs` will write.
- Make every acceptance criterion in the touched requirements either satisfiable by code and covered by a test, or explicitly not a code property.
- State what the EARS single-behaviour check actually measures, without weakening the check.
- Record the anchor-sufficiency discipline as a principle, since it cannot be a gate rule.

**Non-Goals:**

- No new runtime behaviour. The two requirements this change adds describe code that already exists and already has tests; they close a gap between spec and implementation, in the direction of the spec.
- No coordinated-clause heuristic for EARS. Deferred deliberately — see Decisions.
- No fix for `readActiveChange`, `provenance` scope, MCP transport, or freshness hashing. All reserved for the capability change.
- No `.specd/changes/` entry for this change.

## Decisions

### Deferral leaves the delta, and does not become a fourth section

**Chosen:** delete `## DEFERRED`; move the four identifiers into `proposal.md` as prose.

The three legal sections exist because each maps to something `archive` does to the capabilities: ADDED and MODIFIED write requirement text, REMOVED retires identifiers. A DEFERRED section maps to nothing — archive would read it and do nothing. Adding a section the archiver ignores weakens the file's contract in exchange for documentation value that prose already provides.

There is a second, stronger reason. Deferral is *already encoded* by absence: REQ-ANC-006's graduated policy treats a requirement absent from the delta as an error, and those four requirements produce errors today precisely because the parser never sees the DEFERRED heading. The section is inert. Deleting it changes no behaviour and removes a file that would fail its own format check.

**Rejected — add DEFERRED to REQ-FMT-005:** costs a spec change to accommodate a section with no machine meaning.

**Rejected — separate `deferred.md`:** a new file for four identifiers that the proposal already has a scope section for.

**Consequence to accept:** the distinction between "deliberately deferred" and "overlooked" now lives only in prose. That distinction is real and worth keeping, which is why the identifiers move rather than disappear.

### The three orphan criteria are resolved case by case, not uniformly

Each criterion described behaviour no clause of its statement claimed. A uniform rule would be wrong, because the three are orphaned for different reasons.

| Criterion | Why it is orphaned | Resolution |
|---|---|---|
| REQ-ANC-005: no WASM grammar in the bundle | It is a *packaging* constraint, not anchor-resolution behaviour | Move to REQ-CLI-006 |
| REQ-VER-006: stdout and stderr in the report | It is a genuinely separate behaviour of the project layer | New requirement |
| REQ-EXP-003: manifest written even on failure | It is an *ordering* guarantee, not a gating one | New requirement |

**REQ-ANC-005 → REQ-CLI-006.** REQ-CLI-006's acceptance already carries "nenhuma dependência nativa ou passo de build no cliente". A WASM grammar is exactly that. The criterion was never about how anchors resolve; it was about what ships. Moving it puts the constraint where its sibling already is and leaves REQ-ANC-005 describing only strategy selection. The existing test in `test/anchors/strategy.test.ts` that reads `package.json` dependencies moves with it.

**REQ-VER-006 → new requirement.** Folding output capture into the statement would produce a third coordinated clause, making the statement a clearer example of the grammar-gaming this change is documenting. Capturing and surfacing a subprocess's output is independently testable and independently valuable: it is what makes a failed project layer diagnosable in CI. It earns its own identifier.

**REQ-EXP-003 → new requirement.** This is the sharpest of the three. "The manifest is written even when the run is blocked" is an ordering guarantee — write, then throw — and it is arguably the most consequential behaviour in the explore capability, since it is what lets the next person see what was collected before the failure. Its absence from any statement was the most serious of the three gaps. It is testable in isolation: block the run, assert the file exists.

Both new requirements anchor at code that exists and is already under test, so neither introduces a dangling anchor.

### REQ-EARS-003 admits it counts grammar

**Chosen:** rewrite the acceptance to state that the check is syntactic, keep the statement as a single crisp SHALL.

The check counts `SHALL` clauses. That is deterministic, offline and instantaneous — everything no-llm-in-decision-path and gate-no-network want. It is also gameable, and this change exists partly because it was gamed: six statements were rewritten to satisfy it, and three of those reduced grammar without reducing behaviour.

Two honest responses were available. Weaken nothing and say so, or add a heuristic that flags a coordinating clause trailing the SHALL.

The heuristic is deferred, and the reason matters: it produces warnings on correct statements. `REQ-CFG-003` ("only through `token_env`, rejecting any literal token value") is a genuine single behaviour whose second clause restates the first from the other side — a coordinated-clause detector flags it. Shipping a check that cries wolf on correct specs trains people to ignore it, which costs more than the check earns. It is worth building only alongside the acceptance-criteria-coverage signal that would make it precise, and that belongs with `coverage`.

The acceptance also gains the inline-code rule the parser already implements: a `SHALL` inside backticks is a mention, not a clause. That behaviour was written during change `verify-gate-and-anchor-ladder` to stop `REQ-EARS-004` from failing itself, and no requirement records it.

**Rejected — leave the requirement as written:** the title "Single behaviour per requirement" over-promises what the check delivers, and this change is about closing exactly that kind of gap.

### REQ-CLI-006 separates code property from registry fact

The acceptance criterion `npx specd verify` funciona em diretório limpo` conflates two claims. That the package exposes a working binary once installed is a property of the code and the manifest, verifiable offline. That `npx specd` reaches *this* package is a property of the npm registry, verifiable only by publishing — and currently false, since the scoped name is what ships.

Splitting them makes the first testable and the second explicit as the human prerequisite it already is in `proposal.md`'s "Passo 0".

**Test approach, verified before committing to it:** `npm pack` into a temporary directory, `npm install --offline` the resulting tarball into a scratch project, execute `node_modules/.bin/specd`. Measured at roughly half a second for the install; it exercises the real `files` list, the real `bin` mapping and the real built output. It does not touch the network and does not require publication.

This is the only place in the suite that executes the packaged artifact rather than the source. That is precisely the drift it exists to catch: `files` or `bin` can be wrong while every source test passes.

### This change does not open a `.specd/changes/` entry

Specd's own model says a capability edit needs a change with a delta, and this change edits capabilities. It nonetheless stays in OpenSpec only.

Opening a second `.specd/changes/` directory triggers a defect in code change `verify-gate-and-anchor-ladder` shipped: `readActiveChange` returns `listChanges(root)[0]` from an ascending sort — the oldest directory, not the active one. With `2026-07-28-verify-gate-and-anchor-ladder` and a hypothetical `2026-08-corrections`, the graduated anchor policy would silently read the older delta. Correct today only because there is exactly one change.

Fixing it is one line and belongs in the capability change, alongside a test that would have caught it. Making that fix here would break this change's defining constraint — text only — for a directory that could not be closed anyway, since `archive` does not exist.

The cost is honest and recorded in the proposal: specd is not yet dogfooding its own change format for spec edits. That loop closes when `archive` ships.

### anchor-necessary-not-sufficient is a principle because it cannot be a rule

"An anchor never points at partial implementation" is not machine-checkable. Deciding whether code at a path satisfies a requirement is semantic judgement, and no-llm-in-decision-path puts semantic judgement outside the decision path permanently, not just for v1.

What *can* be stated is the epistemic limit: a resolving anchor proves location, not satisfaction. Writing that as a requirement would imply the gate enforces it and quietly overclaim — the same failure this change is correcting in REQ-EARS-003. A principle in AGENTS.md binds the humans and agents who write the specs, which is where the discipline actually lives.

change `verify-gate-and-anchor-ladder` followed it three times without a rule: the delta reader went to `src/verify/active-change.ts` rather than `src/parser/delta.ts`, the task reader to `src/status/tasks.ts` rather than `src/parser/task.ts`, and `checkRetiredReuse` was left unwritten. Each kept an anchor honestly dangling instead of resolving it to a stub.

## Risks / Trade-offs

**Editing an archived change's artifacts** → `.specd/changes/2026-07-28-verify-gate-and-anchor-ladder/delta.md` and `proposal.md` are the record of completed work, and this change rewrites them. Mitigated by the alternative being worse: leaving a delta the next slice's parser rejects, which would force the same edit under time pressure. The git history preserves what was originally written, and the correction is scoped to a section deletion plus a prose addition.

**Renaming the package is breaking** → anyone who installed `@jnerytech/specd` sees no updates under the new name. Mitigated by the version being `0.0.0` and unpublished; the cost is zero today and rises the moment it ships. This is an argument for doing it now.

**The unscoped name is not yet reserved** → renaming `package.json` to `specd` does not make `npx specd` work, and could publish into a name someone else takes first. Mitigated by keeping the reservation explicitly out of the acceptance criteria and in the operational prerequisite, so no test claims a guarantee that does not exist. The rename is a precondition for reserving, not a substitute.

**Two new requirements shift the gate's output** → REQ-VER-009 and REQ-EXP-008 are absent from the active change's delta, so under the graduated policy any dangling anchor of theirs would be an *error*, not a warning. Mitigated by both anchoring at code that exists and is tested; verified as part of the change by running the gate.

**The EARS rewrite documents a weakness without fixing it** → a reader may conclude the check is worthless. Mitigated by the acceptance stating what it does catch: two `SHALL` clauses in one statement, reliably and instantly. A tripwire that admits being a tripwire is more useful than one that claims to be a proof.

**Tarball test depends on the npm CLI and local disk** → slower than every other test and could be flaky under a constrained CI cache. Mitigated by using `--offline` so no registry is contacted, and by it being one test rather than a pattern applied broadly. If it proves flaky, the fallback is asserting the packed file list without executing, which still catches a wrong `files` entry.

## Migration Plan

No runtime migration. The package rename requires `package-lock.json` to be regenerated so its two `name` fields match; `npm install` does this. `README.md` documents the naming decision and needs its prose reconciled with the choice now made.

Rollback is `git revert`: nothing here writes state outside the repository.

## Open Questions

- Whether `REQ-VER-009` and `REQ-EXP-008` are the right identifiers, or whether the verify and explore capabilities should renumber. Taking the next free number in each is the assumption; retired identifiers are never reused, and neither capability has a `retired` list yet.
- Whether `README.md`'s naming section should record the decision and its rationale, or simply state the result. This change assumes the former, since the scoped-versus-unscoped trade-off is the kind of thing that gets re-litigated.
- The shadow-spec prefixes reported by the maintainer cannot be assessed from this repository. Whether they become capabilities or are retired as history needs the external document.
