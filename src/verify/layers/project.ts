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

    return {
      status: "failed",
      violations: [
        error({
          file: ".specd/config.toml",
          line: 1,
          message: `verify.validation_command exited with code ${outcome.exitCode}: ${command.join(" ")}`,
        }),
      ],
      command,
      exitCode: outcome.exitCode,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
    };
  },
};

interface CommandOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
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
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        // A command killed by a signal did not pass; report it as a failure
        // rather than as the 0 that `code === null` would suggest.
        exitCode: code ?? (signal === null ? 1 : 128),
        stdout,
        stderr,
      });
    });
  });
}
