import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { platform } from "node:process";
import { OperationalError } from "../core/operational.js";

// REQ-READ-005: literal, and asserted by a test that fails if it changes.
//
// The difference from `0.0.0.0` is invisible on screen and total in effect: it
// publishes the spec of a private repository to whatever the local network can
// reach, and nothing in the command's output would say so.
export const LOOPBACK = "127.0.0.1";

export const DEFAULT_PORT = 4173;

export interface ServedDocument {
  url: string;
  port: number;
  close: () => Promise<void>;
}

// REQ-READ-005 — The server binds to loopback and serves from memory.
//
// Serving from memory is not an optimisation. It is what makes path traversal
// impossible by construction rather than impossible by correct sanitisation: a
// `/file/<path>` route has to get it right every time, and an absent route has
// nothing to get wrong. The document is one page, so the route is not needed.
export function serveDocument(
  html: string,
  options: { port: number },
): Promise<ServedDocument> {
  const server = createServer((request, response) => {
    if (request.url !== "/" && request.url !== "/index.html") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("specd read serves one document, at /.\n");
      return;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(html);
  });

  return listen(server, options.port);
}

function listen(server: Server, port: number): Promise<ServedDocument> {
  return new Promise((resolve, reject) => {
    server.once("error", (cause: NodeJS.ErrnoException) => {
      reject(
        cause.code === "EADDRINUSE"
          ? new OperationalError(
              `Port ${port} is already in use, so \`specd read\` has nowhere to serve. ` +
                `Free it, or choose another with \`--port <number>\`.`,
            )
          : new OperationalError(
              `Cannot serve on ${LOOPBACK}:${port}: ${cause.message}`,
            ),
      );
    });

    server.listen(port, LOOPBACK, () => {
      const address = server.address();
      const bound =
        typeof address === "object" && address !== null ? address.port : port;
      resolve({
        url: `http://${LOOPBACK}:${bound}/`,
        port: bound,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => {
              done();
            });
            // Sockets a browser is holding open would otherwise keep the
            // process alive after Ctrl-C, leaving the port taken by something
            // the user believes they stopped.
            server.closeAllConnections();
          }),
      });
    });
  });
}

// REQ-READ-006 — Opening the browser is asked for, never assumed.
//
// Launching an application outside the process is an operation that costs
// something, and costly-ops-are-not-silent says it names itself instead of
// happening on the side. The default prints the URL to click, which is the
// gesture that was asked for and already answers the case.
export function openInBrowser(url: string): Promise<void> {
  const [command, args] = opener(url);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      // Detached and unreferenced so the browser outlives nothing: the server
      // is what holds the process, not this.
      child.unref();
      resolve();
    });
  });
}

function opener(url: string): [string, string[]] {
  if (platform === "darwin") return ["open", [url]];
  if (platform === "win32") return ["cmd", ["/c", "start", "", url]];
  return ["xdg-open", [url]];
}
