import { fixAnchor } from "../anchors/fix.js";
import {
  formatFileSuggestReport,
  formatSuggestReport,
  suggestAnchors,
  suggestForFile,
} from "../anchors/suggest.js";
import { archive } from "../archive/index.js";
import { explore } from "../explore/index.js";
import { formatInstallResult, installHooks } from "../hooks/install.js";
import { isHookEvent, HOOK_EVENTS } from "../hooks/protocol.js";
import { runHook } from "../hooks/run.js";
import { formatUninstallResult, uninstallHooks } from "../hooks/uninstall.js";
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
  anchor suggest --file <path>      List the declarations a file contains
  anchor fix <requirement>          Rewrite a dangling anchor to its suggested location
  hooks install                     Add the specd hooks to .claude/settings.json
  hooks uninstall                   Remove them again
  hooks run <event>                 Adapter invoked by the host; not meant to be run by hand
  help                              Show this message

Options for verify:
  --fast        Skip the project layer
  --json        Emit the full report as JSON on stdout

Options for init:
  --force       Overwrite an existing .specd/config.toml

Options for status and anchor suggest:
  --json        Emit the report as JSON on stdout

Options for hooks install:
  --full-on-stop        Write the Stop command without --fast
  --force               Replace an existing specd entry whose command differs
  --command <exec>      How the hook invokes specd (default "specd")

Exit codes: 0 success, 1 gate failure, 2 operational failure.
\`hooks run\` is the one exception, and deliberately so: it answers in the host's
hook convention, not in this one. See src/hooks/protocol.ts.
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
    hooksCommand,
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

    const { positional, options } = parseArguments(
      rest,
      ["--file"],
      ["--json"],
    );

    // REQ-ANC-012: `--file` inverts the question — list what the file declares
    // rather than search for terms lifted from requirement prose.
    const file = options.get("--file");
    if (file !== undefined) {
      if (positional.length > 0) {
        throw new UsageError(
          "Usage: specd anchor suggest --file <path> [--json] — --file takes no capability name.",
        );
      }
      const report = suggestForFile({ root: io.cwd, file });
      io.stdout(
        options.has("--json")
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatFileSuggestReport(report)}\n`,
      );
      return EXIT.OK;
    }

    const capability = positional[0];
    if (capability === undefined || positional.length > 1) {
      throw new UsageError(
        "Usage: specd anchor suggest <capability> [--json], or specd anchor suggest --file <path>.",
      );
    }

    const report = suggestAnchors({ root: io.cwd, capability });
    io.stdout(
      options.has("--json")
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${formatSuggestReport(report)}\n`,
    );
    return EXIT.OK;
  },
};

const hooksCommand: Command = {
  name: "hooks",
  summary: "Install, remove, or act as the host's hook adapter",
  async run(argv, io): Promise<ExitCode> {
    const [subcommand, ...rest] = argv;
    if (subcommand === "install") return hooksInstall(rest, io);
    if (subcommand === "uninstall") return hooksUninstall(rest, io);
    if (subcommand === "run") return hooksRun(rest, io);
    throw new UsageError(
      `Unknown subcommand "${subcommand ?? ""}" for "hooks". Usage: specd hooks install [--full-on-stop] [--force] [--command <exec>], specd hooks uninstall, or specd hooks run <${HOOK_EVENTS.join("|")}> [--fast].`,
    );
  },
};

// REQ-HOOK-001/002/003/007: writing the settings file is an ordinary specd
// command and answers in specd's exit-code contract — 2 when it refuses to act.
function hooksInstall(argv: string[], io: CliIo): Promise<ExitCode> {
  const { positional, options } = parseArguments(
    argv,
    ["--command"],
    ["--full-on-stop", "--force"],
  );
  if (positional.length > 0) {
    throw new UsageError(
      "Usage: specd hooks install [--full-on-stop] [--force] [--command <exec>] — no positional arguments.",
    );
  }

  const executable = options.get("--command");
  const result = installHooks({
    cwd: io.cwd,
    fullOnStop: options.has("--full-on-stop"),
    force: options.has("--force"),
    ...(executable === undefined ? {} : { executable }),
  });
  io.stdout(`${formatInstallResult(result)}\n`);
  return Promise.resolve(EXIT.OK);
}

function hooksUninstall(argv: string[], io: CliIo): Promise<ExitCode> {
  if (argv.length > 0) {
    throw new UsageError("Usage: specd hooks uninstall — takes no arguments.");
  }
  io.stdout(`${formatUninstallResult(uninstallHooks({ cwd: io.cwd }))}\n`);
  return Promise.resolve(EXIT.OK);
}

// REQ-HOOK-005 — the one place the two exit-code contracts meet.
//
// Everything above answers in specd's contract; this returns the host's. The
// numbers overlap and the meanings do not, so the translation happens here,
// once, in the open — rather than by letting a specd code travel out through a
// channel that reads it as something else.
async function hooksRun(argv: string[], io: CliIo): Promise<ExitCode> {
  const { positional, options } = parseArguments(argv, [], ["--fast"]);
  const event = positional[0];
  if (event === undefined || positional.length > 1 || !isHookEvent(event)) {
    throw new UsageError(
      `Usage: specd hooks run <${HOOK_EVENTS.join("|")}> [--fast] — exactly one event name.`,
    );
  }

  const outcome = await runHook(event, {
    cwd: io.cwd,
    fast: options.has("--fast"),
  });
  // The payload enriches; it never decides. A host that ignores stdout still
  // sees the exit code, which is what makes this fail closed.
  io.stdout(`${JSON.stringify(outcome.payload)}\n`);
  io.stderr(`${outcome.message}\n`);
  return outcome.exitCode;
}

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
