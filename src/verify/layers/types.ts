import type { SpecdConfig, VerifyLevel } from "../../config/schema.js";
import type { LoadedCapabilities } from "../../parser/capability.js";
import type { ActiveChange } from "../active-change.js";
import type { LayerStatus, Violation } from "../report.js";

export interface VerifyLayerContext {
  // Repository root every path is resolved from.
  root: string;
  config: SpecdConfig;
  // REQ-VER-007: set by `--fast`.
  fast: boolean;
  // Capabilities parsed once and shared by every layer.
  specs: LoadedCapabilities;
  activeChange?: ActiveChange;
}

export interface LayerResult {
  status: LayerStatus;
  violations: Violation[];
  // Project layer only.
  command?: string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface VerifyLayer {
  name: VerifyLevel;
  run(ctx: VerifyLayerContext): Promise<LayerResult>;
}

export function resultFrom(violations: Violation[]): LayerResult {
  return {
    status: violations.some((v) => v.severity === "error")
      ? "failed"
      : "passed",
    violations,
  };
}
