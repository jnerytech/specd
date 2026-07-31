import { requireProjectRoot } from "../core/root.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { resolveConfig } from "../config/resolve.js";
import type { ExploreSource, SpecdConfig } from "../config/schema.js";
import { loadChangeFrontmatter } from "../parser/change.js";
import { assertCardMatchesChange, parseCardRef } from "./card-ref.js";
import {
  writeManifest,
  type CollectionExtent,
  type ExploreManifest,
  type ManifestSource,
} from "./manifest.js";
import {
  bundlePath,
  changePath,
  manifestPath,
  notesPath,
  sourcePath,
} from "./paths.js";
import { redactPayload } from "./redact.js";
import { COLLECTORS, type CollectorContext } from "./sources/index.js";

export interface ExploreOptions {
  // The card identifier or URL the exploration is about.
  card: string;
  // Change directory the bundle belongs to.
  change: string;
  cwd?: string;
  config?: SpecdConfig;
  globalPath?: string;
  // Fixed instant for the manifest; defaults to now.
  now?: Date;
}

export interface ExploreResult {
  manifest: ExploreManifest;
  manifestPath: string;
  bundlePath: string;
  // REQ-EXP-010: where the prose of the exploration belongs. Reported so the
  // path is known before anyone has to guess it; never written here.
  notesPath: string;
}

// REQ-EXP-001 — Card identifier or URL.
//
// Collects every configured source into the change's bundle and records what
// happened to each one. This is not the gate: it reaches the network, and it
// returns a result rather than a verdict. Its failures are operational
// (REQ-CLI-001, REQ-CLI-004).
export async function explore(options: ExploreOptions): Promise<ExploreResult> {
  // REQ-CFG-010: the project is the directory holding `.specd/`, not the
  // working directory and not the git toplevel.
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  const card = parseCardRef(options.card, config.board);

  // REQ-EXP-011: before the network, and before anything is written. Refusing
  // after collecting would already have paid the cost the refusal exists to
  // avoid.
  const declared = loadChangeFrontmatter(
    changePath(root, options.change),
    `.specd/changes/${options.change}`,
  ).frontmatter?.card;
  assertCardMatchesChange(card, declared, options.change);

  const directory = bundlePath(root, options.change);
  mkdirSync(directory, { recursive: true });

  const ctx: CollectorContext = { root, card, config };
  const sources: ManifestSource[] = [];
  for (const source of config.explore.sources) {
    sources.push(await collectOne(source, ctx, root, options.change));
  }

  const manifest: ExploreManifest = {
    version: 1,
    change: options.change,
    card: {
      id: card.id,
      ...(card.provider === undefined ? {} : { provider: card.provider }),
      ...(card.project === undefined ? {} : { project: card.project }),
      ...(card.url === undefined ? {} : { url: card.url }),
    },
    collectedAt: (options.now ?? new Date()).toISOString(),
    usable: requiredFailures(sources).length === 0,
    collected: collectionExtent(sources),
    sources,
  };

  // REQ-EXP-003: the manifest is written before the failure is raised, so a
  // blocked run still leaves the record of what was collected.
  const path = manifestPath(root, options.change);
  writeManifest(path, manifest);

  assertRequiredSources(manifest);

  return {
    manifest,
    manifestPath: path,
    bundlePath: directory,
    notesPath: notesPath(root, options.change),
  };
}

// REQ-EXP-012 — How much of the declared collection succeeded.
//
// `usable` answers "did anything declared as required fail", which is vacuously
// true when nothing was declared at all — a bundle that never tried to collect
// reports the same value as one that collected everything. This answers the
// question that was missing.
export function collectionExtent(
  sources: readonly ManifestSource[],
): CollectionExtent {
  const ok = sources.filter((source) => source.status === "ok");
  if (ok.length === 0) return "none";
  return ok.length === sources.length ? "all" : "partial";
}

// REQ-EXP-003 — Required sources gate the bundle.
//
// A required source that failed means the work must not start; the command
// exits non-zero and the bundle is not marked usable. An optional source that
// failed is recorded and ignored.
export function assertRequiredSources(manifest: ExploreManifest): void {
  const failed = requiredFailures(manifest.sources);
  if (failed.length === 0) return;
  throw new ExploreError(
    `Required source${failed.length === 1 ? "" : "s"} failed to collect; the bundle is not usable:\n` +
      failed
        .map(
          (source) =>
            `  - ${source.name} (${source.type}): ${source.error ?? "unknown error"}`,
        )
        .join("\n"),
  );
}

export class ExploreError extends Error {
  // Operational, never a gate verdict: only `verify` returns 1 (REQ-CLI-004).
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = "ExploreError";
  }
}

function requiredFailures(
  sources: readonly ManifestSource[],
): ManifestSource[] {
  return sources.filter(
    (source) => source.required && source.status === "failed",
  );
}

async function collectOne(
  source: ExploreSource,
  ctx: CollectorContext,
  root: string,
  change: string,
): Promise<ManifestSource> {
  const required = source.required ?? false;
  const collector = COLLECTORS[source.type];
  const entry: ManifestSource = {
    name: source.name,
    type: source.type,
    required,
    status: "failed",
  };

  try {
    const payload = await collector.collect(source, ctx);
    // REQ-EXP-005: redaction happens here, between collection and the write.
    // The redacted value is what gets serialized; the raw one never reaches a
    // file descriptor.
    const safe = redactPayload(payload, source.redact ?? []);
    const output = sourcePath(root, change, source.name);
    writeFileSync(output, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
    return {
      ...entry,
      status: "ok",
      output: relative(bundlePath(root, change), output),
    };
  } catch (cause) {
    return {
      ...entry,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
