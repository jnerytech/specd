import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EPHEMERAL_PORT,
  LOOPBACK,
  serveDocument,
} from "../../src/read/server.js";

const DOCUMENT = '<!doctype html>\n<html lang="pt-BR"><body>hi</body></html>\n';

// Port 0 asks the OS for a free one, so the suite never fights itself or the
// developer's own `specd read` for a fixed number.
async function serving<T>(run: (url: string) => Promise<T>): Promise<T> {
  const served = await serveDocument(DOCUMENT, { port: 0 });
  try {
    return await run(served.url);
  } finally {
    await served.close();
  }
}

describe("serveDocument — REQ-READ-005", () => {
  it("serves the document at the root", async () => {
    const body = await serving(async (url) => {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      return response.text();
    });

    expect(body).toBe(DOCUMENT);
  });

  it("answers 404 anywhere else, with no filesystem route to reach", async () => {
    const statuses = await serving(async (url) =>
      Promise.all(
        [
          "file/README.md",
          "../package.json",
          "%2e%2e%2fpackage.json",
          "docs",
        ].map(async (path) => (await fetch(new URL(path, url))).status),
      ),
    );

    expect(statuses).toEqual([404, 404, 404, 404]);
  });

  it("binds loopback, and nothing else", () => {
    expect(LOOPBACK).toBe("127.0.0.1");

    // The constant is the whole guard, so the source is asserted too: a bind
    // widened to every interface is invisible on screen and publishes a private
    // repository's spec to the local network. Comments are stripped first, so
    // that prose naming the address it forbids does not trip the check.
    const source = readFileSync(
      join(process.cwd(), "src", "read", "server.ts"),
      "utf-8",
    ).replace(/^\s*\/\/.*$/gm, "");

    expect(source).toMatch(/\.listen\(port, LOOPBACK,/);
    expect(source).not.toMatch(/["'`]0\.0\.0\.0["'`]/);
    expect(source).not.toMatch(/["'`]::["'`]/);
  });

  it("refuses a port already in use, naming the flag that moves it", async () => {
    const first = await serveDocument(DOCUMENT, { port: 0 });
    try {
      await expect(
        serveDocument(DOCUMENT, { port: first.port }),
      ).rejects.toThrow(/--port/);
    } finally {
      await first.close();
    }
  });

  it("frees the port on close", async () => {
    const first = await serveDocument(DOCUMENT, { port: 0 });
    const { port } = first;
    await first.close();

    const second = await serveDocument(DOCUMENT, { port });
    expect(second.port).toBe(port);
    await second.close();
  });
});

describe("EPHEMERAL_PORT — REQ-READ-009", () => {
  it("is zero, which asks the operating system rather than drawing lots", () => {
    expect(EPHEMERAL_PORT).toBe(0);
  });

  // The case the requirement exists for: the spec in one terminal, a folder of
  // notes in the other.
  it("lets two instances serve at once, on different ports", async () => {
    const first = await serveDocument(DOCUMENT, { port: EPHEMERAL_PORT });
    const second = await serveDocument(DOCUMENT, { port: EPHEMERAL_PORT });

    try {
      expect(first.port).not.toBe(second.port);
      expect(first.port).toBeGreaterThan(0);
      expect(second.port).toBeGreaterThan(0);

      const bodies = await Promise.all(
        [first, second].map(async (s) => (await fetch(s.url)).text()),
      );
      expect(bodies).toEqual([DOCUMENT, DOCUMENT]);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it("still binds exactly the port that was asked for", async () => {
    const probe = await serveDocument(DOCUMENT, { port: EPHEMERAL_PORT });
    const { port } = probe;
    await probe.close();

    const pinned = await serveDocument(DOCUMENT, { port });
    expect(pinned.port).toBe(port);
    await pinned.close();
  });
});
