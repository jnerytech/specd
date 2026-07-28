import type { SourceType } from "../../config/schema.js";
import { boardCollector } from "./board.js";
import { gitCollector } from "./git.js";
import { httpCollector } from "./http.js";
import { mcpCollector } from "./mcp.js";
import type { Collector } from "./types.js";

// REQ-EXP-002 — Four source types.
//
// The map is the registry: a type declared in the TOML that is absent here
// cannot be collected, and the configuration schema rejects it at load time so
// the failure lands before any work starts.
export const COLLECTORS: Readonly<Record<SourceType, Collector>> = {
  board: boardCollector,
  git: gitCollector,
  mcp: mcpCollector,
  http: httpCollector,
};

export type { Collector, CollectorContext } from "./types.js";
export { SourceConfigError } from "./types.js";
