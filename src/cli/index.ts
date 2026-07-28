import { formatSuggestReport, suggestAnchors } from "../anchors/suggest.js";
import { explore } from "../explore/index.js";
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
  explore <card> --change <name>    Collect the configured sources into a bundle
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
  for (const command of [
    verifyCommand,
    exploreCommand,
    anchorCommand,
    helpCommand,
  ]) {
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

// REQ-CLI-001: `explore` reaches the network and may fail, but only ever
// operationally — a failed required source is exit 2, not a gate verdict.
const exploreCommand: Command = {
  name: "explore",
  summary: "Collect the configured sources into a bundle",
  async run(argv, io): Promise<ExitCode> {
    const { positional, options } = parseArguments(
      argv,
      ["--change"],
      ["--json"],
    );
    const card = positional[0];
    if (card === undefined || positional.length > 1) {
      throw new UsageError(
        "Usage: specd explore <card> --change <name> — exactly one card identifier or URL.",
      );
    }
    const change = options.get("--change");
    if (change === undefined) {
      throw new UsageError(
        "Usage: specd explore <card> --change <name> — --change names the change directory the bundle belongs to.",
      );
    }

    const result = await explore({ card, change, cwd: io.cwd });
    io.stdout(
      options.has("--json")
        ? `${JSON.stringify(result.manifest, null, 2)}\n`
        : `${formatManifest(result)}\n`,
    );
    return EXIT.OK;
  },
};

function formatManifest(result: Awaited<ReturnType<typeof explore>>): string {
  const lines = [
    `Bundle written to ${result.bundlePath}`,
    `card ${result.manifest.card.id}${result.manifest.card.provider ? ` (${result.manifest.card.provider})` : ""}`,
  ];
  for (const source of result.manifest.sources) {
    const flag = source.required ? "required" : "optional";
    const detail = source.error ? ` — ${source.error}` : "";
    lines.push(
      `  ${source.status.padEnd(7)} ${source.name} [${flag}]${detail}`,
    );
  }
  lines.push(result.manifest.usable ? "bundle: usable" : "bundle: not usable");
  return lines.join("\n");
}

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

export interface ParsedArguments {
  positional: string[];
  // Boolean flags are present with no value; `--name value` options carry one.
  options: Map<string, string> & { has(name: string): boolean };
}

// Minimal argv parser: positionals, `--name value` options, boolean flags.
// Anything not declared is a usage error rather than a silently ignored word.
function parseArguments(
  argv: string[],
  valued: string[],
  flags: string[],
): ParsedArguments {
  const options = new Map<string, string>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i] as string;
    if (!argument.startsWith("-")) {
      positional.push(argument);
      continue;
    }
    if (flags.includes(argument)) {
      options.set(argument, "");
      continue;
    }
    if (valued.includes(argument)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith("-")) {
        throw new UsageError(`Option "${argument}" needs a value.`);
      }
      options.set(argument, value);
      continue;
    }
    throw new UsageError(
      `Unknown option "${argument}". Valid options: ${[...valued, ...flags].join(", ")}.`,
    );
  }

  return { positional, options: options as ParsedArguments["options"] };
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
