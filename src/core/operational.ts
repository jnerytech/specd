import { EXIT } from "../cli/exit-codes.js";

// Something specd needed was unavailable — a missing git history, an
// uninitialised project, an unreadable file.
//
// Exit code 2, never 1: "I could not check" is not "I checked and it failed".
// A gate that reports the first as the second teaches people that red means
// nothing in particular (REQ-CLI-004).
export class OperationalError extends Error {
  readonly exitCode = EXIT.OPERATIONAL_FAILURE;

  constructor(message: string) {
    super(message);
    this.name = "OperationalError";
  }
}
