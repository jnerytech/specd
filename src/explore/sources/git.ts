import { spawnSync } from "node:child_process";
import type { ExploreSource } from "../../config/schema.js";
import {
  SourceConfigError,
  type Collector,
  type CollectorContext,
} from "./types.js";

export interface GitPayload {
  command: string[];
  stdout: string;
}

// The `git` source runs a read-only git command in the repository. It is the
// one collector that touches no network, which is why it is also the one that
// always works offline.
export const gitCollector: Collector = {
  type: "git",
  collect(source: ExploreSource, ctx: CollectorContext): Promise<GitPayload> {
    const args = source.args;
    if (args === undefined || args.length === 0) {
      throw new SourceConfigError(
        source,
        'requires "args", the git command to run, e.g. args = ["log", "--oneline", "-20"].',
      );
    }

    const result = spawnSync("git", args, {
      cwd: ctx.root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `git ${args.join(" ")} exited with code ${result.status}: ${(result.stderr ?? "").trim()}`,
      );
    }

    return Promise.resolve({
      command: ["git", ...args],
      stdout: result.stdout,
    });
  },
};
