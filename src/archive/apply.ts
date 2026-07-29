import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConflictError } from "../core/conflict.js";
import type { Capability } from "../parser/capability.js";
import type { Delta, DeltaRequirement } from "../parser/delta.js";

export interface CapabilityWrite {
  // Absolute path of the capability file.
  path: string;
  capability: string;
  content: string;
  // True when the capability file does not exist yet.
  created: boolean;
}

export interface ApplicationPlan {
  writes: CapabilityWrite[];
  // Requirements already present with identical text; nothing to write.
  alreadyApplied: string[];
}

const CAPABILITY_LABEL = /^\s*\*\*Capability\.?\*\*\s*.*$/;

// REQ-ARC-009 — Validation precedes every write.
//
// The whole new content of every affected capability is computed and checked
// here, before a byte reaches disk, and the caller moves the change directory
// only after every write succeeds. Cross-file atomicity would need a journal;
// this reduces the failure window to the filesystem, and guarantees that the
// likely failure — a logical conflict — never produces a partial state.
export function planApplication(
  delta: Delta,
  capabilities: readonly Capability[],
  specsDir: string,
): ApplicationPlan {
  const sources = new Map<string, string>();
  const paths = new Map<string, string>();
  for (const capability of capabilities) {
    const path = join(specsDir, `${capability.name}.md`);
    paths.set(capability.name, path);
    sources.set(capability.name, readFileSync(path, "utf8"));
  }

  const alreadyApplied: string[] = [];
  const created = new Set<string>();

  for (const entry of delta.added) {
    const name = destinationOf(entry, capabilities);
    if (!sources.has(name)) {
      sources.set(name, newCapabilityFile(name));
      paths.set(name, join(specsDir, `${name}.md`));
      created.add(name);
    }
    const source = sources.get(name) as string;
    if (alreadyApplied_(source, entry)) {
      alreadyApplied.push(entry.requirement.id);
      continue;
    }
    sources.set(name, insertRequirement(source, entry));
  }

  for (const entry of delta.modified) {
    const name = destinationOf(entry, capabilities);
    const source = sources.get(name);
    if (source === undefined) {
      throw new ConflictError(`Cannot apply the delta of ${delta.change}.`, [
        `${entry.requirement.id} is MODIFIED but capability "${name}" does not exist.`,
      ]);
    }
    sources.set(name, replaceRequirement(source, entry));
  }

  for (const id of delta.removed) {
    const owner = capabilities.find((capability) =>
      capability.requirements.some((requirement) => requirement.id === id),
    );
    if (owner === undefined) {
      throw new ConflictError(`Cannot apply the delta of ${delta.change}.`, [
        `${id} is REMOVED but exists in no capability.`,
      ]);
    }
    sources.set(
      owner.name,
      retireRequirement(sources.get(owner.name) as string, id),
    );
  }

  const writes: CapabilityWrite[] = [];
  for (const [name, content] of sources) {
    const original = capabilities.find((c) => c.name === name);
    const untouched =
      original !== undefined &&
      content === readFileSync(paths.get(name) as string, "utf8");
    if (untouched) continue;
    writes.push({
      path: paths.get(name) as string,
      capability: name,
      content,
      created: created.has(name),
    });
  }

  return { writes, alreadyApplied };
}

// REQ-ARC-010 — Reapplication is idempotent by content.
//
// Without this, a failure between writing the capabilities and moving the
// change directory would leave no way forward: the second run would abort on a
// duplicate identifier. Identical text means the write already happened;
// different text under the same identifier is a conflict and stays one (no-guessing-on-conflict).
export function alreadyApplied(
  source: string,
  entry: DeltaRequirement,
): boolean {
  return alreadyApplied_(source, entry);
}

function alreadyApplied_(source: string, entry: DeltaRequirement): boolean {
  const existing = extractSection(source, entry.requirement.id);
  if (existing === undefined) return false;
  if (normalize(existing.text) === normalize(entry.text)) return true;
  throw new ConflictError(
    `Cannot add ${entry.requirement.id}: it already exists with different text.`,
    [
      `An ADDED requirement must not exist yet. If this is a rewrite, declare it under MODIFIED.`,
    ],
  );
}

// REQ-ARC-003 — ADDED inserts a new section.
//
// Appended to the end of the file. Deterministic, and the alternative —
// inserting in identifier order — would imply capability files are sorted,
// which they are not: `verify.md` already carries REQ-VER-009 between 006
// and 007 because that is where it belongs by meaning.
export function insertRequirement(
  source: string,
  entry: DeltaRequirement,
): string {
  return `${source.trimEnd()}\n\n${entry.text.trimEnd()}\n`;
}

// REQ-ARC-004 — MODIFIED replaces the whole section, in place.
export function replaceRequirement(
  source: string,
  entry: DeltaRequirement,
): string {
  const existing = extractSection(source, entry.requirement.id);
  if (existing === undefined) {
    throw new ConflictError(
      `Cannot modify ${entry.requirement.id}: no such section.`,
      [`MODIFIED replaces a section that already exists; this one does not.`],
    );
  }
  const tail = source.slice(existing.end);
  // A section is followed by a blank line unless it ended the file; without
  // this the next heading would end up glued to the block just written.
  const separator = tail.length === 0 ? "\n" : "\n\n";
  return (
    source.slice(0, existing.start) + entry.text.trimEnd() + separator + tail
  );
}

// REQ-ARC-005 — REMOVED deletes the section and retires the identifier.
export function retireRequirement(source: string, id: string): string {
  const existing = extractSection(source, id);
  if (existing === undefined) {
    throw new ConflictError(`Cannot remove ${id}: no such section.`, [
      `The identifier appears under REMOVED but the capability has no section for it.`,
    ]);
  }
  const without = source.slice(0, existing.start) + source.slice(existing.end);
  return appendRetired(without, id);
}

interface Section {
  start: number;
  end: number;
  text: string;
}

function extractSection(source: string, id: string): Section | undefined {
  const heading = new RegExp(`^### ${id}\\b.*$`, "m");
  const match = heading.exec(source);
  if (!match) return undefined;

  const start = match.index;
  const rest = source.slice(start + match[0].length);
  const next = /^#{1,3} /m.exec(rest);
  const end =
    next === null ? source.length : start + match[0].length + next.index;
  return { start, end, text: source.slice(start, end) };
}

function appendRetired(source: string, id: string): string {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!front) {
    throw new ConflictError(`Cannot retire ${id}.`, [
      "The capability file has no frontmatter to record the retirement in.",
    ]);
  }
  const body = front[1] as string;
  const retired = /^retired:\s*\[(.*)\]\s*$/m.exec(body);
  if (retired === null) {
    throw new ConflictError(`Cannot retire ${id}.`, [
      'The capability frontmatter has no inline "retired: [...]" list to append to.',
    ]);
  }
  const current = (retired[1] as string)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (current.includes(id)) {
    throw new ConflictError(`Cannot retire ${id}.`, [
      "The identifier is already listed as retired.",
    ]);
  }
  const updated = body.replace(
    retired[0],
    `retired: [${[...current, id].join(", ")}]`,
  );
  return source.replace(body, updated);
}

function destinationOf(
  entry: DeltaRequirement,
  capabilities: readonly Capability[],
): string {
  if (entry.capability !== undefined && entry.capability.length > 0) {
    return entry.capability;
  }
  const owners = capabilities.filter((capability) =>
    capability.requirements.some(
      (requirement) => requirement.id === entry.requirement.id,
    ),
  );
  if (owners.length === 1) return (owners[0] as Capability).name;
  throw new ConflictError(
    `Cannot place ${entry.requirement.id}.`,
    owners.length === 0
      ? ["No capability declares this requirement, and the delta names none."]
      : owners.map((owner) => `Declared by capability "${owner.name}".`),
  );
}

function newCapabilityFile(name: string): string {
  return `---\ncapability: ${name}\nretired: []\n---\n`;
}

function normalize(text: string): string {
  return text
    .split("\n")
    .filter((line) => !CAPABILITY_LABEL.test(line))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}
