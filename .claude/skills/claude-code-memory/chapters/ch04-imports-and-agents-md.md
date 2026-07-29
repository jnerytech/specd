# Chapter 4: Imports, CLAUDE.local.md & AGENTS.md

## Core Idea
CLAUDE.md can pull in other files with `@path` import syntax (expanded into context at launch, recursive up to 4 hops). Imports are also how Claude Code interoperates with `AGENTS.md` and shares personal instructions across worktrees — Claude reads `CLAUDE.md`, never `AGENTS.md` directly.

## Frameworks Introduced
- **`@path` import**: Inline another file's content into context at launch.
  - When to use: organizing instructions, reusing a README/package.json/workflow guide, or bridging to `AGENTS.md`.
  - How: write `@path/to/file` anywhere outside backticks/code. Relative paths resolve relative to the *importing file*, not CWD. Recurses up to **4 hops** deep.
- **AGENTS.md bridge**: Make one instruction source serve multiple agents.
  - When to use: repo already has `AGENTS.md` for other coding tools.
  - How: create `CLAUDE.md` that does `@AGENTS.md`, then append Claude-specific instructions below. Or `ln -s AGENTS.md CLAUDE.md` if no Claude-specific content needed.
- **Cross-worktree personal instructions**: Share private prefs without committing.
  - How: a gitignored `CLAUDE.local.md` exists only in the worktree that created it. To share across worktrees, import from home: `@~/.claude/my-project-instructions.md`.

## Key Concepts
- **`@path` syntax**: Import directive; both relative and absolute paths allowed.
- **Import depth limit**: Max 4 recursive hops.
- **Backtick escape**: `` `@README` `` stays literal text; `@README` outside backticks imports. Parsing skips code spans and fenced code blocks.
- **CLAUDE.local.md**: Private per-project file at project root; gitignore it. Loads alongside `CLAUDE.md`, treated identically.
- **External-import approval**: First time a project has external imports, Claude shows a one-time approval dialog; declining disables them permanently (dialog won't reappear).
- **HTML comment stripping**: Block-level `<!-- ... -->` comments are stripped before injection (except inside code blocks, and except when reading the file directly with the Read tool).

## Mental Models
- Imports are **organization, not savings**: imported files still load at launch and consume context — splitting helps readability, not token count.
- Want a path *mentioned* but not *imported*? Wrap it in backticks.
- `AGENTS.md` interop = **single source of truth** for multiple agents via a thin `CLAUDE.md` shim.

## Worked Example
Bridge to an existing `AGENTS.md` while adding Claude-only guidance:
```markdown
@AGENTS.md

## Claude Code

Use plan mode for changes under `src/billing/`.
```
Claude loads the imported `AGENTS.md` at session start, then appends the rest.

Pull in project files for context:
```text
See @README for project overview and @package.json for available npm commands for this project.

# Additional Instructions
- git workflow @docs/git-instructions.md
```

Share personal instructions across all worktrees of a repo (gitignored local files don't propagate):
```text
# Individual Preferences
- @~/.claude/my-project-instructions.md
```

## Anti-patterns
- **Expecting imports to shrink context**: they don't — imported content loads in full at launch.
- **Relying on gitignored `CLAUDE.local.md` across worktrees**: it lives only where created; import from `~/` instead.
- **Symlinking `AGENTS.md`→`CLAUDE.md` on Windows**: symlinks need Admin/Developer Mode; use `@AGENTS.md` import instead.

## Key Takeaways
1. `@path` imports load at launch, recurse ≤4 hops, resolve relative to the importing file.
2. Backtick-wrap a path to mention it without importing; code blocks/spans are skipped by the parser.
3. Imports organize, they don't reduce context.
4. Claude reads `CLAUDE.md` only — bridge `AGENTS.md` via `@AGENTS.md` import or symlink.
5. `CLAUDE.local.md` = private, gitignored, project-root; share across worktrees via a `~/` import.
6. External imports get a one-time approval dialog; HTML comments are stripped before injection.

## Connects To
- **Ch 3**: Imports expand during the launch-time load described there.
- **Ch 6**: `/init` reading `AGENTS.md`, `.cursorrules`, `.devin/rules/`, `.windsurfrules`.
- **Ch 5**: `.claude/rules/` as the more structured alternative to imports.
- **Ch 8**: HTML-comment stripping detail when debugging what's actually in context.
