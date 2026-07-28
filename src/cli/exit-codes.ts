// Exit code contract (REQ-CLI-004): 0 success, 1 gate failure, 2 operational failure.
// Only `specd verify` may exit 1; every other non-zero exit is operational.
export const EXIT = {
  OK: 0,
  GATE_FAILURE: 1,
  OPERATIONAL_FAILURE: 2,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
