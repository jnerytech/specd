import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { ConfigError } from "./errors.js";
import {
  ConfigSchema,
  DEFAULT_CONFIG,
  validateConfig,
  type FieldSpec,
  type PartialConfig,
  type SpecdConfig,
} from "./schema.js";

export interface ResolveConfigOptions {
  // Workspace root containing `.specd/config.toml`. Defaults to process.cwd().
  cwd?: string;
  // Global configuration file. Defaults to `~/.specd/config.toml`.
  globalPath?: string;
  // Values coming from CLI flags — the highest-precedence source.
  flags?: PartialConfig;
}

// REQ-CFG-001: merge order is CLI flag > workspace file > global file >
// built-in default, applied field by field — a section defined in a higher
// source never wipes fields the lower sources set.
export function resolveConfig(options: ResolveConfigOptions = {}): SpecdConfig {
  const cwd = options.cwd ?? process.cwd();
  const globalPath =
    options.globalPath ?? join(homedir(), ".specd", "config.toml");
  const workspacePath = join(cwd, ".specd", "config.toml");

  const resolved = structuredClone(DEFAULT_CONFIG) as unknown as Record<
    string,
    unknown
  >;
  const layers = [loadFile(globalPath), loadFile(workspacePath), options.flags];
  for (const layer of layers) {
    if (layer) {
      mergeFields(resolved, layer as Record<string, unknown>, ConfigSchema);
    }
  }
  return resolved as unknown as SpecdConfig;
}

function loadFile(path: string): PartialConfig | undefined {
  if (!existsSync(path)) return undefined;
  let raw: unknown;
  try {
    raw = parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ConfigError(
      `Invalid TOML in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return validateConfig(raw, path);
}

// Field-by-field merge guided by the schema: sections recurse, every other
// kind (including arrays) is a leaf field replaced whole by a higher source.
function mergeFields(
  target: Record<string, unknown>,
  layer: Record<string, unknown>,
  fields: Record<string, FieldSpec>,
): void {
  for (const [key, spec] of Object.entries(fields)) {
    const value = layer[key];
    if (value === undefined) continue;
    if (spec.kind === "section") {
      target[key] ??= {};
      mergeFields(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
        spec.fields,
      );
    } else {
      target[key] = structuredClone(value);
    }
  }
}
