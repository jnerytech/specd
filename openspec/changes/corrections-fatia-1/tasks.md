# Tasks — corrections-fatia-1

Text and manifest edits only. No file under `src/` is modified.
Behaviour contract: REQ-IDs in `.specd/specs/`. Rationale per decision: `design.md`.

## 1. Delta format

- [x] 1.1 Delete the `## DEFERRED` section from `.specd/changes/2026-07-fatia-1/delta.md` [REQ-FMT-005]
- [x] 1.2 Move REQ-ANC-007, REQ-ANC-008, REQ-VER-004 and REQ-VER-005 into `.specd/changes/2026-07-fatia-1/proposal.md` as prose, stating why each was deferred
- [x] 1.3 Confirm `specd verify` still reports those four as errors — the section was inert, so nothing should change [REQ-ANC-006]

## 2. Package identity

- [x] 2.1 Change `name` in `package.json` from `@jnerytech/specd` to `specd`; regenerate `package-lock.json` so both its `name` fields match
- [x] 2.2 Correct REQ-CLI-006's title in `.specd/changes/2026-07-fatia-1/delta.md` to "Zero-install distribution" [REQ-CLI-006]
- [x] 2.3 Rewrite REQ-CLI-006's acceptance in `.specd/specs/cli.md`: keep only what the package and manifest can satisfy, drop the `npx specd verify` claim [REQ-CLI-006]
- [x] 2.4 Record the unscoped-name reservation in `.specd/changes/2026-07-fatia-1/proposal.md` as an operational prerequisite, alongside the existing "Passo 0"
- [x] 2.5 Reconcile `README.md`'s naming section with the decision now taken, keeping the rationale
- [x] 2.6 Add an offline test that runs `npm pack`, installs the tarball into a temporary directory with `--offline`, and executes `node_modules/.bin/specd --version` [REQ-CLI-006]

## 3. Orphan acceptance criteria

- [x] 3.1 Move REQ-ANC-005's WASM-grammar criterion to REQ-CLI-006's acceptance in `.specd/specs/cli.md`, beside the native-dependency constraint [REQ-ANC-005, REQ-CLI-006]
- [x] 3.2 Relocate the WASM assertion in `test/anchors/strategy.test.ts` to sit with the distribution test, so the test lives where its requirement now does
- [x] 3.3 Add the new verify requirement for project-layer output capture to `.specd/specs/verify.md`, anchored at `src/verify/layers/project.ts :: export const projectLayer`; remove the criterion from REQ-VER-006 [REQ-VER-006]
- [x] 3.4 Add the new explore requirement for manifest durability to `.specd/specs/explore.md`, anchored at `src/explore/index.ts :: export async function explore`; remove the criterion from REQ-EXP-003 [REQ-EXP-003]
- [x] 3.5 Confirm both new requirements resolve their anchors and add no gate error, since neither is in the active change's delta [REQ-ANC-002, REQ-ANC-006]

## 4. Honest EARS check

- [x] 4.1 Rewrite REQ-EARS-003's acceptance in `.specd/specs/ears.md` to state that the check counts `SHALL` clauses and is a syntactic tripwire, not proof of single behaviour [REQ-EARS-003]
- [x] 4.2 Add the inline-code rule to that acceptance: a `SHALL` inside backticks is a mention, not a clause — behaviour `src/ears/parse.ts` already implements and no requirement records [REQ-EARS-003]
- [x] 4.3 Verify `src/ears/parse.ts` is untouched; the coordinated-clause heuristic is deliberately not added

## 5. P7

- [x] 5.1 Add P7 to `AGENTS.md`: an anchor is necessary, never sufficient — it answers where, not whether or when
- [x] 5.2 Mirror P7 into `CLAUDE.md`, keeping the two files identical as they are today
- [x] 5.3 Record in P7 the discipline Fatia 1 followed: an anchor is never pointed at a partial implementation, and an honestly dangling anchor beats one resolved to a stub

## 6. Closing

- [x] 6.1 `make verify` green — format, lint, tests, build
- [x] 6.2 Run `specd verify` and confirm the gate's output changed only as intended: same four errors, no new ones
- [x] 6.3 Report whether any text edit broke an existing test, naming specifically the tests that read the seven capabilities (`test/parser/capability.test.ts`, `test/ears/parse.test.ts`, `test/dogfood.test.ts`)
