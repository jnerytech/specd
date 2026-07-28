#!/usr/bin/env node
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, type ExitCode } from "./cli/exit-codes.js";
import { registerCommands, USAGE } from "./cli/index.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export interface MainIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
}

export async function main(
  argv: string[],
  io: MainIo = defaultIo(),
): Promise<ExitCode> {
  const [name, ...rest] = argv;
  if (name === undefined || name === "--help" || name === "-h") {
    io.stdout(USAGE);
    return EXIT.OK;
  }
  if (name === "--version" || name === "-v") {
    io.stdout(`specd ${version}\n`);
    return EXIT.OK;
  }

  const command = registerCommands().get(name);
  if (command === undefined) {
    io.stderr(`Unknown command "${name}".\n\n${USAGE}`);
    return EXIT.OPERATIONAL_FAILURE;
  }

  try {
    return await command.run(rest, io);
  } catch (cause) {
    // REQ-CLI-004: only a gate verdict exits 1. Everything that reaches here —
    // bad configuration, unreadable file, unknown flag — is the tool failing to
    // run, not the spec failing, so CI can tell the two apart.
    io.stderr(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    return EXIT.OPERATIONAL_FAILURE;
  }
}

function defaultIo(): MainIo {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
    cwd: process.cwd(),
  };
}

// Only run when invoked as the binary; importing this module from a test must
// not execute a command.
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
