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
import { isHookEvent } from "../hooks/protocol.js";
import { runHook } from "../hooks/run.js";
import { formatUninstallResult, uninstallHooks } from "../hooks/uninstall.js";
import { formatInitResult, init } from "../init/index.js";
import { DEFAULT_PORT, openInBrowser, read } from "../read/index.js";
import { formatStatus, status } from "../status/index.js";
import { formatSyncReport, sync } from "../sync/index.js";
import { verify } from "../verify/index.js";
import { formatReport } from "../verify/report.js";
import { EXIT, type ExitCode } from "./exit-codes.js";
import {
  helpRequested,
  renderScopeHelp,
  renderUsage,
  type Scope,
} from "./usage.js";

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

// REQ-CLI-001: exactly one command returns a non-zero exit code as a quality
// gate, and it is `verify`. Everything else here may only fail operationally.
export function registerCommands(): Map<string, Command> {
  const commands = new Map<string, Command>();
  for (const command of [
    initCommand,
    verifyCommand,
    statusCommand,
    readCommand,
    exploreCommand,
    syncCommand,
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
    if (helpRequested(argv)) return help("verify", io);
    const flags = parseFlags(argv, ["--fast", "--json"], "verify");
    const report = await verify({ cwd: io.cwd, fast: flags.has("--fast") });

    // REQ-VER-008: with --json the machine-readable report owns stdout and the
    // human rendering moves to stderr, so a pipe never mixes the two.
    if (flags.has("--json")) {
      io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      io.stderr(`${formatReport(report)}\n`);
    } else {
      io.stdout(`${formatReport(report)}\n`);
    }

    // REQ-VER-013: a layer that could not run is the tool failing, not the
    // spec. CI has to keep telling those apart (REQ-CLI-004).
    if (report.blocked !== undefined) return EXIT.OPERATIONAL_FAILURE;
    return report.ok ? EXIT.OK : EXIT.GATE_FAILURE;
  },
};

const initCommand: Command = {
  name: "init",
  summary: "Scaffold .specd/ and write a complete config",
  run(argv, io): Promise<ExitCode> {
    if (helpRequested(argv)) return help("init", io);
    const flags = parseFlags(argv, ["--force"], "init");
    const result = init({ cwd: io.cwd, force: flags.has("--force") });
    io.stdout(`${formatInitResult(result)}\n`);
    return Promise.resolve(EXIT.OK);
  },
};

// REQ-CFG-006: status always exits 0. It informs; it does not judge — only
// `verify` is allowed to fail a build (REQ-CLI-001).
const statusCommand: Command = {
  name: "status",
  summary: "Report drift and pending work, grouped by change",
  async run(argv, io): Promise<ExitCode> {
    if (helpRequested(argv)) return help("status", io);
    const flags = parseFlags(argv, ["--json"], "status");
    const report = await status({ cwd: io.cwd });
    io.stdout(
      flags.has("--json")
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${formatStatus(report)}\n`,
    );
    return EXIT.OK;
  },
};

// REQ-CLI-001: `read` exits 0 or 2 and never 1. It renders prose; it does not
// resolve an anchor, does not consult the repository state, and has no verdict
// to deliver about anything.
const readCommand: Command = {
  name: "read",
  summary: "Serve the Markdown as one page, for reading aloud",
  async run(argv, io): Promise<ExitCode> {
    if (helpRequested(argv)) return help("read", io);
    const { positional, options } = parseArguments(
      argv,
      ["--port"],
      ["--all", "--full", "--open"],
      "read",
    );

    const session = await read({
      cwd: io.cwd,
      paths: positional,
      all: options.has("--all"),
      full: options.has("--full"),
      port: parsePort(options.get("--port")),
    });

    // REQ-READ-006: printed before anything is launched, and printed whether
    // or not it is. The URL is the deliverable; the browser is a convenience.
    io.stdout(
      `Serving ${session.files} file${session.files === 1 ? "" : "s"} at ${session.url}\n` +
        `Press Ctrl-C to stop.\n`,
    );

    if (options.has("--open")) {
      io.stdout(`Opening ${session.url} in the system browser.\n`);
      try {
        await openInBrowser(session.url);
      } catch (cause) {
        // The document is served and the URL is on screen. Giving that up
        // because the system opener is missing would destroy the work that
        // succeeded over the part that was convenience (REQ-ARC-012's shape).
        io.stderr(
          `Could not launch a browser: ${cause instanceof Error ? cause.message : String(cause)}\n` +
            `The document is still served at ${session.url}.\n`,
        );
      }
    }

    await untilInterrupted();
    await session.close();
    return EXIT.OK;
  },
};

function parsePort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new UsageError(
      `Option "--port" takes a port number between 0 and 65535, not "${value}".`,
      "read",
    );
  }
  return port;
}

function untilInterrupted(): Promise<void> {
  return new Promise((resolve) => {
    process.once("SIGINT", () => {
      // A newline so the shell prompt does not land beside the ^C.
      process.stdout.write("\n");
      resolve();
    });
  });
}

// REQ-CLI-001: `explore` reaches the network and may fail, but only ever
// operationally — a failed required source is exit 2, not a gate verdict.
const exploreCommand: Command = {
  name: "explore",
  summary: "Collect the configured sources into a bundle",
  async run(argv, io): Promise<ExitCode> {
    if (helpRequested(argv)) return help("explore", io);
    const { positional, options } = parseArguments(
      argv,
      ["--change"],
      ["--json"],
      "explore",
    );
    const card = positional[0];
    if (card === undefined || positional.length > 1) {
      throw new UsageError(
        "Exactly one card identifier or URL is required.",
        "explore",
      );
    }
    const change = options.get("--change");
    if (change === undefined) {
      throw new UsageError("--change is required.", "explore");
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

// REQ-SYNC-001 and REQ-CLI-001: `sync` writes to a third-party system, so it is
// invoked by hand and never by a hook, and it answers in specd's exit-code
// contract — a conflict is exit 2, never 1. Only `verify` reproves.
const syncCommand: Command = {
  name: "sync",
  summary: "Reconcile the spec with the configured board",
  async run(argv, io): Promise<ExitCode> {
    if (helpRequested(argv)) return help("sync", io);
    const flags = parseFlags(argv, ["--dry-run", "--json"], "sync");
    const report = await sync({
      cwd: io.cwd,
      dryRun: flags.has("--dry-run"),
    });

    if (flags.has("--json")) {
      io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      io.stderr(`${formatSyncReport(report)}\n`);
    } else {
      io.stdout(`${formatSyncReport(report)}\n`);
    }
    return EXIT.OK;
  },
};

// REQ-CLI-001: `anchor` reads and reports. It returns non-zero only when it
// cannot run — an ambiguous capability name, a missing spec tree — never as a
// quality verdict.
// REQ-ARC-001 and REQ-CLI-001: `archive` rewrites the contract, so it names
// the change explicitly, and it never returns 1 — refusing to act is exit 2.
const archiveCommand: Command = {
  name: "archive",
  summary: "Apply a change's delta to the specs and file it away",
  async run(argv, io): Promise<ExitCode> {
    if (helpRequested(argv)) return help("archive", io);
    const { positional, options } = parseArguments(
      argv,
      [],
      ["--sync"],
      "archive",
    );
    if (positional.length > 1) {
      throw new UsageError("Exactly one change name is accepted.", "archive");
    }

    const result = await archive(positional[0], {
      cwd: io.cwd,
      sync: options.has("--sync"),
    });
    const lines = [
      `Archived ${result.change} to ${result.destination}.`,
      ...result.written.map((file) => `  wrote ${file}`),
      ...result.alreadyApplied.map((id) => `  already applied ${id}`),
    ];

    if (result.synced !== undefined) {
      lines.push("", formatSyncReport(result.synced));
    } else if (result.unsynced !== undefined) {
      // REQ-ARC-013: zero is said out loud. "Nothing to report" and "nothing
      // was counted" have to read differently.
      lines.push(
        result.unsynced.total === 0
          ? "Board is up to date with what was archived."
          : `${result.unsynced.total} archived item${result.unsynced.total === 1 ? "" : "s"} not on the board yet: ` +
              `${[...result.unsynced.missing, ...result.unsynced.stale].join(", ")}. ` +
              `Run \`specd sync\`, or archive with --sync next time.`,
      );
    }

    lines.push(
      "Nothing was staged or committed — review the diff before it becomes history.",
    );
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
      // The parent scope answers when no subcommand identifies a child one.
      if (helpRequested(argv)) return help("anchor", io);
      throw new UsageError(
        `Unknown subcommand "${subcommand ?? ""}" for "anchor".`,
        "anchor",
      );
    }
    if (helpRequested(rest)) return help("anchor suggest", io);

    const { positional, options } = parseArguments(
      rest,
      ["--file"],
      ["--json"],
      "anchor suggest",
    );

    // REQ-ANC-012: `--file` inverts the question — list what the file declares
    // rather than search for terms lifted from requirement prose.
    const file = options.get("--file");
    if (file !== undefined) {
      if (positional.length > 0) {
        throw new UsageError(
          "--file takes no capability name.",
          "anchor suggest",
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
        "Exactly one capability name is required.",
        "anchor suggest",
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
    if (helpRequested(argv)) return help("hooks", io);
    throw new UsageError(
      `Unknown subcommand "${subcommand ?? ""}" for "hooks".`,
      "hooks",
    );
  },
};

// REQ-HOOK-001/002/003/007: writing the settings file is an ordinary specd
// command and answers in specd's exit-code contract — 2 when it refuses to act.
function hooksInstall(argv: string[], io: CliIo): Promise<ExitCode> {
  if (helpRequested(argv)) return help("hooks install", io);
  const { positional, options } = parseArguments(
    argv,
    ["--command"],
    ["--full-on-stop", "--force"],
    "hooks install",
  );
  if (positional.length > 0) {
    throw new UsageError(
      "No positional arguments are accepted.",
      "hooks install",
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
  if (helpRequested(argv)) return help("hooks uninstall", io);
  if (argv.length > 0) {
    throw new UsageError("No arguments are accepted.", "hooks uninstall");
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
  // REQ-CLI-010: asking for help is a specd invocation, not a host one. It is
  // answered here, in specd's contract, and never reaches `runHook` — where the
  // two contracts meet.
  if (helpRequested(argv)) return help("hooks run", io);

  const { positional, options } = parseArguments(
    argv,
    [],
    ["--fast"],
    "hooks run",
  );
  const event = positional[0];
  if (event === undefined || positional.length > 1 || !isHookEvent(event)) {
    throw new UsageError("Exactly one event name is required.", "hooks run");
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
  if (helpRequested(argv)) return help("anchor fix", io);
  const positional = argv.filter((argument) => !argument.startsWith("-"));
  if (positional.length !== 1) {
    throw new UsageError(
      "Exactly one requirement identifier is required.",
      "anchor fix",
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
  summary: "Show this message",
  run(_argv, io): Promise<ExitCode> {
    io.stdout(USAGE);
    return Promise.resolve(EXIT.OK);
  },
};

// REQ-CLI-009: the command list is rendered from the table that dispatches, so
// a command cannot exist without appearing in the help. Declared here, after
// the command constants, because it reads them at module initialisation.
//
// The `Options for ...` blocks that used to live in this text moved to the
// scope they belong to, reachable with `specd <command> --help` (REQ-CLI-010).
const USAGE = renderUsage([...registerCommands().values()]);

// REQ-CLI-011: a refusal names the same text `--help` prints. Two copies
// diverge, and a diverging second copy is exactly what REQ-CLI-009 fixed one
// level up — there between the table and the literal, here between the throw
// site and the help.
export class UsageError extends Error {
  readonly exitCode = EXIT.OPERATIONAL_FAILURE;

  constructor(reason: string, scope?: Scope) {
    super(
      scope === undefined
        ? reason
        : `${reason}\n\n${renderScopeHelp(scope)}`.trimEnd(),
    );
    this.name = "UsageError";
  }
}

// REQ-CLI-010: asking for help is not doing the work. Answered before options
// are validated, so `specd verify --nope --help` prints the help rather than
// complaining about the flag the reader is asking about.
function help(scope: Scope, io: CliIo): Promise<ExitCode> {
  io.stdout(renderScopeHelp(scope));
  return Promise.resolve(EXIT.OK);
}

export interface ParsedArguments {
  positional: string[];
  // Boolean flags are present with no value; `--name value` options carry one.
  options: Map<string, string> & { has(name: string): boolean };
}

// Minimal argv parser: positionals, `--name value` options, boolean flags.
// Anything not declared is a usage error rather than a silently ignored word.
//
// REQ-CLI-011: the scope travels in so that refusing an option names the same
// help the reader would have got by asking. An error that lists valid flags and
// nothing else makes the reader guess at the shape of the command.
function parseArguments(
  argv: string[],
  valued: string[],
  flags: string[],
  scope: Scope,
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
        throw new UsageError(`Option "${argument}" needs a value.`, scope);
      }
      options.set(argument, value);
      continue;
    }
    throw new UsageError(`Unknown option "${argument}".`, scope);
  }

  return { positional, options: options as ParsedArguments["options"] };
}

function parseFlags(
  argv: string[],
  allowed: string[],
  scope: Scope,
): Set<string> {
  const flags = new Set<string>();
  for (const argument of argv) {
    if (!allowed.includes(argument)) {
      throw new UsageError(`Unknown option "${argument}".`, scope);
    }
    flags.add(argument);
  }
  return flags;
}

export { USAGE };
