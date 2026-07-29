# Chapter 8: View, Edit & Troubleshoot Memory

## Core Idea
`/memory` is the control panel: it lists every loaded CLAUDE.md/CLAUDE.local.md/rules file, toggles auto memory, and opens the auto-memory folder. Most "Claude won't follow my instructions" problems trace to a file not loading, a vague instruction, or a conflict — all diagnosable from here.

## Frameworks Introduced
- **`/memory` triage**: First stop for any memory issue.
  - When to use: instruction ignored, unsure what's loaded, unsure what auto memory saved.
  - How: run `/memory` → confirm the file is listed (if not, Claude can't see it); open files to read/edit; toggle auto memory; open the auto-memory folder to audit saved notes.
- **Adherence debugging ladder**: Why CLAUDE.md isn't followed (CLAUDE.md is a *user message after the system prompt*, not the system prompt — no strict compliance).
  - How (in order): (1) `/memory` to verify it loads; (2) check it's in a loaded location (Ch 3); (3) make instructions more specific; (4) hunt for conflicting instructions across files.
- **Escalation to enforcement**: When guidance isn't enough.
  - How: must run at a lifecycle point (before commit, after edit) → **hook**. Want it at system-prompt level → `--append-system-prompt` (must pass every invocation; better for scripts than interactive). Debug *which* files load → **`InstructionsLoaded` hook**.

## Key Concepts
- **`/memory` command**: Lists loaded CLAUDE.md/CLAUDE.local.md/rules; toggles auto memory; opens files in editor; links to auto-memory folder.
- **CLAUDE.md delivery**: Sent as a user message *after* the system prompt — read and attempted, not strictly enforced.
- **`--append-system-prompt`**: CLI flag injecting instructions at system-prompt level; required every invocation.
- **`InstructionsLoaded` hook**: Logs exactly which instruction files load, when, and why — for debugging path-rules/lazy-loaded files.
- **Compaction reload**: Project-root CLAUDE.md is re-read from disk and re-injected after `/compact`; nested subdir CLAUDE.md is **not** auto-re-injected (reloads next time Claude reads a file there).

## Mental Models
- "Not followed" usually means **not loaded, too vague, or contradicted** — check those three before blaming the model.
- If it *must* happen → it's a **hook**, not an instruction.
- After `/compact`, anything that lived only in conversation is **gone** — persist it in CLAUDE.md.

## Reference Tables
Common issues → fix:

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Claude ignores CLAUDE.md | Not loaded / vague / conflicting | `/memory` to verify load; make specific; remove conflicts |
| Don't know what auto memory saved | — | `/memory` → open auto-memory folder; read/edit/delete markdown |
| CLAUDE.md too large | >200 lines reduces adherence | Path-scoped rules (Ch 5); trim; imports don't help (still load) |
| Instructions lost after `/compact` | Conversation-only or nested file | Add to root CLAUDE.md (survives); nested reloads on next read |

## Worked Example
Claude keeps using tabs despite your CLAUDE.md saying "format code properly." Debug:
1. `/memory` → confirm the CLAUDE.md is **listed** (loaded). It is.
2. The rule is **vague** — rewrite: `Use 2-space indentation`.
3. Check other CLAUDE.md/rules for a contradicting "use tabs" line; remove it.
4. Still must guarantee it? It's not a lifecycle action, so a hook doesn't fit — but a *pre-commit lint* requirement *would*: write it as a hook so it fires regardless of what Claude decides.

Log exactly what loads when path-rules misbehave: enable the **`InstructionsLoaded` hook** to see each file, its load time, and the reason.

## Anti-patterns
- **Blaming the model before checking load + specificity + conflicts**: it's usually one of those.
- **Putting must-run-at-X instructions in CLAUDE.md**: use a hook; CLAUDE.md has no lifecycle guarantee.
- **Relying on nested CLAUDE.md surviving `/compact`**: only project-root is re-injected.
- **Using `--append-system-prompt` for interactive work**: it must be passed every invocation — suited to scripts/automation.

## Key Takeaways
1. `/memory` is the triage tool: verify load, toggle auto memory, audit saved notes.
2. CLAUDE.md is a post-system-prompt user message — no strict compliance; specificity + no conflicts raise adherence.
3. Adherence ladder: verify loaded → check location → make specific → remove conflicts.
4. Must-happen actions → hooks; system-prompt-level → `--append-system-prompt` (every invocation).
5. `InstructionsLoaded` hook logs which files load, when, why.
6. Project-root CLAUDE.md survives `/compact` (re-read from disk); nested files reload lazily; conversation-only instructions are lost — persist them.

## Connects To
- **Ch 2**: Specificity is the primary adherence fix.
- **Ch 3**: Verifying a file is in a loaded location.
- **Ch 7**: Auditing auto memory via `/memory`.
- **Hooks / Debug config**: `code.claude.com/docs/en/hooks-guide`, `code.claude.com/docs/en/debug-your-config`.
