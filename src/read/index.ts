import { requireProjectRoot } from "../core/root.js";
import { collectDefault, collectPaths } from "./collect.js";
import { buildDocument } from "./document.js";
import { serveDocument, type ServedDocument } from "./server.js";

export { EPHEMERAL_PORT, openInBrowser } from "./server.js";

export interface ReadOptions {
  cwd: string;
  // Empty means the default selection under `.specd/`.
  paths: readonly string[];
  all: boolean;
  full: boolean;
  port: number;
}

export interface ReadSession extends ServedDocument {
  files: number;
}

// Wires the three halves together and hands back a running server. Waiting for
// the interrupt is the command's job, not this one's — a function that blocked
// until Ctrl-C could not be tested end to end.
export async function read(options: ReadOptions): Promise<ReadSession> {
  const files =
    options.paths.length > 0
      ? collectPaths(options.cwd, options.paths)
      : collectDefault(requireProjectRoot(options.cwd), { all: options.all });

  const html = buildDocument(files, { full: options.full });
  const served = await serveDocument(html, { port: options.port });

  // The word count lives in the document, where REQ-READ-003 puts it. Pulling
  // it back out of the rendered HTML would be the tool parsing its own output
  // to tell itself something it already knew.
  return { ...served, files: files.length };
}
