# Cheatsheet — Claude Code Memory

## Where does this knowledge belong? (decision rules)
- **Same mistake twice / re-typed correction / new-teammate context** → CLAUDE.md.
- **Multi-step procedure** → skill (not CLAUDE.md).
- **Only matters for some files/dirs** → path-scoped rule (`.claude/rules/` with `paths`).
- **Global always-true fact (build/test cmd, layout, "always X")** → root CLAUDE.md.
- **Claude discovered it; should accrue automatically** → auto memory (just say "remember…").
- **MUST happen at a lifecycle point** → hook (memory can't guarantee).
- **System-prompt level** → `--append-system-prompt` (every invocation).

## Which file at which scope? (load order: top loads first, bottom wins on conflict)
| Scope | Path | Shared with |
|---|---|---|
| Managed | OS path / `claudeMd` in managed-settings.json | whole org (unexcludable) |
| User | `~/.claude/CLAUDE.md` | you, all projects |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | team (VCS) |
| Local | `./CLAUDE.local.md` (gitignore) | you, this project |

## Settings vs CLAUDE.md (enforce vs guide)
- Block tools/commands/paths → `permissions.deny` (setting).
- Sandbox isolation → `sandbox.enabled` (setting).
- Env / API routing → `env` (setting).
- Auth/org lock → `forceLoginMethod`, `forceLoginOrgUUID` (setting).
- Code style, compliance reminders, behavior → managed **CLAUDE.md**.
- Rule of thumb: **must-block = setting; please-behave = CLAUDE.md.**

## Adherence levers (why it's followed)
- Specific & verifiable: "Use 2-space indentation" > "format properly".
- Concise: target **<200 lines**/file; longer = less adherence.
- Structured: markdown headers/bullets, not dense prose.
- No conflicts: contradictions resolved arbitrarily — audit periodically.

## Thresholds & defaults
- CLAUDE.md size target: **<200 lines**.
- `MEMORY.md` startup load: first **200 lines or 25KB** (whichever first); CLAUDE.md loads **in full** regardless.
- Import recursion: **≤4 hops**.
- Auto memory: **on by default**; needs **v2.1.59+**.

## Import & escape (Ch 4)
- `@path` imports at launch (relative = to importing file). Imports **organize, don't save context**.
- `` `@README` `` (backticks) = literal mention, no import. Code blocks/spans skipped.
- `<!-- comment -->` stripped before injection (kept in code blocks / direct Read).

## Path-rule globs (Ch 5)
| Pattern | Matches |
|---|---|
| `**/*.ts` | all .ts anywhere |
| `src/**/*` | everything under src/ |
| `*.md` | root markdown |
| `src/**/*.{ts,tsx}` | brace expansion, multi-ext |

## Auto memory commands (Ch 7)
- Disable (project): `{ "autoMemoryEnabled": false }` · Env: `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
- Relocate: `{ "autoMemoryDirectory": "~/dir" }` (abs or `~/`; project scope needs workspace trust).
- Store: `~/.claude/projects/<project>/memory/` — per repo, all worktrees, machine-local.
- Audit: `/memory` → open auto-memory folder.

## Troubleshooting tells (Ch 8)
- **Ignored?** `/memory` → is it listed? (not listed = not loaded) → make specific → remove conflicts.
- **Too large?** path-scoped rules / trim (imports don't help).
- **Lost after `/compact`?** root CLAUDE.md survives (re-read from disk); nested reloads lazily; conversation-only = gone → put in CLAUDE.md.
- **Debug what loads:** `InstructionsLoaded` hook (logs file, time, reason).
- **`--add-dir` memory not loading?** set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.

## Monorepo noise filter
- `claudeMdExcludes: ["**/monorepo/CLAUDE.md", ".../other-team/.claude/rules/**"]` (absolute-path globs, merge across layers). Managed policy CLAUDE.md **cannot** be excluded.
