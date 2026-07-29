import { error, type Diagnostic } from "../../parser/diagnostics.js";
import { resultFrom, type VerifyLayer } from "./types.js";

// REQ-VER-004 — Coverage layer.
//
// Every requirement a change declares under ADDED or MODIFIED must be claimed
// by a task of that change. A delta entry nobody planned to build is a promise
// with no owner, and it is how `2026-07-28-verify-gate-and-anchor-ladder` came to claim requirements it
// never delivered.
//
// Four decisions the requirement's acceptance criteria pin down, because each
// could reasonably have gone the other way:
//
// - Reference means the `req` field of the task frontmatter and nothing else.
//   Scanning prose would make an incidental mention count as a plan.
// - Any status counts, `pending` included. Coverage asks whether the work is
//   planned, not whether it is finished; that is the evidence layer's question.
// - Only tasks of the same change count. A task elsewhere may reference the
//   identifier for context without owning it.
// - REMOVED needs no task. Deleting a section is what `archive` does, not work
//   somebody schedules.
//
// Nothing else is checked here. A task claiming an identifier its change does
// not declare is a real smell, but no acceptance criterion asks for it, and a
// gate that enforces more than the spec says is as unaccountable as one that
// enforces less.
export const coverageLayer: VerifyLayer = {
  name: "coverage",
  run(ctx) {
    const violations: Diagnostic[] = [];

    for (const change of ctx.effective.changes) {
      if (change.delta === undefined) continue;
      const claimed = new Set(change.tasks.flatMap((task) => task.req));

      for (const entry of [...change.delta.added, ...change.delta.modified]) {
        if (claimed.has(entry.requirement.id)) continue;
        violations.push(
          error({
            file: change.delta.file,
            line: entry.requirement.line,
            requirementId: entry.requirement.id,
            message:
              `Requirement ${entry.requirement.id} is declared under ${entry.section} by ${change.name} ` +
              `but no task of that change references it. Add it to the \`req\` list of the task that ` +
              `implements it, or drop it from the delta.`,
          }),
        );
      }
    }

    return Promise.resolve(resultFrom(violations));
  },
};
