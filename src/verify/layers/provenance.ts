import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SpecdConfig } from "../../config/schema.js";
import type { ExploreManifest } from "../../explore/manifest.js";
import { MANIFEST_FILE, BUNDLE_DIRECTORY } from "../../explore/paths.js";
import { error, type Diagnostic } from "../../parser/diagnostics.js";
import type { OpenChange } from "../changes.js";
import { resultFrom, type VerifyLayer } from "./types.js";

// REQ-VER-003 — Provenance layer.
//
// The guard condition is the whole point. As the requirement was first written
// it demanded `explore/manifest.json` from every change, which rejects any
// change that did not start from a board card — including the two that built
// this tool. Provenance is about the provenance a project said it wanted:
// a project declaring no required source asked for none.
//
// REQ-EXP-007: `draft.md` is never read here. The bundle is evidence of what
// was collected, not of what somebody concluded from it.
export const provenanceLayer: VerifyLayer = {
  name: "provenance",
  run(ctx) {
    const violations: Diagnostic[] = [];
    if (!requiresProvenance(ctx.config)) return Promise.resolve(resultFrom([]));

    for (const change of ctx.effective.changes) {
      violations.push(...checkChange(change));
    }
    return Promise.resolve(resultFrom(violations));
  },
};

// A project with no required source has not asked for provenance, so there is
// nothing to enforce. Written as its own predicate because it is the condition
// that kept this layer switched off for two slices.
export function requiresProvenance(config: SpecdConfig): boolean {
  return config.explore.sources.some((source) => source.required === true);
}

function checkChange(change: OpenChange): Diagnostic[] {
  const path = join(change.directory, BUNDLE_DIRECTORY, MANIFEST_FILE);
  const display = `${change.display}/${BUNDLE_DIRECTORY}/${MANIFEST_FILE}`;

  if (!existsSync(path)) {
    return [
      error({
        file: display,
        line: 1,
        message:
          `Change ${change.name} has no explore manifest, and this project declares at least one required source. ` +
          `Run \`specd explore\` for it, or drop the \`required\` flag from the sources that do not gate the work.`,
      }),
    ];
  }

  let manifest: ExploreManifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8")) as ExploreManifest;
  } catch (cause) {
    return [
      error({
        file: display,
        line: 1,
        message: `Explore manifest of ${change.name} is not readable JSON: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      }),
    ];
  }

  const findings: Diagnostic[] = [];
  for (const source of manifest.sources ?? []) {
    // A failed optional source does not reject: the run declared it could go
    // without that context, and the manifest keeps the record either way.
    if (source.required !== true || source.status === "ok") continue;
    findings.push(
      error({
        file: display,
        line: 1,
        message:
          `Required source "${source.name}" of change ${change.name} has status "${source.status}"` +
          `${source.error === undefined ? "" : `: ${source.error}`}. ` +
          `The bundle is incomplete, so the change rests on context that was never collected.`,
      }),
    );
  }
  return findings;
}
