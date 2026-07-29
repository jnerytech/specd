import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OperationalError } from "../../core/operational.js";
import { error, warning, type Diagnostic } from "../../parser/diagnostics.js";
import type { Task } from "../../parser/task.js";
import { resultFrom, type VerifyLayer } from "./types.js";

// REQ-VER-005, REQ-VER-010, REQ-VER-011 — the evidence layer.
//
// Three requirements and not one, because the three outcomes are three
// behaviours and a single statement claiming all of them would pass the
// SHALL-clause count while lying about what it checks.
export const evidenceLayer: VerifyLayer = {
  name: "evidence",
  run(ctx) {
    const violations: Diagnostic[] = [];
    const tasks = ctx.effective.changes.flatMap((change) => change.tasks);

    for (const task of tasks) {
      const finding = assertEvidenceDeclared(task);
      if (finding) violations.push(finding);
    }

    // REQ-VER-011: the history is only consulted when there is something to
    // check against it, so a repository with no completed work verifies
    // without git at all.
    const claimed = tasks.filter((task) => task.evidence.commits.length > 0);
    if (claimed.length > 0) {
      requireGitHistory(ctx.root);
      for (const task of claimed) {
        violations.push(...assertCommitsReachable(task, ctx.root));
      }
    }

    return Promise.resolve(resultFrom(violations));
  },
};

// REQ-VER-005 — a completion claim with no support at all.
//
// This is the anti-fraud check and the only one of the three that fails the
// gate: `done` with an empty `evidence.commits` is a claim that work happened
// with nothing behind it, and no merge workflow can produce that by accident.
export function assertEvidenceDeclared(task: Task): Diagnostic | undefined {
  if (task.status !== "done") return undefined;
  if (task.evidence.commits.length > 0) return undefined;
  return error({
    file: task.file,
    line: 1,
    message:
      `Task ${task.id} is marked done with an empty \`evidence.commits\`. ` +
      `A task claiming completion names at least one commit.`,
  });
}

// REQ-VER-010 — a SHA the history no longer reaches.
//
// A warning, not a failure. Anchors prove code exists now; evidence proves work
// happened then — different axes, anchor-necessary-not-sufficient. A rewritten history is the project's
// merge workflow, not fraud: squash and rebase both destroy the recorded SHA,
// and a shallow clone never had it. Failing here would make the gate unusable
// for anyone who squashes, and the property worth protecting — a claim with no
// support at all — is REQ-VER-005's job.
export function assertCommitsReachable(task: Task, root: string): Diagnostic[] {
  const findings: Diagnostic[] = [];
  for (const sha of task.evidence.commits) {
    if (commitExists(sha, root)) continue;
    findings.push(
      warning({
        file: task.file,
        line: 1,
        message:
          `Task ${task.id} lists commit ${sha}, which this repository's history does not reach. ` +
          `Squash, rebase or a shallow clone all produce this; the record is degraded, not false.`,
      }),
    );
  }
  return findings;
}

// REQ-VER-011 — no history means no verdict.
//
// Throws rather than reporting, because the outcome is exit 2 and not a
// violation: "I could not check" must never render as "I checked and it
// failed" (REQ-CLI-004).
export function requireGitHistory(root: string): void {
  if (existsSync(join(root, ".git"))) return;
  const inside = spawnSync("git", ["rev-parse", "--git-dir"], {
    cwd: root,
    shell: false,
    encoding: "utf8",
  });
  if (inside.status === 0) return;
  throw new OperationalError(
    `The evidence layer needs the repository history and none is available at ${root}. ` +
      `This is not a gate failure: specd could not check, rather than checking and finding a problem. ` +
      `Run inside a git working tree, or disable the evidence layer in verify.levels.`,
  );
}

function commitExists(sha: string, root: string): boolean {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
    cwd: root,
    shell: false,
    encoding: "utf8",
  });
  return result.status === 0;
}
