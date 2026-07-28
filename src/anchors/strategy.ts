import { extname } from "node:path";
import { ConfigError } from "../config/errors.js";
import type { AnchorStrategy } from "../config/schema.js";
import { grepStrategy } from "./strategies/grep.js";

export interface AnchorSearchStrategy {
  name: AnchorStrategy;
  // True when `content` contains the declaration `symbol` names.
  matches(content: string, symbol: string): boolean;
  // 1-based line of the first match, or undefined when there is none.
  find(content: string, symbol: string): number | undefined;
}

// REQ-ANC-004: extensions with a fixed mapping. Only formats that no language
// grammar would ever apply to are pinned here — everything else falls through
// to `anchors.default`, so a project can switch its code strategy without
// having to re-declare every data format.
export const EXTENSION_STRATEGIES: Readonly<Record<string, AnchorStrategy>> = {
  ".yml": "grep",
  ".yaml": "grep",
  ".json": "grep",
  ".toml": "grep",
  ".ini": "grep",
  ".cfg": "grep",
  ".md": "grep",
  ".txt": "grep",
  ".xml": "grep",
  ".csv": "grep",
};

// REQ-ANC-004: pick the strategy by file extension, falling back to the
// configured default when the extension has no mapping.
export function strategyFor(
  file: string,
  defaultStrategy: AnchorStrategy,
): AnchorSearchStrategy {
  const mapped = EXTENSION_STRATEGIES[extname(file).toLowerCase()];
  const selected = mapped ?? defaultStrategy;
  if (selected === "grep") return grepStrategy;
  // REQ-ANC-005: requesting treesitter is a configuration error, never a
  // silent downgrade to grep — a downgrade would make anchors resolve for the
  // wrong reason and report a green gate the project did not ask for.
  throw new ConfigError(
    `Anchor strategy "${selected}" requested for "${file}" is not available in this version: ` +
      `grep is the only strategy implemented. Set anchors.default = "grep" in .specd/config.toml.`,
  );
}
