// REQ-CLI-009 — the usage text is rendered from the registered surface.
// REQ-CLI-010 — every scope answers --help.
// REQ-CLI-011 — a scope's usage text has one source.
//
// `USAGE` used to be a 44-line literal sitting beside the table that dispatches
// the commands: two descriptions of the same surface with nothing tying them
// together. `Command.summary` was set on nine commands and read by none, and
// the drift had already happened unnoticed — `--version` and `-h` worked and
// were absent from the text.
//
// The per-scope texts had the same shape of problem one level down. They were
// already written, inside the `throw` sites, reachable only by getting the
// command wrong. Here they are declared once and read twice: printed on
// request, named on refusal.
//
// Only lists are generated. The header, the footer and the `hooks run` caveat
// are judgement rather than enumeration, and no metadata would produce them.

import { HOOK_EVENTS } from "../hooks/protocol.js";
import { DEFAULT_PORT } from "../read/server.js";

export interface CommandSummary {
  name: string;
  summary: string;
}

export interface OptionLine {
  flags: string;
  summary: string;
}

export interface ScopeUsage {
  // One line per accepted form. `anchor suggest` has two.
  signature: readonly string[];
  summary: string;
  options?: readonly OptionLine[];
  note?: string;
}

// The entry points `main` handles before dispatch. They are declared here, and
// not only inside the `if` that answers them, because they are the ones that
// drifted: generating from the command table alone would still miss them.
export const GLOBAL_OPTIONS: readonly OptionLine[] = [
  { flags: "--help, -h", summary: "Show this message" },
  { flags: "--version, -v", summary: "Print the installed version" },
];

const JSON_OPTION: OptionLine = {
  flags: "--json",
  summary: "Emit the report as JSON on stdout",
};

export const SCOPE_USAGE = {
  init: {
    signature: ["specd init [--force]"],
    summary: "Scaffold .specd/ and write a complete config.",
    options: [
      {
        flags: "--force",
        summary: "Overwrite an existing .specd/config.toml",
      },
    ],
  },

  verify: {
    signature: ["specd verify [--fast] [--json]"],
    summary: "Run the gate over this repository.",
    options: [
      { flags: "--fast", summary: "Skip the project layer" },
      { flags: "--json", summary: "Emit the full report as JSON on stdout" },
    ],
    note:
      "The only command whose exit code 1 is a verdict on quality. A layer that\n" +
      "could not run exits 2 instead, so CI can tell a failing spec from a\n" +
      "broken tool.",
  },

  status: {
    signature: ["specd status [--json]"],
    summary: "Report drift and pending work, grouped by change.",
    options: [JSON_OPTION],
    note: "Informs; never judges. Always exits 0.",
  },

  read: {
    signature: [
      "specd read [path...] [--all] [--full] [--port <number>] [--open]",
    ],
    summary: "Serve the Markdown as one page, for reading aloud.",
    options: [
      {
        flags: "--all",
        summary: "Include archived changes in the default selection",
      },
      { flags: "--full", summary: "Omit nothing: render the Markdown whole" },
      {
        flags: "--port <number>",
        summary: `Port to serve on (default ${DEFAULT_PORT})`,
      },
      { flags: "--open", summary: "Launch the system browser on the URL" },
    ],
    note:
      "With no path, reads .specd/specs/ and the open changes; archived changes\n" +
      "need --all. Binds 127.0.0.1 only and serves from memory, so nothing leaves\n" +
      "the machine and no route reads the filesystem. Holds until Ctrl-C.",
  },

  explore: {
    signature: ["specd explore <card> --change <name> [--json]"],
    summary: "Collect the configured sources into a bundle.",
    options: [
      {
        flags: "--change <name>",
        summary: "The change directory the bundle belongs to",
      },
      JSON_OPTION,
    ],
    note: "Takes exactly one card identifier or URL. Reaches the network, and a failed required source exits 2.",
  },

  sync: {
    signature: ["specd sync [--dry-run] [--json]"],
    summary: "Reconcile the spec with the configured board.",
    options: [
      {
        flags: "--dry-run",
        summary: "Plan and report without writing to the board or the spec",
      },
      JSON_OPTION,
    ],
    note: "Writes to a third-party system, so it is invoked by hand and never by a hook. A conflict stops the run and exits 2 rather than choosing a side.",
  },

  archive: {
    signature: ["specd archive <change> [--sync]"],
    summary: "Apply a change's delta to the specs and file it away.",
    options: [
      {
        flags: "--sync",
        summary: "Reconcile the board after the capabilities are written",
      },
    ],
    note: "Takes exactly one change name. Nothing is staged or committed — the diff is meant to be read before it becomes history.",
  },

  anchor: {
    signature: [
      "specd anchor suggest <capability> [--json]",
      "specd anchor suggest --file <path> [--json]",
      "specd anchor fix <requirement>",
    ],
    summary: "Report anchor candidates, or rewrite one to its suggestion.",
    note: "Run `specd anchor suggest --help` or `specd anchor fix --help` for either one.",
  },

  "anchor suggest": {
    signature: [
      "specd anchor suggest <capability> [--json]",
      "specd anchor suggest --file <path> [--json]",
    ],
    summary:
      "Report anchor candidates for a capability, or list what a file declares.",
    options: [
      {
        flags: "--file <path>",
        summary: "Invert the question: list the declarations a file contains",
      },
      JSON_OPTION,
    ],
    note: "`--file` takes no capability name. A candidate informs; it never decides.",
  },

  "anchor fix": {
    signature: ["specd anchor fix <requirement>"],
    summary: "Rewrite a dangling anchor to its suggested location.",
    note: "Takes exactly one requirement identifier. The file changes on disk and stays unstaged; exits 2 when there is nothing to apply.",
  },

  hooks: {
    signature: [
      "specd hooks install [--full-on-stop] [--force] [--command <exec>]",
      "specd hooks uninstall",
      `specd hooks run <${HOOK_EVENTS.join("|")}> [--fast]`,
    ],
    summary: "Install, remove, or act as the host's hook adapter.",
    note: "Run `specd hooks install --help`, `... uninstall --help` or `... run --help` for any one of them.",
  },

  "hooks install": {
    signature: [
      "specd hooks install [--full-on-stop] [--force] [--command <exec>]",
    ],
    summary: "Add the specd hooks to .claude/settings.json.",
    options: [
      {
        flags: "--full-on-stop",
        summary: "Write the Stop command without --fast",
      },
      {
        flags: "--force",
        summary: "Replace an existing specd entry whose command differs",
      },
      {
        flags: "--command <exec>",
        summary: 'How the hook invokes specd (default "specd")',
      },
    ],
    note: "Takes no positional arguments.",
  },

  "hooks uninstall": {
    signature: ["specd hooks uninstall"],
    summary: "Remove the specd hooks from .claude/settings.json.",
    note: "Takes no arguments.",
  },

  "hooks run": {
    signature: [`specd hooks run <${HOOK_EVENTS.join("|")}> [--fast]`],
    summary: "Adapter invoked by the host; not meant to be run by hand.",
    options: [{ flags: "--fast", summary: "Skip the project layer" }],
    note:
      "Takes exactly one event name. This is the one command that answers in the\n" +
      "host's hook convention rather than in specd's exit-code contract; the two\n" +
      "meet inside the adapter, once, in the open. See src/hooks/protocol.ts.",
  },
} as const satisfies Record<string, ScopeUsage>;

export type Scope = keyof typeof SCOPE_USAGE;

const HEADER = `specd — spec-driven development with drift detection

Usage: specd <command> [options]`;

const FOOTER = `Run \`specd <command> --help\` for the arguments and options of a command.

Exit codes: 0 success, 1 gate failure, 2 operational failure.
\`hooks run\` is the one exception, and deliberately so: it answers in the host's
hook convention, not in this one. See src/hooks/protocol.ts.`;

export function renderUsage(commands: readonly CommandSummary[]): string {
  const width = column([
    ...commands.map((command) => command.name),
    ...GLOBAL_OPTIONS.map((option) => option.flags),
  ]);

  return [
    HEADER,
    "",
    "Commands:",
    ...commands.map((command) => row(command.name, command.summary, width)),
    "",
    "Options:",
    ...GLOBAL_OPTIONS.map((option) => row(option.flags, option.summary, width)),
    "",
    FOOTER,
    "",
  ].join("\n");
}

// REQ-CLI-011: the single source. `--help` prints this; a usage error names it.
export function renderScopeHelp(scope: Scope): string {
  const usage: ScopeUsage = SCOPE_USAGE[scope];
  const lines = [usage.summary, "", "Usage:"];
  for (const signature of usage.signature) lines.push(`  ${signature}`);

  if (usage.options !== undefined && usage.options.length > 0) {
    const width = column(usage.options.map((option) => option.flags));
    lines.push("", "Options:");
    for (const option of usage.options) {
      lines.push(row(option.flags, option.summary, width));
    }
  }

  if (usage.note !== undefined) lines.push("", usage.note);
  return `${lines.join("\n")}\n`;
}

// REQ-CLI-010: checked before any option is validated, and before any work is
// done. `sync` and `explore` open the network and `archive` rewrites the
// capabilities — a help flag read too late would be the one way this surface
// costs something (costly-ops-are-not-silent).
export function helpRequested(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function row(label: string, summary: string, width: number): string {
  return `  ${label.padEnd(width)}  ${summary}`;
}

function column(labels: readonly string[]): number {
  return labels.reduce((widest, label) => Math.max(widest, label.length), 0);
}
