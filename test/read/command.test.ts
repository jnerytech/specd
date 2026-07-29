import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.js";
import { EXIT } from "../../src/cli/exit-codes.js";
import { read } from "../../src/read/index.js";
import {
  capability,
  cleanupWorkspaces,
  makeWorkspace,
} from "../verify/helpers.js";

afterEach(cleanupWorkspaces);

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (text: string) => out.push(text),
    stderr: (text: string) => err.push(text),
    cwd: process.cwd(),
  };
}

// End to end, and without `--open`: nothing is launched, which is exactly the
// state the default is supposed to be in.
describe("read — REQ-READ-006", () => {
  it("serves the default selection and answers over HTTP", async () => {
    const { root } = makeWorkspace({
      specs: { cli: capability({ name: "cli", id: "REQ-CLI-001" }) },
      files: { ".specd/changes/2026-07-open/delta.md": "# Delta\n" },
    });

    const session = await read({
      cwd: root,
      paths: [],
      all: false,
      full: false,
      port: 0,
    });

    try {
      expect(session.files).toBe(2);
      expect(session.url).toContain("127.0.0.1");

      const body = await (await fetch(session.url)).text();
      expect(body).toContain('<h2 class="file">.specd/specs/cli.md</h2>');
      expect(body).toContain(
        '<h2 class="file">.specd/changes/2026-07-open/delta.md</h2>',
      );
    } finally {
      await session.close();
    }
  });

  it("serves an explicit path from outside any specd project", async () => {
    const { root } = makeWorkspace({ files: { "docs/a.md": "# Alpha\n" } });

    const session = await read({
      cwd: root,
      paths: ["docs"],
      all: false,
      full: false,
      port: 0,
    });

    try {
      const body = await (await fetch(session.url)).text();
      expect(body).toContain("<h1>Alpha</h1>");
    } finally {
      await session.close();
    }
  });
});

describe("specd read on the CLI", () => {
  it("answers --help without serving anything", async () => {
    const cli = io();
    const code = await main(["read", "--help"], cli);

    expect(code).toBe(EXIT.OK);
    expect(cli.out.join("")).toContain("specd read [path...]");
    expect(cli.out.join("")).toContain("--open");
  });

  it("appears in the top-level command list", async () => {
    const cli = io();
    await main(["--help"], cli);

    expect(cli.out.join("")).toContain("read");
  });

  // REQ-CLI-011: refusing an option names the help the reader would have asked
  // for, rather than making them guess the shape of the command.
  it("refuses an unknown option, and a port that is not one", async () => {
    const unknown = io();
    expect(await main(["read", "--speech"], unknown)).toBe(
      EXIT.OPERATIONAL_FAILURE,
    );
    expect(unknown.err.join("")).toContain("--speech");
    expect(unknown.err.join("")).toContain("specd read [path...]");

    const badPort = io();
    expect(await main(["read", "--port", "no"], badPort)).toBe(
      EXIT.OPERATIONAL_FAILURE,
    );
    expect(badPort.err.join("")).toContain("between 0 and 65535");
  });

  // REQ-CLI-001: only `verify` returns 1. A path that does not exist is the
  // tool unable to act, not a verdict on the spec.
  it("exits 2, never 1, when the path does not exist", async () => {
    const cli = io();
    const code = await main(["read", "definitely/not/here"], cli);

    expect(code).toBe(EXIT.OPERATIONAL_FAILURE);
    expect(cli.err.join("")).toContain("definitely/not/here");
  });
});
