import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { error, type Diagnostic } from "./diagnostics.js";
import { readFrontmatter } from "./frontmatter.js";

// Where the change declares who it serves. The board link of a requirement
// lives in the spec frontmatter (REQ-SYNC-007) and is per item; nothing said
// which card the change itself was born from.
export interface ChangeCard {
  // Board identifier, as a string. Board ids are opaque, not arithmetic.
  ref: string;
  url: string;
}

export interface ChangeFrontmatter {
  change: string;
  status: string;
  card?: ChangeCard;
}

export interface ParsedChange {
  frontmatter?: ChangeFrontmatter;
  diagnostics: Diagnostic[];
}

// REQ-FMT-011 — Change frontmatter declares its board card.
//
// Declared as data for the same reason as TaskFrontmatterSchema: the diagnostic
// can name every field the reader expected, and a rejected change is fixable
// without opening the source.
export const ChangeFrontmatterSchema = {
  file: "proposal.md",
  required: ["change", "status"] as const,
  cardFields: ["ref", "url"] as const,
} as const;

export function parseChangeFrontmatter(
  source: string,
  file: string,
): ParsedChange {
  const diagnostics: Diagnostic[] = [];

  const front = readFrontmatter(source, file, "change", diagnostics);
  if (front === undefined) return { diagnostics };

  const missing = ChangeFrontmatterSchema.required.filter(
    (field) => front.fields[field] === undefined,
  );
  if (missing.length > 0) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          `Change frontmatter is missing ${missing.map((f) => `"${f}"`).join(", ")}. ` +
          `A change declares ${ChangeFrontmatterSchema.required.join(", ")}.`,
      }),
    );
    return { diagnostics };
  }

  const change = front.fields["change"];
  const status = front.fields["status"];
  if (typeof change !== "string" || typeof status !== "string") {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: '"change" and "status" must be strings.',
      }),
    );
    return { diagnostics };
  }

  const card = readCard(front.fields["card"], file, diagnostics);
  if (card === null) return { diagnostics };

  return {
    frontmatter: {
      change,
      status,
      ...(card === undefined ? {} : { card }),
    },
    diagnostics,
  };
}

// Reads the `proposal.md` of a change directory. A change without one is
// rejected: the delta says what changes and the proposal says why, and a change
// nobody argued for is work the repository cannot review.
export function loadChangeFrontmatter(
  directory: string,
  display: string,
): ParsedChange {
  const path = join(directory, ChangeFrontmatterSchema.file);
  const file = `${display}/${ChangeFrontmatterSchema.file}`;
  if (!existsSync(path)) {
    return {
      diagnostics: [
        error({
          file,
          line: 1,
          message:
            `Change "${display}" has no ${ChangeFrontmatterSchema.file}. ` +
            `A change declares ${ChangeFrontmatterSchema.required.join(", ")} in its frontmatter there.`,
        }),
      ],
    };
  }
  return parseChangeFrontmatter(readFileSync(path, "utf8"), file);
}

// `undefined` is "no card declared", `null` is "declared and unreadable". The
// two are never collapsed: a half-written card is not a card, which is the same
// rule readBoardLinks holds the spec frontmatter to.
function readCard(
  raw: unknown,
  file: string,
  diagnostics: Diagnostic[],
): ChangeCard | undefined | null {
  if (raw === undefined || raw === null) return undefined;

  if (typeof raw !== "object" || Array.isArray(raw)) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: `"card" must be a mapping declaring ${ChangeFrontmatterSchema.cardFields.join(", ")}.`,
      }),
    );
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const missing = ChangeFrontmatterSchema.cardFields.filter(
    (field) => typeof entry[field] !== "string",
  );
  if (missing.length > 0) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          `"card" is missing ${missing.map((f) => `"${f}"`).join(", ")}. ` +
          `A card names the board item and where to read it; half of that is not a reference.`,
      }),
    );
    return null;
  }

  return { ref: entry["ref"] as string, url: entry["url"] as string };
}
