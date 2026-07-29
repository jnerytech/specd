# Chapter 2: Writing Effective CLAUDE.md

## Core Idea
CLAUDE.md is where you write down what you'd otherwise re-explain every session. Because it's loaded as context (not enforced config) and consumes tokens, *how* you write it — specific, concise, well-structured — directly affects how reliably Claude follows it.

## Frameworks Introduced
- **The "would I re-explain this?" test**: Decides what earns a place in CLAUDE.md.
  - When to use: every time you consider adding an entry.
  - How (add when any holds):
    1. Claude makes the same mistake a **second** time.
    2. A code review catches something Claude should have known about this codebase.
    3. You type the same correction/clarification you typed last session.
    4. A new teammate would need the same context to be productive.
- **Right-mechanism routing**: Not everything belongs in CLAUDE.md.
  - When to use: an entry is a multi-step procedure or only matters for part of the codebase.
  - How: Multi-step procedure → **skill**. Scoped to certain files/dirs → **path-scoped rule** (`.claude/rules/`). Always-true global fact → CLAUDE.md.
- **Specific-Concise-Structured (SCS)**: The three levers of adherence.
  - How: make instructions verifiable, short, and grouped under markdown headers/bullets.

## Key Concepts
- **Adherence**: How reliably Claude follows an instruction; rises with specificity and falls with length/conflict.
- **Verifiable instruction**: One concrete enough that you could check whether it was followed.
- **200-line target**: Soft size limit per CLAUDE.md file; longer files consume more context and reduce adherence.
- **Conflicting instructions**: Two rules that contradict — Claude may pick one arbitrarily.

## Mental Models
- Write **"Use 2-space indentation"**, not "format code properly." Concrete beats aspirational.
- Treat CLAUDE.md like code: **review periodically**, delete outdated/contradicting lines.
- Claude **scans structure the way readers do** — headers and bullets beat dense paragraphs.
- Size is a budget: every line competes with your actual conversation for context.

## Anti-patterns
- **Vague rules** ("test your changes", "keep files organized"): unverifiable → ignored.
- **Contradictory rules across files**: arbitrary resolution; audit and reconcile.
- **Dumping multi-step procedures into CLAUDE.md**: bloats context; move to a skill.
- **Letting the file grow unbounded**: over ~200 lines, adherence drops — split with path-scoped rules.

## Reference Tables
| Vague (avoid) | Specific (use) |
| --- | --- |
| "Format code properly" | "Use 2-space indentation" |
| "Test your changes" | "Run `npm test` before committing" |
| "Keep files organized" | "API handlers live in `src/api/handlers/`" |

## Worked Example
A growing project CLAUDE.md crosses 300 lines and Claude starts ignoring the back half. Fix:
1. **Trim** anything not needed in *every* session.
2. **Move** the React-only conventions into a path-scoped rule:
   ```markdown
   ---
   paths:
     - "src/components/**/*.tsx"
   ---
   # Component conventions
   - One component per file
   - Co-locate the test as `*.test.tsx`
   ```
   Now those lines load only when Claude touches a matching file — context spent on relevance, not bulk.
3. Keep the root CLAUDE.md to global always-true facts (build/test commands, layout, "always do X").

## Key Takeaways
1. Add to CLAUDE.md what you'd otherwise re-explain — same mistake twice is the trigger.
2. Multi-step → skill; file-scoped → path rule; global always-true → CLAUDE.md.
3. Specificity is the #1 adherence lever: make every rule verifiable.
4. Structure with headers/bullets; Claude scans like a reader.
5. Target under 200 lines; longer = more context, less adherence.
6. Audit for conflicts — contradictions get resolved arbitrarily.

## Connects To
- **Ch 3**: Where to physically place CLAUDE.md and how scopes load.
- **Ch 5**: Path-scoped rules (`.claude/rules/`) — the splitting tool referenced here.
- **Ch 8**: "My CLAUDE.md is too large" / "Claude isn't following it" troubleshooting.
- **Skills**: For repeatable multi-step workflows (`code.claude.com/docs/en/skills`).
