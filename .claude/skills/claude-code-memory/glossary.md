# Glossary — Claude Code Memory

**`@path` import** — Directive inside CLAUDE.md that expands another file into context at launch; relative paths resolve to the importing file; recurses up to 4 hops (Ch 4).

**Adherence** — How reliably Claude follows an instruction; rises with specificity/brevity, falls with length and conflicts (Ch 2).

**AGENTS.md** — Instruction file used by other coding agents; Claude Code does *not* read it directly — bridge via `@AGENTS.md` import or symlink (Ch 4).

**Auto memory** — Notes Claude writes for itself across sessions; on by default; per git repo; needs v2.1.59+ (Ch 1, 7).

**`autoMemoryDirectory`** — Setting relocating the auto-memory dir; absolute or `~/`-prefixed; project scope gated by workspace trust (Ch 7).

**`autoMemoryEnabled`** — Project setting; `false` disables auto memory (Ch 7).

**Backtick escape** — Wrapping a path in `` `@README` `` keeps it literal instead of importing it; parser skips code spans/fences (Ch 4).

**CLAUDE.md** — Markdown instruction file you write; loaded in full every session as context, not enforced config (Ch 1, 2).

**`claudeMd` (setting)** — Key inlining managed CLAUDE.md content into `managed-settings.json`; managed/policy scope only (Ch 6).

**`claudeMdExcludes`** — Setting (glob list, absolute-path-matched) to skip ancestor CLAUDE.md/rules files; merges across layers (Ch 6).

**CLAUDE.local.md** — Private, gitignored project-root file loaded alongside CLAUDE.md; exists only in the worktree that created it (Ch 3, 4).

**`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`** — Env var that loads memory files from `--add-dir` directories (Ch 3).

**`CLAUDE_CODE_DISABLE_AUTO_MEMORY`** — Env var (`=1`) disabling auto memory (Ch 7).

**`CLAUDE_CODE_NEW_INIT`** — Env var (`=1`) enabling the interactive multi-phase `/init` flow (Ch 2/intro).

**Compaction reload** — After `/compact`, project-root CLAUDE.md is re-read from disk and re-injected; nested subdir files are not (Ch 8).

**Concatenate-don't-override** — All discovered CLAUDE.md files stack in context; later-read (closer to CWD) wins on conflict (Ch 3).

**Context (not config)** — Memory is content Claude reads and tries to follow; no strict compliance — use hooks for enforcement (Ch 1).

**External-import approval** — One-time dialog the first time a project has external imports; declining disables them permanently (Ch 4).

**HTML comment stripping** — Block-level `<!-- -->` comments removed before injection (kept inside code blocks and when read directly) (Ch 3, 4).

**`InstructionsLoaded` hook** — Hook logging which instruction files load, when, and why — for debugging path/lazy rules (Ch 8).

**Lazy loading** — Subdirectory CLAUDE.md/rules load only when Claude reads a file in that subdir, not at launch (Ch 3).

**Managed policy CLAUDE.md** — Org-wide file at OS-specific paths; loads before user/project; cannot be user-excluded (Ch 3, 6).

**`/memory` command** — Lists loaded CLAUDE.md/CLAUDE.local.md/rules, toggles auto memory, opens the auto-memory folder (Ch 8).

**`MEMORY.md`** — Concise index of the auto-memory dir; loaded every session up to first 200 lines / 25KB (Ch 7).

**Path-scoped rule** — `.claude/rules/` file with `paths` frontmatter; loads only when Claude reads matching files (Ch 5).

**`paths` frontmatter** — YAML glob list scoping a rule to matching files; brace expansion supported (Ch 5).

**`.claude/rules/`** — Directory of modular topic-specific instruction files, discovered recursively; supports symlinks (Ch 5).

**Scope hierarchy** — Four CLAUDE.md scopes loaded broadest→specific: managed, user, project, local (Ch 3).

**Topic files** — Auto-memory detail files (`debugging.md`, etc.) read on demand, not loaded at startup (Ch 7).

**`--add-dir`** — CLI flag adding working dirs; their CLAUDE.md is *not* loaded unless the additional-dirs env var is set (Ch 3).

**`--append-system-prompt`** — CLI flag injecting instructions at system-prompt level; must be passed every invocation (Ch 8).

**Verifiable instruction** — One concrete enough to check ("Use 2-space indentation"); the key adherence lever (Ch 2).

**Worktree sharing** — All worktrees/subdirs of one git repo share a single auto-memory dir; machine-local (Ch 7).
