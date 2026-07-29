import { spawn } from "node:child_process";
import { error } from "../../parser/diagnostics.js";
import type { LayerResult, VerifyLayer } from "./types.js";

// REQ-VER-006 — Project layer delegates by argv.
//
// The command is an argv array executed without a shell: no quoting rules, no
// interpolation, no `rm -rf $EMPTY_VAR`. Its exit code decides the layer, and
// its output is carried into the report so a CI log shows why.
export const projectLayer: VerifyLayer = {
  name: "project",
  async run(ctx): Promise<LayerResult> {
    const command = ctx.config.verify.validation_command;
    if (command === undefined || command.length === 0) {
      return {
        status: "skipped",
        violations: [],
      };
    }

    // REQ-VER-007: --fast reports the layer as skipped, never as passed.
    if (ctx.fast) {
      return { status: "skipped", violations: [], command };
    }

    const outcome = await run(command, ctx.root);
    if (outcome.exitCode === 0) {
      return {
        status: "passed",
        violations: [],
        command,
        exitCode: outcome.exitCode,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
      };
    }

    const kind = classifyCommandFailure(outcome);
    return {
      status: kind === "unrunnable" ? "blocked" : "failed",
      violations: [
        error({
          file: ".specd/config.toml",
          line: 1,
          message:
            kind === "unrunnable"
              ? `verify.validation_command could not be executed: ${command.join(" ")}\n` +
                `${outcome.stderr.trim()}\n` +
                `This is the tool failing to run, not the spec failing a check, so verify exits 2.\n` +
                `Install the executable, change verify.validation_command, or drop "project" from verify.levels.`
              : `verify.validation_command exited with code ${outcome.exitCode}: ${command.join(" ")}`,
        }),
      ],
      command,
      exitCode: outcome.exitCode,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
    };
  },
};

// REQ-VER-013 — telling "could not run" from "ran and disapproved".
//
// `dotnet` not installed used to fail the gate as if the spec were wrong, and
// the README sells exactly the distinction that breaks: CI has to separate
// "the spec disapproved" from "the tool broke". A missing executable is the
// second one, and `init` proposes the command by itself, so nobody even chose
// to run `dotnet test`.
//
// It is absence-is-not-compliance one storey up. Not green where it should be red — red of the wrong
// kind, which whoever trusts the distinction acts on with the usual confidence.
export type CommandFailureKind = "unrunnable" | "verdict";

export function classifyCommandFailure(
  outcome: Pick<CommandOutcome, "spawnFailed">,
): CommandFailureKind {
  return outcome.spawnFailed ? "unrunnable" : "verdict";
}

interface CommandOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
  // The process never started: missing executable, permission denied. Distinct
  // from a process that started and returned non-zero (REQ-VER-013).
  spawnFailed: boolean;
}

function run(command: string[], cwd: string): Promise<CommandOutcome> {
  const [executable, ...args] = command;
  return new Promise((resolve) => {
    const child = spawn(executable as string, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (cause) => {
      resolve({
        exitCode: 127,
        stdout,
        stderr: `${stderr}${cause.message}\n`,
        spawnFailed: true,
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        // A command killed by a signal did not pass; report it as a failure
        // rather than as the 0 that `code === null` would suggest.
        exitCode: code ?? (signal === null ? 1 : 128),
        stdout,
        stderr,
        spawnFailed: false,
      });
    });
  });
}
