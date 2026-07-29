# Chapter 3: CLAUDE.md Locations & Load Order

## Core Idea
CLAUDE.md files live at four scopes (managed → user → project → local). All discovered files are **concatenated** into context (never overriding), ordered broadest-scope-first and filesystem-root-down — so the most specific, closest-to-you instruction is read **last**.

## Frameworks Introduced
- **Four-scope hierarchy**: From broadest to most specific — managed policy, user, project, local.
  - When to use: deciding which audience an instruction should reach.
  - How: org-wide → managed; just you everywhere → user; whole team this project → project; just you this project → local.
- **Concatenate-don't-override rule**: Later-read files don't replace earlier ones; everything stacks.
  - When to use: reasoning about which instruction "wins" on conflict.
  - How: order = root of filesystem down to CWD; within a directory, `CLAUDE.local.md` is appended **after** `CLAUDE.md`. Last read = closest to your launch dir = effectively highest priority on conflict.
- **Walk-up + lazy-down discovery**: Ancestors load at launch; descendants load on demand.
  - How: Claude walks *up* the directory tree from CWD loading every `CLAUDE.md`/`CLAUDE.local.md` in full at launch; files in *subdirectories* load only when Claude reads a file there.

## Key Concepts
- **Managed policy CLAUDE.md**: OS-specific path, deployed by IT/DevOps; cannot be excluded by users.
- **Load order**: Broadest scope first → most specific last (so specific is read last).
- **Lazy loading**: Subdirectory CLAUDE.md included only when Claude touches files in that subdir.
- **`--add-dir`**: Flag adding extra working dirs; their CLAUDE.md is *not* loaded by default.
- **`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`**: Env var that opts those extra dirs' memory in.

## Mental Models
- Read order = **priority order**: think "last word wins" — the instruction nearest your launch directory is read last.
- Ancestors are **eager**, descendants are **lazy**: launching deeper loads more ancestor context; subdir rules wait until relevant.

## Reference Tables
Scope locations, in load order (broadest → most specific):

| Scope | Location | Shared with |
| --- | --- | --- |
| **Managed policy** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md` • Linux/WSL: `/etc/claude-code/CLAUDE.md` • Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | All users in org |
| **User instructions** | `~/.claude/CLAUDE.md` | Just you (all projects) |
| **Project instructions** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team via source control |
| **Local instructions** | `./CLAUDE.local.md` (gitignore it) | Just you (this project) |

## Worked Example
You run Claude in `foo/bar/`. Load sequence at launch:
1. `foo/CLAUDE.md` (ancestor, read first)
2. `foo/CLAUDE.local.md` (appended after the dir's CLAUDE.md)
3. `foo/bar/CLAUDE.md`
4. `foo/bar/CLAUDE.local.md` (read last → highest effective priority)

A `foo/baz/CLAUDE.md` is **not** loaded at launch — only if Claude later reads a file inside `foo/baz/`.

To pull a sibling dir's memory in too:
```shellscript
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir ../shared-config
```
This loads `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`, and `CLAUDE.local.md` from `../shared-config` (the `local` file is skipped if you drop `local` from `--setting-sources`).

## Anti-patterns
- **Assuming a deeper file overrides a shallower one outright**: it doesn't — both stay in context; conflict is resolved by read-order, not deletion. Reconcile contradictions explicitly.
- **Expecting subdir CLAUDE.md at launch**: it loads lazily; don't rely on it for global rules.

## Key Takeaways
1. Four scopes: managed → user → project → local, loaded in that order.
2. Files concatenate; nothing overrides — last read (closest to CWD) wins on conflict.
3. Ancestors load in full at launch; subdir files load lazily when touched.
4. `CLAUDE.local.md` is read after `CLAUDE.md` within the same directory.
5. `--add-dir` does **not** load that dir's memory unless `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.
6. Managed policy lives at OS-specific paths and is user-unexcludable.

## Connects To
- **Ch 6**: Managed CLAUDE.md, `claudeMd` inline setting, and `claudeMdExcludes`.
- **Ch 4**: HTML-comment stripping and imports happen during this load.
- **Ch 8**: "Instructions seem lost after /compact" — what survives reload.
- **Monorepos**: Full root + per-dir layout (`code.claude.com/docs/en/large-codebases`).
