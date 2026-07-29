import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRedmineAdapter } from "../../src/sync/adapters/redmine.js";
import { SyncError } from "../../src/sync/errors.js";

const REF = { id: "7", url: "http://board.invalid/issues/7" };

const STATUSES = {
  issue_statuses: [
    { id: 1, name: "Em curso", is_closed: false },
    { id: 4, name: "Em homologação", is_closed: false },
    { id: 5, name: "Fechada", is_closed: true },
  ],
};

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

// Answers `GET /issues/7.json` with whatever status the board "applied",
// which is the whole point: a 204 on the PUT is not evidence that it landed.
function board(options: { applied: number }) {
  const calls: Call[] = [];
  const fetchStub = vi.fn(
    (url: string | URL, init?: { method?: string; body?: string }) => {
      const path = new URL(String(url)).pathname;
      calls.push({
        method: init?.method ?? "GET",
        path,
        ...(init?.body === undefined
          ? {}
          : { body: JSON.parse(init.body) as unknown }),
      });

      if (path === "/issue_statuses.json") return json(STATUSES);
      if (path === "/issues/7.json" && (init?.method ?? "GET") === "GET") {
        const status = STATUSES.issue_statuses.find(
          (s) => s.id === options.applied,
        );
        return json({ issue: { id: 7, subject: "x", status } });
      }
      // Redmine answers a PUT with 204 and an empty body.
      return Promise.resolve(
        new Response(null, { status: 204 }) as unknown as Response,
      );
    },
  );
  return { calls, fetchStub };
}

function json(payload: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function adapter() {
  return createRedmineAdapter({
    baseUrl: "http://board.invalid",
    project: "demo",
    tokenEnv: "SPECD_TEST_TOKEN",
    closedStatus: "Fechada",
  });
}

const original = globalThis.fetch;

beforeEach(() => {
  process.env["SPECD_TEST_TOKEN"] = "token";
});

afterEach(() => {
  globalThis.fetch = original;
  delete process.env["SPECD_TEST_TOKEN"];
});

// REQ-SYNC-017 — An archival transition is declared and proved.
describe("redmine transition — REQ-SYNC-017", () => {
  it("moves the item to the named status and reads it back", async () => {
    const { calls, fetchStub } = board({ applied: 4 });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    await adapter().transition(REF, "Em homologação", "archived");

    const put = calls.find((call) => call.method === "PUT");
    expect(put?.body).toEqual({
      issue: { status_id: 4, notes: "archived" },
    });
    // The reread is not optional: it is what turns a 204 into evidence.
    expect(
      calls.filter(
        (call) => call.method === "GET" && call.path.endsWith("/7.json"),
      ),
    ).toHaveLength(1);
  });

  it("fails when the board accepts the write and does not apply it", async () => {
    const { fetchStub } = board({ applied: 1 });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    await expect(
      adapter().transition(REF, "Em homologação", "archived"),
    ).rejects.toThrowError(/accepted the transition and did not apply it/);
  });

  it("refuses a status the board does not have, listing the ones it has", async () => {
    const { fetchStub } = board({ applied: 4 });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    const failure = await adapter()
      .transition(REF, "Aguardando Deploy", "archived")
      .catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(SyncError);
    expect((failure as Error).message).toContain("Em homologação");
  });

  it("does not close the item: the transition target is the one asked for", async () => {
    const { calls, fetchStub } = board({ applied: 4 });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    await adapter().transition(REF, "Em homologação", "archived");

    const put = calls.find((call) => call.method === "PUT");
    expect(
      (put?.body as { issue: { status_id: number } }).issue.status_id,
    ).toBe(4);
  });
});
