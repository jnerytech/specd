import { OperationalError } from "../core/operational.js";
// REQ-EXP-001 — Card identifier or URL.
export interface CardRef {
  // The card identifier, however it was supplied.
  id: string;
  // Board project the card belongs to. From configuration for a bare
  // identifier, from the address itself for a URL.
  project?: string;
  provider?: string;
  // Present only when the argument was a URL.
  url?: string;
}

export interface BoardContext {
  provider?: string;
  project?: string;
}

// Hostname to provider name for the boards whose URL layout is well known.
// Anything else keeps its hostname, which is still a usable provider label.
const KNOWN_HOSTS: Readonly<Record<string, string>> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "linear.app": "linear",
  "trello.com": "trello",
};

// Path segments that introduce a card rather than identify one.
const CONTAINER_SEGMENTS = new Set([
  "issues",
  "issue",
  "pull",
  "merge_requests",
  "cards",
  "card",
  "browse",
  "tickets",
  "c",
  "b",
]);

// REQ-EXP-011 — A card that contradicts the change stops the run.
//
// Collecting the context of one card into the change of another is the cheapest
// way to produce a bundle that justifies work nobody asked for. Neither side is
// corrected: both were written by a person, and choosing which one is right is
// guessing (no-guessing-on-conflict).
//
// Comparison is by identifier, which is what `parseCardRef` extracts from a URL
// too, plus a direct URL match. The same card cited in both forms is not a
// conflict.
export function assertCardMatchesChange(
  card: CardRef,
  declared: { ref: string; url: string } | undefined,
  change: string,
): void {
  if (declared === undefined) return;
  if (card.id === declared.ref) return;
  if (card.url !== undefined && card.url === declared.url) return;

  throw new OperationalError(
    `Change "${change}" declares card ${declared.ref} (${declared.url}), ` +
      `and this run names ${card.id}${card.url === undefined ? "" : ` (${card.url})`}.\n` +
      `specd will not choose between them: fix the argument, or fix "card" in the ` +
      `change's proposal.md.`,
  );
}

// Parses the argument of `specd explore`: either a bare board identifier,
// resolved against `board.project`, or a URL whose provider and identifier come
// from the address itself.
export function parseCardRef(input: string, board: BoardContext = {}): CardRef {
  const raw = input.trim();
  if (raw.length === 0) {
    throw new Error("Card reference is empty; pass an identifier or a URL.");
  }

  const url = asUrl(raw);
  if (url === undefined) {
    return {
      id: raw,
      ...(board.project === undefined ? {} : { project: board.project }),
      ...(board.provider === undefined ? {} : { provider: board.provider }),
    };
  }

  const host = url.hostname.replace(/^www\./, "");
  const segments = url.pathname.split("/").filter((part) => part.length > 0);
  return {
    id: identifierFrom(segments, url),
    ...(projectFrom(segments) === undefined
      ? {}
      : { project: projectFrom(segments) as string }),
    provider: KNOWN_HOSTS[host] ?? host,
    url: url.toString(),
  };
}

function asUrl(raw: string): URL | undefined {
  if (!/^https?:\/\//i.test(raw)) return undefined;
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

// The identifier is the last segment that is not a container word. A trailing
// slug ("123-fix-login") keeps its leading number, which is what boards use.
function identifierFrom(segments: string[], url: URL): string {
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i] as string;
    if (CONTAINER_SEGMENTS.has(segment)) continue;
    return decodeURIComponent(segment);
  }
  // A board that carries the card in the query string, e.g. ?card=ABC-1.
  const query = url.searchParams.get("card") ?? url.searchParams.get("id");
  if (query !== null) return query;
  throw new Error(
    `Could not read a card identifier from "${url.toString()}"; pass the identifier directly.`,
  );
}

// The project is the segment just before the container word, when there is one:
// `/acme/board/issues/42` yields "board".
function projectFrom(segments: string[]): string | undefined {
  const containerIndex = segments.findIndex((segment) =>
    CONTAINER_SEGMENTS.has(segment),
  );
  if (containerIndex <= 0) return undefined;
  return segments[containerIndex - 1];
}
