import { EXIT } from "../cli/exit-codes.js";

// REQ-CLI-003 — Never guess on conflict.
//
// P4: an ambiguous or conflicting state exits non-zero with the conflict spelled
// out. It is never resolved automatically — a tool that picks for you is a tool
// whose green result means nothing.
//
// Exit code 2, not 1: a conflict is specd being unable to proceed, not the spec
// failing a check. Only `verify` returns 1 (REQ-CLI-001, REQ-CLI-004).
export class ConflictError extends Error {
  readonly exitCode = EXIT.OPERATIONAL_FAILURE;
  readonly conflicts: readonly string[];

  constructor(summary: string, conflicts: readonly string[]) {
    super(
      `${summary}\n${conflicts.map((item) => `  - ${item}`).join("\n")}\n` +
        `specd does not choose between these; resolve the conflict and run again.`,
    );
    this.name = "ConflictError";
    this.conflicts = [...conflicts];
  }
}
