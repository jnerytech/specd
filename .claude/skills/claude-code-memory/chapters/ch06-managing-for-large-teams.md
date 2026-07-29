# Chapter 6: Manage CLAUDE.md for Large Teams

## Core Idea
Organizations can centralize instructions and control which CLAUDE.md files load. Deploy an org-wide managed CLAUDE.md (or inline it via the `claudeMd` setting); skip irrelevant ancestor files with `claudeMdExcludes`. Key boundary: **managed settings enforce technically; CLAUDE.md guides behaviorally.**

## Frameworks Introduced
- **Managed (org-wide) CLAUDE.md**: One file applying to every session on a machine, in every repo.
  - When to use: company coding standards, compliance reminders, security policy.
  - How: deploy at the OS-managed path (Ch 3), or put content directly in `managed-settings.json` via the `claudeMd` key. Loads before user and project CLAUDE.md; **cannot be excluded** by users.
- **`claudeMdExcludes`**: Skip specific ancestor CLAUDE.md files by path/glob.
  - When to use: monorepos where other teams' ancestor files leak irrelevant instructions.
  - How: glob list matched against **absolute paths**; configurable at any settings layer (arrays merge across layers). Put in `.claude/settings.local.json` to keep it machine-local.
- **Settings-vs-CLAUDE.md routing**: Pick the right enforcement mechanism.
  - How: Need a hard block / technical enforcement → **managed settings**. Need behavioral guidance → **managed CLAUDE.md**. Settings are enforced by the client regardless of Claude's decision; CLAUDE.md shapes but doesn't guarantee.

## Key Concepts
- **`claudeMd` key**: Inline managed CLAUDE.md content inside `managed-settings.json` (honored in managed/policy settings only — no effect in user/project/local).
- **`claudeMdExcludes`**: Array of glob patterns (absolute-path-matched) of CLAUDE.md/rules files to skip; merges across settings layers.
- **Managed precedence**: Managed CLAUDE.md loads before user and project; managed policy files are unexcludable.

## Mental Models
- **Settings = enforcement, CLAUDE.md = guidance.** If it must be blocked, it's a setting; if it's "please behave this way," it's CLAUDE.md.
- Org-wide behavior that survives every user's config → managed CLAUDE.md (it's a one-way floor).
- In monorepos, treat `claudeMdExcludes` as a **noise filter** for other teams' ancestor instructions.

## Reference Tables
Settings vs CLAUDE.md — where each concern belongs:

| Concern | Configure in |
| --- | --- |
| Block specific tools/commands/file paths | Managed settings: `permissions.deny` |
| Enforce sandbox isolation | Managed settings: `sandbox.enabled` |
| Env vars & API provider routing | Managed settings: `env` |
| Auth method / org lock | Managed settings: `forceLoginMethod`, `forceLoginOrgUUID` |
| Code style & quality guidelines | Managed CLAUDE.md |
| Data handling / compliance reminders | Managed CLAUDE.md |
| Behavioral instructions for Claude | Managed CLAUDE.md |

## Worked Example
Inline behavioral instructions in a managed settings file (no separate CLAUDE.md to deploy):
```json
{
  "claudeMd": "Always run `make lint` before committing.\nNever push directly to main."
}
```

Exclude a noisy top-level CLAUDE.md and another team's rules dir (keep it local to your machine via `.claude/settings.local.json`):
```json
{
  "claudeMdExcludes": [
    "**/monorepo/CLAUDE.md",
    "/home/user/monorepo/other-team/.claude/rules/**"
  ]
}
```
Patterns match absolute paths. Configure `claudeMdExcludes` at user, project, local, or managed layer — arrays merge. **Managed policy CLAUDE.md cannot be excluded**, so org-wide instructions always apply.

## Anti-patterns
- **Using CLAUDE.md for hard blocks**: it's not enforcement — a determined/confused model can deviate. Use `permissions.deny`.
- **Setting `claudeMd` in user/project/local settings**: only honored in managed/policy settings; no effect elsewhere.
- **Trying to exclude managed policy CLAUDE.md**: impossible by design.

## Key Takeaways
1. Managed CLAUDE.md applies machine-wide, loads before user/project, and can't be user-excluded.
2. `claudeMd` inlines managed content into `managed-settings.json` — managed/policy scope only.
3. `claudeMdExcludes` skips ancestor files by absolute-path glob; merges across layers.
4. Settings enforce technically; CLAUDE.md guides behaviorally — route by which you need.
5. For repo-specific guidance, commit a project CLAUDE.md instead of going managed.
6. `/init` reads existing `AGENTS.md`, `.cursorrules`, `.devin/rules/`, `.windsurfrules` when generating.

## Connects To
- **Ch 3**: OS-specific managed policy paths and the four-scope load order.
- **Ch 1**: The context-vs-enforcement distinction underlies settings-vs-CLAUDE.md.
- **Ch 8**: Debugging which files load (`/memory`, `InstructionsLoaded` hook).
- **Settings**: `code.claude.com/docs/en/settings`.
