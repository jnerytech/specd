import type { ExploreSource } from "../../config/schema.js";
import { resolveToken } from "../../config/credentials.js";
import {
  SourceConfigError,
  type Collector,
  type CollectorContext,
} from "./types.js";

export interface HttpPayload {
  url: string;
  status: number;
  contentType: string | null;
  body: unknown;
}

// Explore is allowed to reach the network — the gate is not (P3). Nothing in
// this module is reachable from `verify()`; the architecture tests enforce it.
export const httpCollector: Collector = {
  type: "http",
  collect(source: ExploreSource, _ctx: CollectorContext): Promise<HttpPayload> {
    const url = source.url;
    if (url === undefined) {
      throw new SourceConfigError(source, 'requires "url".');
    }
    return fetchJson(url, authHeaders(source));
  },
};

// REQ-CFG-003: the token is read from the environment variable the source
// names, never from the configuration file, and a missing variable fails before
// the request is made.
export function authHeaders(
  source: Pick<ExploreSource, "token_env">,
  fallbackTokenEnv?: string,
): Record<string, string> {
  const tokenEnv = source.token_env ?? fallbackTokenEnv;
  if (tokenEnv === undefined) return {};
  return { authorization: `Bearer ${resolveToken(tokenEnv)}` };
}

export async function fetchJson(
  url: string,
  headers: Record<string, string>,
  init: RequestInit = {},
): Promise<HttpPayload> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  const contentType = response.headers.get("content-type");
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `GET ${url} responded ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
    );
  }

  return {
    url,
    status: response.status,
    contentType,
    // A source that does not return JSON is still worth keeping; the raw text
    // is preserved rather than discarded on a parse error.
    body: parseJson(text),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
