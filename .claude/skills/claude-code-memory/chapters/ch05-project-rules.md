# Chapter 5: Organize Rules with .claude/rules/

## Core Idea
For larger projects, split instructions into modular topic files under `.claude/rules/`. Rules without frontmatter load every session (same priority as `.claude/CLAUDE.md`); rules with a `paths` field are **path-scoped** — they load only when Claude works with matching files, saving context.

## Frameworks Introduced
- **Modular rules directory**: One topic per file under `.claude/rules/`.
  - When to use: CLAUDE.md is growing; teams need to maintain instructions independently.
  - How: place `.md` files (e.g. `testing.md`, `api-design.md`); discovered recursively, so `frontend/`, `backend/` subdirs work.
- **Path-scoped rule**: YAML `paths` frontmatter limits when a rule loads.
  - When to use: instructions relevant only to certain file types/dirs.
  - How: add `paths:` glob list in frontmatter; rule triggers when Claude **reads** a matching file, not on every tool use. No `paths` field → loads unconditionally for all files.
- **Rules vs skills boundary**: Both hold modular instructions; load timing differs.
  - How: Rules load every session (or on matching file). For task-specific instructions not needed in context all the time, use a **skill** (loads only on invoke / relevance).

## Key Concepts
- **`.claude/rules/`**: Directory of topic-specific markdown rule files, discovered recursively.
- **`paths` frontmatter**: Glob list scoping a rule to matching files.
- **Unconditional rule**: No `paths` field → loaded at launch, priority equal to `.claude/CLAUDE.md`.
- **User-level rules**: `~/.claude/rules/` — apply to every project; loaded *before* project rules (so project rules win on conflict).
- **Symlinked rules**: `.claude/rules/` resolves symlinks (dirs or files); circular symlinks detected and handled.

## Mental Models
- Use **rules** for "always-on or file-triggered context"; use **skills** for "load only when invoked."
- Path-scoped rules = **context on demand**: noise stays out until a matching file is touched.
- User rules are the **floor**, project rules the **override** — user loads first, project loads later (higher priority).

## Reference Tables
Glob patterns for the `paths` field:

| Pattern | Matches |
| --- | --- |
| `**/*.ts` | All TypeScript files, any directory |
| `src/**/*` | All files under `src/` |
| `*.md` | Markdown files in project root |
| `src/components/*.tsx` | React components in a specific dir |

Brace expansion matches multiple extensions in one pattern: `src/**/*.{ts,tsx}`.

## Worked Example
Project layout splitting CLAUDE.md into rules:
```text
your-project/
├── .claude/
│   ├── CLAUDE.md           # Main project instructions
│   └── rules/
│       ├── code-style.md   # Code style guidelines
│       ├── testing.md      # Testing conventions
│       └── security.md     # Security requirements
```

A path-scoped API rule, loaded only when Claude reads matching TS files:
```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
- Include OpenAPI documentation comments
```

Multiple patterns + brace expansion:
```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
  - "lib/**/*.ts"
  - "tests/**/*.test.ts"
---
```

Share rules across projects via symlinks:
```shellscript
ln -s ~/shared-claude-rules .claude/rules/shared
ln -s ~/company-standards/security.md .claude/rules/security.md
```

## Anti-patterns
- **Putting task-only, rarely-needed instructions in rules**: they consume context every session — use a skill instead.
- **Forgetting `paths` on file-specific guidance**: a no-`paths` rule loads unconditionally, adding noise everywhere.

## Key Takeaways
1. `.claude/rules/` = modular, recursively-discovered topic files; one topic per file.
2. No `paths` → loads every session at `.claude/CLAUDE.md` priority.
3. `paths` frontmatter scopes a rule to matching files; triggers on read, not every tool use.
4. Use glob patterns + brace expansion to target file sets precisely.
5. `~/.claude/rules/` apply machine-wide, load before (lower priority than) project rules.
6. Symlinks (dirs and files) are supported; circular ones handled gracefully.

## Connects To
- **Ch 2**: Path-scoped rules are the prescribed tool for splitting a too-large CLAUDE.md.
- **Ch 3**: Unconditional rules share `.claude/CLAUDE.md` load priority.
- **Ch 8**: "My CLAUDE.md is too large" points back here.
- **Skills**: The on-demand alternative (`code.claude.com/docs/en/skills`).
