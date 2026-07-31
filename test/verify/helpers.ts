import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Workspace {
  root: string;
  globalPath: string;
  cleanup: () => void;
}

export interface WorkspaceSpec {
  // TOML written to `.specd/config.toml`.
  config?: string;
  // Capability files, keyed by name without the `.md` suffix.
  specs?: Record<string, string>;
  // Any other file, keyed by path relative to the root.
  files?: Record<string, string>;
  // `delta.md` of an open change, keyed by change name. The `proposal.md`
  // REQ-FMT-011 requires is written alongside it unless `proposal` overrides
  // it — every workspace with a change would otherwise have to spell one out.
  change?: {
    name: string;
    delta: string;
    proposal?: string;
    // Skip the proposal record, for the tests that exercise its absence.
    record?: false;
  };
  // Skip the default capability, leaving the project without `.specd/specs/`.
  emptyProject?: boolean;
}

const workspaces: Workspace[] = [];

export function makeWorkspace(spec: WorkspaceSpec): Workspace {
  const root = mkdtempSync(join(tmpdir(), "specd-verify-"));
  const globalPath = join(root, "absent-global", "config.toml");

  write(root, ".specd/config.toml", spec.config ?? "");
  // A specd project always has a specs directory; verify exits 2 without one
  // rather than passing vacuously, so a workspace that declares no capability
  // still gets an inert one. `emptyProject` opts out, for the tests that
  // exercise exactly that refusal.
  const specs =
    spec.specs ??
    (spec.emptyProject === true
      ? {}
      : { inert: capability({ name: "inert", id: "REQ-INERT-001" }) });
  for (const [name, content] of Object.entries(specs)) {
    write(root, `.specd/specs/${name}.md`, content);
  }
  if (spec.emptyProject !== true && Object.keys(specs).length === 0) {
    mkdirSync(join(root, ".specd", "specs"), { recursive: true });
  }
  for (const [path, content] of Object.entries(spec.files ?? {})) {
    write(root, path, content);
  }
  if (spec.change) {
    write(
      root,
      `.specd/changes/${spec.change.name}/delta.md`,
      spec.change.delta,
    );
    write(
      root,
      `.specd/changes/${spec.change.name}/proposal.md`,
      spec.change.proposal ?? proposal({ change: spec.change.name }),
    );
    // REQ-ARC-016: every change carries a proposal record, and an empty one is
    // a mark rather than an absence. The tests that exercise the refusal delete
    // it; the rest would otherwise all describe a state `archive` rejects.
    if (spec.change.record !== false) {
      write(
        root,
        `.specd/changes/${spec.change.name}/propose.json`,
        `${JSON.stringify({ version: 1, change: spec.change.name, requirements: [] }, null, 2)}\n`,
      );
    }
  }

  const workspace = {
    root,
    globalPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
  workspaces.push(workspace);
  return workspace;
}

export function cleanupWorkspaces(): void {
  while (workspaces.length > 0) workspaces.pop()?.cleanup();
}

// A capability file with one requirement, anchored wherever the caller wants.
export function capability(options: {
  name: string;
  id: string;
  statement?: string;
  anchors?: string;
}): string {
  const anchors =
    options.anchors === undefined
      ? ""
      : `\n\`\`\`yaml anchors\n${options.anchors}\n\`\`\`\n`;
  return (
    `---\ncapability: ${options.name}\nretired: []\n---\n\n` +
    `# ${options.name}\n\n` +
    `### ${options.id} — Example\n\n` +
    `**Statement.** ${options.statement ?? "The specd verifier SHALL do the thing."}\n\n` +
    `**Acceptance.**\n- it works\n${anchors}`
  );
}

// The `proposal.md` of a change: frontmatter first, since that is the part
// REQ-FMT-011 reads, and a card only when the caller wants one.
export function proposal(options: {
  change: string;
  status?: string;
  card?: { ref: string; url: string };
}): string {
  const card =
    options.card === undefined
      ? ""
      : `card:\n  ref: "${options.card.ref}"\n  url: "${options.card.url}"\n`;
  return (
    `---\nchange: ${options.change}\nstatus: ${options.status ?? "active"}\n${card}---\n\n` +
    `# ${options.change}\n\nBecause the tests need a reason too.\n`
  );
}

function write(root: string, path: string, content: string): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

// A requirement block as a delta carries it under Modelo B: complete text,
// with the destination capability declared inline.
export function deltaRequirement(options: {
  id: string;
  capability: string;
  anchors?: string;
}): string {
  const anchors =
    options.anchors === undefined
      ? ""
      : `\n\`\`\`yaml anchors\n${options.anchors}\n\`\`\`\n`;
  return (
    `### ${options.id} — Example\n\n` +
    `**Capability.** ${options.capability}\n\n` +
    `**Statement.** The specd verifier SHALL do the thing.\n\n` +
    `**Acceptance.**\n- it works\n${anchors}`
  );
}

export function delta(options: {
  change: string;
  added?: string[];
  modified?: string[];
  removed?: string[];
}): string {
  const parts = [`---\nchange: ${options.change}\n---\n`];
  if (options.added?.length)
    parts.push(`## ADDED\n\n${options.added.join("\n")}`);
  if (options.modified?.length)
    parts.push(`## MODIFIED\n\n${options.modified.join("\n")}`);
  if (options.removed?.length)
    parts.push(
      `## REMOVED\n\n${options.removed.map((id) => `- ${id}`).join("\n")}`,
    );
  return `${parts.join("\n")}\n`;
}
