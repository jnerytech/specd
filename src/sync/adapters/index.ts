import type { SpecdConfig } from "../../config/schema.js";
import type { BoardAdapter } from "../adapter.js";
import { SyncError } from "../errors.js";
import { createRedmineAdapter } from "./redmine.js";

// The registry is the one place a vendor name turns into code. Everything above
// it works against `BoardAdapter` and nothing else (REQ-SYNC-002).
export const ADAPTERS = ["redmine"] as const;
export type AdapterName = (typeof ADAPTERS)[number];

export function createAdapter(config: SpecdConfig): BoardAdapter {
  const provider = config.board.provider;
  if (provider === undefined) {
    throw new SyncError(
      `No board provider configured. Set [board] provider to one of: ${ADAPTERS.join(", ")}.`,
    );
  }
  if (!ADAPTERS.includes(provider as AdapterName)) {
    throw new SyncError(
      `No adapter for board provider "${provider}". Adapters specd ships: ${ADAPTERS.join(", ")}.`,
    );
  }

  const missing = (
    [
      ["board.url", config.board.url],
      ["board.project", config.board.project],
      ["board.token_env", config.board.token_env],
    ] as const
  )
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new SyncError(
      `Board configuration is incomplete: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set.`,
    );
  }

  return createRedmineAdapter({
    baseUrl: config.board.url as string,
    project: config.board.project as string,
    tokenEnv: config.board.token_env as string,
    ...(config.board.mapping.closed_status === undefined
      ? {}
      : { closedStatus: config.board.mapping.closed_status }),
  });
}
