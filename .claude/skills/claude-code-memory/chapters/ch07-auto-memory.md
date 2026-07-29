# Chapter 7: Auto Memory

## Core Idea
Auto memory lets Claude accumulate knowledge across sessions with zero manual effort — it saves notes for itself (build commands, debugging insights, architecture, preferences) when it judges them useful in a future conversation. Storage is **per git repository**, machine-local, and indexed by a `MEMORY.md` entrypoint.

## Frameworks Introduced
- **Self-curated memory**: Claude decides what's worth keeping.
  - When to use: knowledge Claude discovers while working that should persist without you writing CLAUDE.md.
  - How: Claude writes/reads files under the project memory dir during a session; it does *not* save every session — only when info would help later. You'll see "Writing memory" / "Recalled memory" in the UI.
- **MEMORY.md index pattern**: One concise entrypoint pointing at detailed topic files.
  - When to use: keeping startup context small while retaining deep notes.
  - How: `MEMORY.md` stays short and is loaded every session (first **200 lines or 25KB**, whichever first). Detailed notes move into separate topic files (`debugging.md`, etc.) loaded **on demand**, not at startup.
- **Per-repo shared store**: One memory dir per git repo.
  - How: path derived from the git repo, so all worktrees/subdirs of the same repo share one dir. Outside a git repo, project root is used.

## Key Concepts
- **Auto memory**: Notes Claude writes itself; on by default; requires Claude Code **v2.1.59+** (`claude --version`).
- **`MEMORY.md`**: Concise index loaded every session (first 200 lines / 25KB).
- **Topic files**: `debugging.md`, `patterns.md`, etc. — read on demand via standard file tools, not loaded at startup.
- **Storage path**: `~/.claude/projects/<project>/memory/` where `<project>` derives from the git repo.
- **`autoMemoryEnabled`**: Project setting; `false` disables.
- **`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`**: Env var to disable.
- **`autoMemoryDirectory`**: Setting to relocate the dir (absolute path or `~/`-prefixed; honored from any settings scope; project-scope value gated behind workspace trust dialog).

## Mental Models
- Auto memory is Claude's **lab notebook**: it writes what it learns, you don't.
- `MEMORY.md` is an **index, not a dump** — Claude keeps it lean by offloading detail to topic files.
- The 200-line/25KB limit applies **only to `MEMORY.md`** — CLAUDE.md loads in full regardless of length (shorter still = better adherence).

## Worked Example
Typical memory directory after some work:
```text
~/.claude/projects/<project>/memory/
├── MEMORY.md          # Concise index, loaded into every session
├── debugging.md       # Detailed notes on debugging patterns
├── api-conventions.md # API design decisions
└── ...                # Any other topic files Claude creates
```
At session start, Claude loads `MEMORY.md` (≤200 lines / 25KB) and uses it to know *what's stored where*. When it needs detail, it reads `debugging.md` on demand.

Disable per-project:
```json
{ "autoMemoryEnabled": false }
```
Relocate the store:
```json
{ "autoMemoryDirectory": "~/my-custom-memory-dir" }
```
(Project-scoped `autoMemoryDirectory` takes effect only after you accept the workspace trust dialog — the same gate that governs hooks.)

## Anti-patterns
- **Expecting memory to sync across machines**: it's machine-local; not shared across machines or cloud environments.
- **Treating `MEMORY.md` as unbounded**: content past 200 lines / 25KB isn't loaded at startup — keep it an index.
- **Assuming every session writes memory**: Claude saves only what it deems future-useful.

## Key Takeaways
1. Auto memory is on by default (needs v2.1.59+); Claude self-curates what to keep.
2. One memory dir per git repo at `~/.claude/projects/<project>/memory/`, shared across worktrees, machine-local.
3. `MEMORY.md` is the index, loaded every session up to 200 lines / 25KB; topic files load on demand.
4. The size limit applies only to `MEMORY.md`, not CLAUDE.md.
5. Toggle via `/memory`, `autoMemoryEnabled`, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
6. Relocate with `autoMemoryDirectory` (abs or `~/` path; project scope needs workspace trust).

## Connects To
- **Ch 1**: Auto memory vs CLAUDE.md — who writes what.
- **Ch 8**: "I don't know what auto memory saved" — audit via `/memory`.
- **Subagent memory**: Subagents keep their own (`code.claude.com/docs/en/sub-agents#enable-persistent-memory`).
- **`/memory`**: Browse, toggle, and open memory files (Ch 8 / next section).
