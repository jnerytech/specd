import type {
  ExploreSource,
  SourceType,
  SpecdConfig,
} from "../../config/schema.js";
import type { CardRef } from "../card-ref.js";

export interface CollectorContext {
  root: string;
  card: CardRef;
  config: SpecdConfig;
}

export interface Collector {
  type: SourceType;
  // Returns the payload to persist. Throwing marks the source as failed; the
  // message reaches the manifest.
  collect(source: ExploreSource, ctx: CollectorContext): Promise<unknown>;
}

// A source misconfigured badly enough that the collector cannot even try.
export class SourceConfigError extends Error {
  constructor(source: ExploreSource, detail: string) {
    super(`Source "${source.name}" (${source.type}): ${detail}`);
    this.name = "SourceConfigError";
  }
}
