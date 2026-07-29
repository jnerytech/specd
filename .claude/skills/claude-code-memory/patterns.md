# Patterns — Claude Code Memory

## Onboard a project with `/init`
**When to use**: starting Claude Code in a repo with no CLAUDE.md, or improving an existing one.
**How**: run `/init` — Claude analyzes the codebase and writes build/test commands and conventions. If a CLAUDE.md exists, it suggests improvements instead of overwriting. Set `CLAUDE_CODE_NEW_INIT=1` for an interactive multi-phase flow (asks which artifacts — CLAUDE.md, skills, hooks — explores with a subagent, asks follow-ups, presents a reviewable proposal before writing).
**Trade-offs**: generated content covers what's discoverable; you still add what Claude can't infer.

## Bridge AGENTS.md to Claude Code
**When to use**: repo already has `AGENTS.md` for other agents.
**How**: create `CLAUDE.md` with `@AGENTS.md` then append Claude-specific lines below; or `ln -s AGENTS.md CLAUDE.md` (no Claude-specific content). On Windows prefer the import (symlinks need Admin/Dev Mode).
**Trade-offs**: single source of truth; import keeps both editable, symlink keeps them identical.

## Split a too-large CLAUDE.md with path-scoped rules
**When to use**: CLAUDE.md exceeds ~200 lines and adherence drops.
**How**: move file-specific guidance into `.claude/rules/<topic>.md` with `paths:` frontmatter so it loads only when matching files are read; keep only global always-true facts in CLAUDE.md.
**Trade-offs**: imports do *not* help (they still load at launch) — path-scoped rules genuinely reduce per-session context.

## Share personal instructions across worktrees
**When to use**: you want private prefs in every worktree of a repo.
**How**: gitignored `CLAUDE.local.md` lives only in its worktree — instead import from home: `@~/.claude/my-project-instructions.md`.
**Trade-offs**: home-dir file is machine-local, not committed.

## Share rules across projects via symlinks
**When to use**: maintaining one canonical rule set for multiple repos.
**How**: `ln -s ~/shared-claude-rules .claude/rules/shared` (dir) or `ln -s ~/company-standards/security.md .claude/rules/security.md` (file). Symlinks resolved normally; circular ones handled.
**Trade-offs**: edits propagate everywhere — intended for shared standards.

## Deploy org-wide instructions (managed)
**When to use**: company standards/compliance must apply to every session, unexcludable.
**How**: deploy a managed CLAUDE.md at the OS path, or inline via `claudeMd` in `managed-settings.json`. Loads before user/project; users can't exclude it.
**Trade-offs**: behavioral only — for hard blocks use managed settings (`permissions.deny`, `sandbox.enabled`).

## Filter noisy ancestor CLAUDE.md (monorepo)
**When to use**: other teams' ancestor CLAUDE.md/rules leak irrelevant instructions.
**How**: `claudeMdExcludes` glob list (absolute-path-matched) in `.claude/settings.local.json` to keep it machine-local; arrays merge across layers.
**Trade-offs**: managed policy CLAUDE.md cannot be excluded.

## Load memory from additional directories
**When to use**: you `--add-dir` a sibling and want its CLAUDE.md too.
**How**: `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir ../shared-config` — loads `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`, `CLAUDE.local.md` from it.
**Trade-offs**: off by default; `CLAUDE.local.md` skipped if `local` excluded from `--setting-sources`.

## Let Claude self-curate with auto memory
**When to use**: build commands / debugging insights / preferences should persist without you writing them.
**How**: leave auto memory on (v2.1.59+); Claude writes notes when useful, keeping `MEMORY.md` a lean index and detail in topic files. Audit/edit via `/memory`.
**Trade-offs**: machine-local, not synced across machines; only `MEMORY.md`'s first 200 lines / 25KB load at startup.

## Escalate from guidance to enforcement
**When to use**: an instruction *must* happen, not just *should*.
**How**: lifecycle-bound action (pre-commit, post-edit) → **hook**; system-prompt-level → `--append-system-prompt` (every invocation, scripts/automation). Debug which files load → `InstructionsLoaded` hook.
**Trade-offs**: hooks are deterministic but you maintain shell scripts; `--append-system-prompt` is per-invocation, not interactive-friendly.
