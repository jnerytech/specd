import { parseDocument, YAMLParseError } from "yaml";
import { SyncError } from "./errors.js";

// REQ-SYNC-007 — The link lives in the spec frontmatter.
//
// The link lives next to the thing it links. A file on the side drifts, gets
// lost, and turns "is this requirement on the board?" into a lookup in a second
// place nobody remembers to version.
//
// A missing link means never synced. That is a different answer from "synced
// and unchanged", and the two are never collapsed into one — absence-is-not-compliance again, this
// time in the file format.
export interface BoardLink {
  // Board identifier, as a string. Board ids are opaque, not arithmetic.
  ref: string;
  url: string;
  // ISO-8601 instant of the last sync that actually moved content.
  synced_at: string;
  synced_hash: string;
}

export const BOARD_LINK_KEY = "board";
const LINK_FIELDS = ["ref", "url", "synced_at", "synced_hash"] as const;
const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---[ \t]*\r?\n?)/;

export function readBoardLinks(
  source: string,
  file = "<memory>",
): Record<string, BoardLink> {
  const front = splitFrontmatter(source, file);
  const document = parseFront(front.yaml, file);
  const raw = document.toJS() as Record<string, unknown> | null;
  const board = raw?.[BOARD_LINK_KEY];
  if (board === undefined || board === null) return {};

  if (typeof board !== "object" || Array.isArray(board)) {
    throw new SyncError(
      `${file}: frontmatter key "${BOARD_LINK_KEY}" is not a mapping of item key to link. ` +
        `specd will not overwrite something it cannot read.`,
    );
  }

  const links: Record<string, BoardLink> = {};
  for (const [key, value] of Object.entries(board as Record<string, unknown>)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new SyncError(
        `${file}: board link for "${key}" is not a mapping declaring ${LINK_FIELDS.join(", ")}.`,
      );
    }
    const entry = value as Record<string, unknown>;
    const missing = LINK_FIELDS.filter(
      (field) => typeof entry[field] !== "string",
    );
    if (missing.length > 0) {
      throw new SyncError(
        `${file}: board link for "${key}" is missing ${missing.map((f) => `"${f}"`).join(", ")}. ` +
          `A half-written link is not a link — delete it to resync from scratch.`,
      );
    }
    links[key] = {
      ref: entry["ref"] as string,
      url: entry["url"] as string,
      synced_at: entry["synced_at"] as string,
      synced_hash: entry["synced_hash"] as string,
    };
  }
  return links;
}

// Rewrites only the frontmatter, and only the `board` key inside it.
//
// The body is spliced back byte for byte rather than re-rendered: this file
// holds the contract, and a formatter run disguised as a sync is how a diff
// stops being reviewable. Comments and key order in the frontmatter survive
// because the YAML document is edited in place instead of rebuilt from JS.
export function writeBoardLinks(
  source: string,
  links: Record<string, BoardLink>,
  file = "<memory>",
): string {
  const front = splitFrontmatter(source, file);
  const document = parseFront(front.yaml, file);

  const keys = Object.keys(links).sort();
  if (keys.length === 0) {
    document.delete(BOARD_LINK_KEY);
  } else {
    const ordered: Record<string, BoardLink> = {};
    for (const key of keys) ordered[key] = links[key] as BoardLink;
    document.set(BOARD_LINK_KEY, ordered);
  }

  const rendered = document.toString().replace(/\n+$/, "");
  return `${front.open}${rendered}${front.close}${front.body}`;
}

interface SplitDocument {
  open: string;
  yaml: string;
  close: string;
  body: string;
}

function splitFrontmatter(source: string, file: string): SplitDocument {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    throw new SyncError(
      `${file}: no YAML frontmatter, so there is nowhere to record the board link.`,
    );
  }
  return {
    open: match[1] as string,
    yaml: match[2] as string,
    close: match[3] as string,
    body: source.slice((match[0] as string).length),
  };
}

function parseFront(
  yaml: string,
  file: string,
): ReturnType<typeof parseDocument> {
  try {
    const document = parseDocument(yaml);
    if (document.errors.length > 0) {
      throw new SyncError(
        `${file}: malformed YAML frontmatter — ${document.errors[0]?.message}`,
      );
    }
    return document;
  } catch (cause) {
    if (cause instanceof SyncError) throw cause;
    throw new SyncError(
      `${file}: malformed YAML frontmatter — ${
        cause instanceof YAMLParseError
          ? (cause.message.split("\n")[0] as string)
          : String(cause)
      }`,
    );
  }
}
