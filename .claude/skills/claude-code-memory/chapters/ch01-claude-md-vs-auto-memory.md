# Chapter 1: CLAUDE.md vs Auto Memory

## Core Idea
Every Claude Code session starts with a fresh context window; two complementary systems carry knowledge across sessions — **CLAUDE.md** (instructions *you* write) and **auto memory** (notes *Claude* writes itself). Both load at the start of every conversation and are treated as **context, not enforced configuration**.

## Frameworks Introduced
- **Two-mechanism memory model**: Persistence across sessions has exactly two paths — author intent (CLAUDE.md) and learned intent (auto memory).
  - When to use: deciding *where* a piece of knowledge belongs.
  - How: Is it a rule a human should own and version-control? → CLAUDE.md. Is it something Claude discovered (a build command, a debugging insight) that should accrue automatically? → auto memory.
- **Context vs enforcement distinction**: Memory shapes behavior but does not guarantee it.
  - When to use: when an instruction *must* happen, not just *should*.
  - How: For guaranteed behavior at a lifecycle point, use a **PreToolUse hook** (or any hook), not CLAUDE.md. Memory is advisory; hooks are deterministic.

## Key Concepts
- **CLAUDE.md**: Markdown instruction files written by you; loaded in full every session.
- **Auto memory**: Markdown notes Claude writes for itself, per repository, shared across worktrees.
- **Context (not config)**: Both systems enter the prompt as content Claude reads and tries to follow — no strict compliance guarantee.
- **Adherence**: Reliability of Claude following an instruction; improves with specificity and conciseness.

## Mental Models
- Think of CLAUDE.md as the **onboarding doc** you'd hand a new teammate; think of auto memory as the **lab notebook** Claude keeps while working.
- Use a **hook** when "should follow" must become "always happens."
- The more **specific and concise** the instruction, the more consistently it is followed — verbosity reduces adherence.

## Reference Tables
| | CLAUDE.md files | Auto memory |
| --- | --- | --- |
| **Who writes it** | You | Claude |
| **What it contains** | Instructions and rules | Learnings and patterns |
| **Scope** | Project, user, or org | Per repository, shared across worktrees |
| **Loaded into** | Every session (full) | Every session (first 200 lines or 25KB of `MEMORY.md`) |
| **Use for** | Coding standards, workflows, project architecture | Build commands, debugging insights, preferences Claude discovers |

## Worked Example
You keep re-typing "always use pnpm, not npm." Two valid homes:
1. Tell Claude *"remember that"* → it lands in **auto memory** (Claude decided it's worth keeping).
2. Tell Claude *"add this to CLAUDE.md"* (or edit the file) → it becomes a versioned, team-shared rule.
If instead the requirement is *"must run `make lint` before every commit"* — neither memory guarantees it. Write a **hook**, because it has to fire at a fixed lifecycle point regardless of what Claude decides.

## Key Takeaways
1. Fresh context every session — persistence comes only from CLAUDE.md + auto memory.
2. You own CLAUDE.md; Claude owns auto memory. Match the writer to the knowledge.
3. Both are loaded every session as context, not enforced config.
4. For guaranteed actions, reach for hooks — not memory.
5. Subagents can keep their own auto memory (see subagent configuration).
6. Specificity + brevity = higher adherence.

## Connects To
- **Ch 2**: How to write CLAUDE.md instructions that actually get followed.
- **Ch 7**: Auto memory mechanics — storage, `MEMORY.md`, load limits.
- **Ch 8**: Troubleshooting when instructions aren't followed.
- **Hooks**: The enforcement layer memory can't provide (`code.claude.com/docs/en/hooks-guide`).
