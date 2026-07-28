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
  // `delta.md` of an active change, keyed by change name.
  change?: { name: string; delta: string };
}

const workspaces: Workspace[] = [];

export function makeWorkspace(spec: WorkspaceSpec): Workspace {
  const root = mkdtempSync(join(tmpdir(), "specd-verify-"));
  const globalPath = join(root, "absent-global", "config.toml");

  write(root, ".specd/config.toml", spec.config ?? "");
  for (const [name, content] of Object.entries(spec.specs ?? {})) {
    write(root, `.specd/specs/${name}.md`, content);
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

function write(root: string, path: string, content: string): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}
