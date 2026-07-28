import { formatSuggestReport, suggestAnchors } from "../anchors/suggest.js";
import { verify } from "../verify/index.js";
import { formatReport } from "../verify/report.js";
import { EXIT, type ExitCode } from "./exit-codes.js";

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
}

export interface Command {
  name: string;
  summary: string;
  run(argv: string[], io: CliIo): Promise<ExitCode>;
}

const USAGE = `specd — spec-driven development with drift detection

Usage: specd <command> [options]

Commands:
  verify                            Run the gate over this repository
  anchor suggest <capability>       Report anchor candidates for a capability
  help                              Show this message

Options for verify:
  --fast        Skip the project layer
  --json        Emit the full report as JSON on stdout

Options for anchor suggest:
  --json        Emit the report as JSON on stdout

Exit codes: 0 success, 1 gate failure, 2 operational failure.
`;

// REQ-CLI-001: exactly one command returns a non-zero exit code as a quality
// gate, and it is `verify`. Everything else here may only fail operationally.
export function registerCommands(): Map<string, Command> {
  const commands = new Map<string, Command>();
  for (const command of [verifyCommand, anchorCommand, helpCommand]) {
    commands.set(command.name, command);
  }
  return commands;
}

const verifyCommand: Command = {
  name: "verify",
  summary: "Run the gate over this repository",
  async run(argv, io): Promise<ExitCode> {
    const flags = parseFlags(argv, ["--fast", "--json"]);
    const report = await verify({ cwd: io.cwd, fast: flags.has("--fast") });

    // REQ-VER-008: with --json the machine-readable report owns stdout and the
    // human rendering moves to stderr, so a pipe never mixes the two.
    if (flags.has("--json")) {
      io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      io.stderr(`${formatReport(report)}\n`);
    } else {
      io.stdout(`${formatReport(report)}\n`);
    }

    return report.ok ? EXIT.OK : EXIT.GATE_FAILURE;
  },
};

// REQ-CLI-001: `anchor` reads and reports. It returns non-zero only when it
// cannot run — an ambiguous capability name, a missing spec tree — never as a
// quality verdict.
const anchorCommand: Command = {
  name: "anchor",
  summary: "Report anchor candidates for a capability",
  run(argv, io): Promise<ExitCode> {
    const [subcommand, ...rest] = argv;
    if (subcommand !== "suggest") {
      throw new UsageError(
        `Unknown subcommand "${subcommand ?? ""}" for "anchor". Usage: specd anchor suggest <capability> [--json].`,
      );
    }

    const positional = rest.filter((argument) => !argument.startsWith("-"));
    const flags = parseFlags(
      rest.filter((argument) => argument.startsWith("-")),
      ["--json"],
    );
    const capability = positional[0];
    if (capability === undefined || positional.length > 1) {
      throw new UsageError(
        "Usage: specd anchor suggest <capability> [--json] — exactly one capability name.",
      );
    }

    const report = suggestAnchors({ root: io.cwd, capability });
    io.stdout(
      flags.has("--json")
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${formatSuggestReport(report)}\n`,
    );
    return Promise.resolve(EXIT.OK);
  },
};

const helpCommand: Command = {
  name: "help",
  summary: "Show usage",
  run(_argv, io): Promise<ExitCode> {
    io.stdout(USAGE);
    return Promise.resolve(EXIT.OK);
  },
};

export class UsageError extends Error {
  readonly exitCode = EXIT.OPERATIONAL_FAILURE;

  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

function parseFlags(argv: string[], allowed: string[]): Set<string> {
  const flags = new Set<string>();
  for (const argument of argv) {
    if (!allowed.includes(argument)) {
      throw new UsageError(
        `Unknown option "${argument}". Valid options: ${allowed.join(", ")}.`,
      );
    }
    flags.add(argument);
  }
  return flags;
}

export { USAGE };
