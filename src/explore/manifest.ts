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

// REQ-EXP-012 — three states, because collected-everything, collected-some and
// collected-nothing are different facts. `none` covers "nothing was declared"
// and "everything failed" with one value: the source list below distinguishes
// them, and a fourth state nobody reads is a state nobody maintains.
export type CollectionExtent = "all" | "partial" | "none";

export interface ExploreManifest {
  // Manifest format version, so a later reader can tell shapes apart.
  version: 1;
  change: string;
  card: { id: string; provider?: string; project?: string; url?: string };
  // ISO-8601 instant the collection finished.
  collectedAt: string;
  // True when every required source reported `ok` (REQ-EXP-003). The
  // provenance layer reads this.
  //
  // It is vacuously true when nothing was declared: an empty list satisfies
  // "none failed". That is why REQ-EXP-012 exists beside it rather than
  // replacing it — `provenance` reads this field, and changing its meaning
  // would be a silent migration.
  usable: boolean;
  // REQ-EXP-012: how much of the declared collection succeeded.
  collected: CollectionExtent;
  sources: ManifestSource[];
}

// REQ-EXP-003: the manifest is written even when the command fails, and it
// carries the real status of every source. A failed run that leaves no trace
// forces the next person to guess what was collected.
export function writeManifest(path: string, manifest: ExploreManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
