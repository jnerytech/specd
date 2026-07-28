import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SourceType } from "../config/schema.js";

export type SourceStatus = "ok" | "failed" | "skipped";

// REQ-EXP-004 — Manifest records per-source status.
export interface ManifestSource {
  name: string;
  type: SourceType;
  required: boolean;
  status: SourceStatus;
  // Bundle-relative path of the collected payload; absent when nothing was
  // written.
  output?: string;
  // Why the source failed, when it did.
  error?: string;
}

export interface ExploreManifest {
  // Manifest format version, so a later reader can tell shapes apart.
  version: 1;
  change: string;
  card: { id: string; provider?: string; project?: string; url?: string };
  // ISO-8601 instant the collection finished.
  collectedAt: string;
  // True when every required source reported `ok` (REQ-EXP-003). The
  // provenance layer reads this.
  usable: boolean;
  sources: ManifestSource[];
}

// REQ-EXP-003: the manifest is written even when the command fails, and it
// carries the real status of every source. A failed run that leaves no trace
// forces the next person to guess what was collected.
export function writeManifest(path: string, manifest: ExploreManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
