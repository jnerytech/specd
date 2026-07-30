import { requireProjectRoot } from "../core/root.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../config/errors.js";
import { resolveConfig } from "../config/resolve.js";
import {
  VERIFY_LEVELS,
  type SpecdConfig,
  type VerifyLevel,
} from "../config/schema.js";
import { OperationalError } from "../core/operational.js";
import { readOpenChanges } from "./changes.js";
import { effectiveSpecs } from "./effective.js";
import { anchorsLayer } from "./layers/anchors.js";
import { coverageLayer } from "./layers/coverage.js";
import { evidenceLayer } from "./layers/evidence.js";
import { projectLayer } from "./layers/project.js";
import { provenanceLayer } from "./layers/provenance.js";
import { schemaLayer } from "./layers/schema.js";
import type { VerifyLayer, VerifyLayerContext } from "./layers/types.js";
import type { LayerReport, VerifyReport, Violation } from "./report.js";

// REQ-VER-001: the order is fixed and not configurable. Only which layers run
// is configurable (REQ-VER-002).
//
// The order is `VERIFY_LEVELS` itself rather than a second list beside it. Two
// lists of the same six names is two chances to disagree, and the init template
// held a third that had already drifted.
export const LAYER_ORDER: readonly VerifyLevel[] = VERIFY_LEVELS;

// Every layer of LAYER_ORDER is implemented as of change `provenance-and-mcp-transport`. The map stays, and
// so does the check below: a layer named in the configuration but absent here
// must be a configuration error, never a silent pass — a gate that quietly
// skips a layer the project asked for is reporting a check it never ran.
export const IMPLEMENTED: Readonly<Record<string, VerifyLayer>> = {
  provenance: provenanceLayer,
  schema: schemaLayer,
  coverage: coverageLayer,
  anchors: anchorsLayer,
  evidence: evidenceLayer,
  project: projectLayer,
};

export interface VerifyOptions {
  cwd?: string;
  // REQ-VER-007.
  fast?: boolean;
  // Pre-resolved configuration; resolved from `cwd` when omitted.
  config?: SpecdConfig;
  globalPath?: string;
}

// REQ-CLI-001: the only command whose result is a quality gate.
//
// no-llm-in-decision-path/gate-no-network: nothing reachable from here touches a language model or the network.
// Enforced by the architecture tests in test/architecture/.
export async function verify(
  options: VerifyOptions = {},
): Promise<VerifyReport> {
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

  requireSpecdProject(root);

  const enabled = selectLayers(config.verify.levels);
  const ctx: VerifyLayerContext = {
    root,
    config,
    fast: options.fast ?? false,
    effective: effectiveSpecs(root, {
      pathsRelativeTo: root,
      changes: readOpenChanges(root),
    }),
  };

  const layers: LayerReport[] = [];
  const violations: Violation[] = [];
  let stoppedAt: VerifyLevel | undefined;
  let blocked: VerifyLevel | undefined;

  for (const layer of enabled) {
    const result = await layer.run(ctx);
    layers.push({ layer: layer.name, ...result });
    violations.push(...result.violations);
    // REQ-VER-013: a layer that could not run stops the pipeline like a failure
    // does, and is reported as a third thing — the gate reached no verdict.
    if (result.status === "blocked") {
      stoppedAt = layer.name;
      blocked = layer.name;
      break;
    }
    // REQ-VER-001: stop at the first failing layer.
    if (result.status === "failed") {
      stoppedAt = layer.name;
      break;
    }
  }

  return {
    ok: stoppedAt === undefined,
    layers,
    ...(stoppedAt === undefined ? {} : { stoppedAt }),
    ...(blocked === undefined ? {} : { blocked }),
    violations,
    disabled: LAYER_ORDER.filter(
      (level) => !config.verify.levels.includes(level),
    ),
  };
}

// A directory with nothing to check passes vacuously, and "green" then means
// the same as "I found no spec" — which is how a wrong working directory turns
// into a silent approval. Exit 2 and not 1: nothing was judged.
export function requireSpecdProject(root: string): void {
  if (existsSync(join(root, ".specd", "specs"))) return;
  throw new OperationalError(
    `No .specd/specs/ under ${root}, so there is nothing to verify. ` +
      `An empty check is not a passing check — run \`specd init\` if this is meant to be a specd project, ` +
      `or run verify from the repository root.`,
  );
}

// REQ-VER-002: run only the configured layers, always in LAYER_ORDER.
function selectLayers(levels: readonly VerifyLevel[]): VerifyLayer[] {
  if (levels.length === 0) {
    throw new ConfigError(
      'Invalid configuration: "verify.levels" is empty, so verify would check nothing.',
    );
  }
  const selected: VerifyLayer[] = [];
  for (const level of LAYER_ORDER) {
    if (!levels.includes(level)) continue;
    const layer = IMPLEMENTED[level];
    if (layer === undefined) {
      throw new ConfigError(
        `Invalid configuration: verify layer "${level}" is listed in verify.levels but is not implemented ` +
          `in this version. Implemented layers: ${Object.keys(IMPLEMENTED).join(", ")}.`,
      );
    }
    selected.push(layer);
  }
  return selected;
}
