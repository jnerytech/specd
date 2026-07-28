import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../config/errors.js";
import { resolveConfig } from "../config/resolve.js";
import type { SpecdConfig, VerifyLevel } from "../config/schema.js";
import { loadCapabilities } from "../parser/capability.js";
import { readActiveChange } from "./active-change.js";
import { anchorsLayer } from "./layers/anchors.js";
import { projectLayer } from "./layers/project.js";
import { schemaLayer } from "./layers/schema.js";
import type { VerifyLayer, VerifyLayerContext } from "./layers/types.js";
import type { LayerReport, VerifyReport, Violation } from "./report.js";

// REQ-VER-001: the order is fixed and not configurable. Only which layers run
// is configurable (REQ-VER-002).
export const LAYER_ORDER: readonly VerifyLevel[] = [
  "provenance",
  "schema",
  "coverage",
  "anchors",
  "evidence",
  "project",
] as const;

// Layers implemented in this version. A configured layer that is not here is a
// configuration error rather than a silent pass: a gate that quietly skips a
// layer the project asked for is reporting a check it never ran.
const IMPLEMENTED: Readonly<Record<string, VerifyLayer>> = {
  schema: schemaLayer,
  anchors: anchorsLayer,
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
// P1/P3: nothing reachable from here touches a language model or the network.
// Enforced by the architecture tests in test/architecture/.
export async function verify(
  options: VerifyOptions = {},
): Promise<VerifyReport> {
  const root = options.cwd ?? process.cwd();
  const config =
    options.config ??
    resolveConfig({
      cwd: root,
      ...(options.globalPath === undefined
        ? {}
        : { globalPath: options.globalPath }),
    });

  const enabled = selectLayers(config.verify.levels);
  const specsDir = join(root, ".specd", "specs");
  const activeChange = readActiveChange(root);
  const ctx: VerifyLayerContext = {
    root,
    config,
    fast: options.fast ?? false,
    specs: existsSync(specsDir)
      ? loadCapabilities(specsDir, { pathsRelativeTo: root })
      : { capabilities: [], diagnostics: [] },
    ...(activeChange === undefined ? {} : { activeChange }),
  };

  const layers: LayerReport[] = [];
  const violations: Violation[] = [];
  let stoppedAt: VerifyLevel | undefined;

  for (const layer of enabled) {
    const result = await layer.run(ctx);
    layers.push({ layer: layer.name, ...result });
    violations.push(...result.violations);
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
    violations,
    disabled: LAYER_ORDER.filter(
      (level) => !config.verify.levels.includes(level),
    ),
  };
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
