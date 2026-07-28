import { EXIT } from "../cli/exit-codes.js";

// Invalid configuration is an operational failure (exit 2), never a gate
// failure (exit 1) — REQ-CLI-004.
export class ConfigError extends Error {
  readonly exitCode = EXIT.OPERATIONAL_FAILURE;

  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
