import { verify } from "../verify/index.js";
import { countBySeverity, formatReport } from "../verify/report.js";
import {
  allow,
  block,
  HOST_EVENT_NAME,
  type HookEvent,
  type HookOutcome,
} from "./protocol.js";

export interface RunHookOptions {
  cwd: string;
  // Written explicitly into settings.json by `hooks install`, so what the file
  // says is what runs. There is no hidden default here on purpose.
  fast: boolean;
}

// REQ-HOOK-005 / REQ-HOOK-006 — the adapter.
//
// Three outcomes, and only the first allows:
//
//   verified and clean      -> ALLOW
//   verified and failed     -> BLOCK, with the report as the reason
//   could not verify at all -> BLOCK, with the reason named
//
// P8: the third is never green. A hook that allows when it breaks is
// indistinguishable from a hook nobody installed, and silence is the failure
// mode nobody investigates.
export async function runHook(
  event: HookEvent,
  options: RunHookOptions,
): Promise<HookOutcome> {
  const where = HOST_EVENT_NAME[event];

  let report;
  try {
    report = await verify({ cwd: options.cwd, fast: options.fast });
  } catch (cause) {
    // Any `exitCode` this error carries is specd's, and it is discarded here on
    // purpose. `OperationalError` means "specd refused to act"; BLOCK means "the
    // host must stop the agent". They are the same number for unrelated
    // reasons, and letting one travel as the other would be right by accident.
    return block(
      `specd could not run the gate (${where} hook): ${describe(cause)}\n` +
        "This is not an approval — nothing was checked. Fix the tool or the " +
        "project configuration, or remove the hook with `specd hooks uninstall`.",
    );
  }

  const { errors, warnings } = countBySeverity(report.violations);
  const tally = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;

  if (report.ok) {
    return allow(`specd verify passed (${where} hook, ${tally}).`);
  }

  return block(
    `specd verify failed (${where} hook). The spec and the code disagree.\n\n` +
      `${formatReport(report)}\n\n` +
      "Resolve this before finishing: move the code back, update the anchor " +
      "with `specd anchor fix <requirement>`, or correct the spec.",
  );
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
