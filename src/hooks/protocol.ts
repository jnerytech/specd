// REQ-HOOK-005 — The host's hook protocol, deliberately not specd's.
//
// The two exit-code contracts collide inverted:
//
//   value | specd                    | host hook
//   ------+--------------------------+---------------------------------------
//     0   | success                  | success
//     1   | the gate failed          | non-blocking error, shown to the user
//     2   | specd could not run      | blocks, and stderr goes back to the agent
//
// Wiring `specd verify` straight into settings.json therefore produces the worst
// possible pairing: a broken anchor does not stop the agent, and a broken specd
// does. `specd hooks run` exists so the boundary between the two contracts has
// one place to live, and this module is that place.
//
// Nothing here imports `src/cli/exit-codes.ts`. The numbers happen to overlap;
// the meanings do not, and an adapter that reads one as the other would be
// right by coincidence.
export const HOOK_EXIT = {
  // The agent may proceed.
  ALLOW: 0,
  // The host stops the agent and feeds stderr back to it as the reason.
  BLOCK: 2,
} as const;

export type HookExitCode = (typeof HOOK_EXIT)[keyof typeof HOOK_EXIT];

// The events specd installs into. `stop` is the one that makes the gate
// obligatory; `post-tool-use` is the one that makes it immediate.
export const HOOK_EVENTS = ["stop", "post-tool-use"] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

// Event name as the host writes it in settings.json.
export const HOST_EVENT_NAME: Readonly<Record<HookEvent, string>> = {
  stop: "Stop",
  "post-tool-use": "PostToolUse",
};

export function isHookEvent(value: string): value is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(value);
}

// The JSON the host reads on stdout. It enriches the message; it never decides.
//
// A hook that exits 0 and relies on this payload to block fails open the moment
// the host ignores it or changes its shape — which is absence-is-not-compliance exactly, and which is
// why the exit code carries the decision instead.
export interface HookPayload {
  decision?: "block";
  reason?: string;
}

export interface HookOutcome {
  exitCode: HookExitCode;
  // Goes to stderr: the channel the host hands back to the agent when blocking.
  message: string;
  payload: HookPayload;
}

export function allow(message: string): HookOutcome {
  return { exitCode: HOOK_EXIT.ALLOW, message, payload: {} };
}

export function block(reason: string): HookOutcome {
  return {
    exitCode: HOOK_EXIT.BLOCK,
    message: reason,
    payload: { decision: "block", reason },
  };
}
