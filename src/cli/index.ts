import { fixAnchor } from "../anchors/fix.js";
import { formatSuggestReport, suggestAnchors } from "../anchors/suggest.js";
import { archive } from "../archive/index.js";
import { explore } from "../explore/index.js";
import { formatInitResult, init } from "../init/index.js";
import { formatStatus, status } from "../status/index.js";
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
  init                              Scaffold .specd/ and write a complete config
  verify                            Run the gate over this repository
  status                            Report drift and pending work, grouped by change
  explore <card> --change <name>    Collect the configured sources into a bundle
  archive <change>                  Apply a change's delta to the specs and file it away
  anchor suggest <capability>       Report anchor candidates for a capability
  anchor fix <requirement>          Rewrite a dangling anchor to its suggested location
  help                              Show this message

Options for verify:
  --fast        Skip the project layer
  --json        Emit the full report as JSON on stdout

Options for init:
  --force       Overwrite an existing .specd/config.toml

Options for status and anchor suggest:
  --json        Emit the report as JSON on stdout

Exit codes: 0 success, 1 gate failure, 2 operational failure.
`;

// REQ-CLI-001: exactly one command returns a non-zero exit code as a quality
// gate, and it is `verify`. Everything else here may only fail operationally.
export function registerCommands(): Map<string, Command> {
  const commands = new Map<string, Command>();
  for (const command of [
    initCommand,
    verifyCommand,
    statusCommand,
    exploreCommand,
    archiveCommand,
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

const initCommand: Command = {
  name: "init",
  summary: "Scaffold .specd/ and write a complete config",
  run(argv, io): Promise<ExitCode> {
    const flags = parseFlags(argv, ["--force"]);
    const result = init({ cwd: io.cwd, force: flags.has("--force") });
    io.stdout(`${formatInitResult(result)}\n`);
    return Promise.resolve(EXIT.OK);
  },
};

// REQ-CFG-006: status always exits 0. It informs; it does not judge — only
// `verify` is allowed to fail a build (REQ-CLI-001).
const statusCommand: Command = {
  name: "status",
  summary: "Report drift and pending work",
  async run(argv, io): Promise<ExitCode> {
    const flags = parseFlags(argv, ["--json"]);
    const report = await status({ cwd: io.cwd });
    io.stdout(
      flags.has("--json")
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${formatStatus(report)}\n`,
    );
    return EXIT.OK;
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
// REQ-ARC-001 and REQ-CLI-001: `archive` rewrites the contract, so it names
// the change explicitly, and it never returns 1 — refusing to act is exit 2.
const archiveCommand: Command = {
  name: "archive",
  summary: "Apply a change's delta to the specs and file it away",
  async run(argv, io): Promise<ExitCode> {
    const positional = argv.filter((argument) => !argument.startsWith("-"));
    if (positional.length > 1) {
      throw new UsageError(
        "Usage: specd archive <change> — exactly one change name.",
      );
    }

    const result = await archive(positional[0], { cwd: io.cwd });
    const lines = [
      `Archived ${result.change} to ${result.destination}.`,
      ...result.written.map((file) => `  wrote ${file}`),
      ...result.alreadyApplied.map((id) => `  already applied ${id}`),
      "Nothing was staged or committed — review the diff before it becomes history.",
    ];
    io.stdout(`${lines.join("\n")}\n`);
    return EXIT.OK;
  },
};

const anchorCommand: Command = {
  name: "anchor",
  summary: "Report anchor candidates, or rewrite one to its suggestion",
  async run(argv, io): Promise<ExitCode> {
    const [subcommand, ...rest] = argv;
    if (subcommand === "fix") return anchorFix(rest, io);
    if (subcommand !== "suggest") {
      throw new UsageError(
        `Unknown subcommand "${subcommand ?? ""}" for "anchor". Usage: specd anchor suggest <capability> [--json], or specd anchor fix <requirement>.`,
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
    return EXIT.OK;
  },
};

// REQ-ANC-008: the file changes on disk and stays unstaged. Exit 2 when there
// is nothing to apply — a refusal to act, not a verdict.
async function anchorFix(argv: string[], io: CliIo): Promise<ExitCode> {
  const positional = argv.filter((argument) => !argument.startsWith("-"));
  if (positional.length !== 1) {
    throw new UsageError(
      "Usage: specd anchor fix <requirement> — exactly one requirement identifier.",
    );
  }

  const result = await fixAnchor(positional[0], { cwd: io.cwd });
  const lines = result.fixed.map(
    (anchor) =>
      `${anchor.requirementId}: ${anchor.from} -> ${anchor.to} (${anchor.file}:${anchor.line})`,
  );
  io.stdout(
    `${lines.join("\n")}\nRewritten and left unstaged — read the diff before committing.\n`,
  );
  return EXIT.OK;
}

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
