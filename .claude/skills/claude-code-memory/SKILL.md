---
name: claude-code-memory
description: "Knowledge base from \"How Claude remembers your project\" (Claude Code docs). Use when authoring or debugging Claude Code memory — CLAUDE.md files, scopes & load order, @imports, AGENTS.md interop, .claude/rules/ path-scoped rules, managed/org CLAUDE.md, auto memory & MEMORY.md, and /memory troubleshooting."
---

<!-- argument-hint: [topic, setting, file, or chapter number] -->

# How Claude Remembers Your Project
**Source**: Claude Code docs — code.claude.com/docs/en/memory | **Sections**: 8 | **Generated**: 2026-06-23

## How to Use This Skill

- **Without arguments** — load core frameworks for reference
- **With a topic** — ask about `load order`, `path-scoped rules`, `auto memory`, `claudeMdExcludes`, `@imports`; I find and read the relevant chapter
- **With chapter** — ask for `ch05`; I load that specific chapter
- **Browse** — ask "what chapters do you have?" for the full index

When you ask about a topic not covered below, I read the relevant chapter file before answering.

---

## Core Frameworks & Mental Models

**Two-mechanism memory model.** A session starts with a fresh context window; knowledge persists via exactly two systems, both loaded every session:
- **CLAUDE.md** — instructions *you* write (loaded in full).
- **Auto memory** — notes *Claude* writes itself (per repo; `MEMORY.md` index loads up to 200 lines / 25KB).

You own CLAUDE.md; Claude owns auto memory. Match the writer to the knowledge.

**Context, not enforcement.** Both systems are content Claude reads and *tries* to follow — no strict compliance. For a guaranteed action at a lifecycle point, use a **hook**, not memory. CLAUDE.md is delivered as a user message after the system prompt; `--append-system-prompt` puts text at system-prompt level (every invocation).

**Right-mechanism routing (where does a fact go?):**
- Same mistake twice / re-typed correction / new-teammate context → **CLAUDE.md**.
- Multi-step procedure → **skill**. Only matters for some files/dirs → **path-scoped rule** (`.claude/rules/` + `paths`). Global always-true fact → **root CLAUDE.md**.
- Claude discovered it, should accrue automatically → **auto memory**. Must happen at lifecycle point → **hook**. Hard block → **managed setting** (`permissions.deny`).

**Four-scope hierarchy (load order: broadest first, closest-to-CWD read last → wins on conflict):** managed policy → user (`~/.claude/CLAUDE.md`) → project (`./CLAUDE.md` or `./.claude/CLAUDE.md`) → local (`./CLAUDE.local.md`, gitignored). All files **concatenate**, none override. Ancestors load eagerly at launch; subdirectory files load **lazily** when Claude reads a file there.

**Adherence levers (how to be followed reliably):**
- **Specific & verifiable** — "Use 2-space indentation" beats "format properly" (#1 lever).
- **Concise** — target **<200 lines**/file; longer = more context, less adherence.
- **Structured** — markdown headers/bullets; Claude scans like a reader.
- **No conflicts** — contradictions get resolved arbitrarily; audit periodically.

**Settings vs CLAUDE.md.** Settings enforce technically regardless of Claude's decision; CLAUDE.md guides behaviorally. Must-block → setting (`permissions.deny`, `sandbox.enabled`, `env`, `forceLoginMethod`). Please-behave / style / compliance → CLAUDE.md (managed for org-wide). Inline org content via `claudeMd` in `managed-settings.json`; filter noisy ancestor files via `claudeMdExcludes` (absolute-path globs, merge across layers). Managed policy CLAUDE.md is **unexcludable**.

**Imports & interop.** `@path` expands a file into context at launch (relative = to importing file; ≤4 hops). Imports **organize, they don't save context**. Claude reads `CLAUDE.md` only — bridge `AGENTS.md` via `@AGENTS.md` import (or symlink). Backtick a path to mention without importing; `<!-- comments -->` are stripped before injection.

**Auto memory.** On by default (v2.1.59+); Claude self-curates what's future-useful. Store: `~/.claude/projects/<project>/memory/`, per git repo, shared across worktrees, **machine-local**. `MEMORY.md` is a lean index (loaded ≤200 lines / 25KB); topic files load on demand. Toggle via `/memory`, `autoMemoryEnabled`, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`; relocate via `autoMemoryDirectory`.

**Troubleshooting first move.** "Not followed" = **not loaded, too vague, or contradicted** — run `/memory` to verify load, make it specific, remove conflicts. Project-root CLAUDE.md survives `/compact` (re-read from disk); nested files reload lazily; conversation-only instructions are lost. Debug what loads with the `InstructionsLoaded` hook.

---

## Chapter Index

| # | Title | Key Topics |
|---|-------|----------------|
| [ch01](chapters/ch01-claude-md-vs-auto-memory.md) | CLAUDE.md vs Auto Memory | two-mechanism model, context-vs-enforcement, comparison table |
| [ch02](chapters/ch02-writing-effective-claude-md.md) | Writing Effective CLAUDE.md | when to add, right-mechanism routing, specificity/size/structure |
| [ch03](chapters/ch03-locations-and-load-order.md) | Locations & Load Order | four scopes, concatenate-don't-override, lazy loading, `--add-dir` |
| [ch04](chapters/ch04-imports-and-agents-md.md) | Imports, CLAUDE.local.md & AGENTS.md | `@path`, AGENTS.md bridge, worktree sharing, comment stripping |
| [ch05](chapters/ch05-project-rules.md) | Organize Rules with .claude/rules/ | modular rules, `paths` frontmatter, globs, symlinks, user rules |
| [ch06](chapters/ch06-managing-for-large-teams.md) | Manage CLAUDE.md for Large Teams | managed CLAUDE.md, `claudeMd`, `claudeMdExcludes`, settings vs md |
| [ch07](chapters/ch07-auto-memory.md) | Auto Memory | storage path, `MEMORY.md`, load limits, enable/disable/relocate |
| [ch08](chapters/ch08-troubleshooting.md) | View, Edit & Troubleshoot | `/memory`, adherence ladder, `/compact` reload, `InstructionsLoaded` |

## Topic Index

- **`--add-dir` / additional dirs** → ch03
- **AGENTS.md** → ch04
- **`--append-system-prompt`** → ch08
- **auto memory** → ch01, ch07
- **`autoMemoryDirectory` / `autoMemoryEnabled`** → ch07
- **CLAUDE.local.md** → ch03, ch04
- **`claudeMd` (inline managed)** → ch06
- **`claudeMdExcludes`** → ch06
- **`/compact` reload** → ch08
- **compaction survival** → ch08
- **conflicts / contradictions** → ch02, ch08
- **HTML comment stripping** → ch03, ch04
- **`@path` imports** → ch04
- **`/init`** → ch02, patterns.md
- **`InstructionsLoaded` hook** → ch08
- **load order / scopes** → ch03
- **managed policy CLAUDE.md** → ch03, ch06
- **`/memory` command** → ch07, ch08
- **`MEMORY.md`** → ch07
- **monorepos / excludes** → ch03, ch06
- **path-scoped rules / globs** → ch05
- **`.claude/rules/`** → ch05
- **settings vs CLAUDE.md** → ch01, ch06
- **size / 200-line limit** → ch02, ch07, ch08
- **specificity / adherence** → ch02, ch08
- **symlinks (rules / AGENTS.md)** → ch04, ch05
- **troubleshooting** → ch08
- **user-level rules** → ch05
- **worktree sharing** → ch04, ch07

## Supporting Files

- [glossary.md](glossary.md) — all key terms, settings, env vars, and flags with definitions
- [patterns.md](patterns.md) — concrete setup/management techniques (init, AGENTS bridge, splitting, org deploy)
- [cheatsheet.md](cheatsheet.md) — decision rules, scope table, thresholds, troubleshooting tells

---

## Scope & Limits

This skill covers the "How Claude remembers your project" docs page only (CLAUDE.md + auto memory). For hooks (the enforcement layer), skills, subagents, or settings internals, see the sibling `claude-code-hooks`, `claude-code-skills`, `claude-code-subagents` skills or the linked docs. Behavior may change across Claude Code versions — verify settings/flags against your installed version.
