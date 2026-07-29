import { EXIT } from "../cli/exit-codes.js";

// Every failure of `sync` is operational (exit 2), never a gate verdict.
//
// P2 / REQ-CLI-004: only `verify` returns 1. A conflict between the spec and
// the board is content, but `sync` being unable to proceed is still the tool
// stopping, not the gate reproving — and CI has to keep telling those apart.
export class SyncError extends Error {
  readonly exitCode = EXIT.OPERATIONAL_FAILURE;

  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

// REQ-SYNC-011 — A board refusal is relayed verbatim, never interpreted.
//
// The Redmine 422 is `{"errors":["Cliente cannot be blank"]}`: prose localized
// by the instance's language, with no error code and no structured field name.
// Matching it by substring is fragile by construction and wrong on a pt-BR
// instance, so nothing here parses, translates or classifies it.
//
// The HTTP status is carried separately because it is the one part that *is*
// structured. The body is kept exactly as the server sent it, including empty.
export class BoardRefusedError extends SyncError {
  readonly status: number;
  readonly body: string;
  readonly item: string;

  constructor(item: string, status: number, body: string) {
    super(
      `${item}: the board refused the write with HTTP ${status}.\n` +
        `The server said, verbatim:\n` +
        `${quoteServer(body)}\n` +
        `specd does not interpret this message — read it and fix the item or the mapping.`,
    );
    this.name = "BoardRefusedError";
    this.status = status;
    this.body = body;
    this.item = item;
  }
}

// REQ-SYNC-010 — Unreadable field definitions refuse, never assume.
//
// P8 in its exact shape: "I could not check" is a third outcome, and it is
// never green. Measured, not assumed — Redmine's `/custom_fields.json` answers
// 403 with an empty body to an ordinary project member while `/trackers.json`
// answers 200 to the same token, so an adapter holding a real client's token
// reads the issue and cannot read what its fields mean.
//
// The alternative failure mode is the one worth naming: assume `string`, write
// a wrong value into a client's required field, and report success. Nobody
// investigates a success.
export class FieldDefinitionsUnavailableError extends SyncError {
  readonly status?: number;

  constructor(detail: string, fields: readonly string[], status?: number) {
    super(
      `Could not verify the board's field definitions${
        status === undefined ? "" : ` (HTTP ${status})`
      }: ${detail}\n` +
        `This is not the same as those fields being absent. specd does not know what ` +
        `they are, so it will not assume a format and writes nothing.\n` +
        `Fields the configuration depends on: ${fields.join(", ") || "(none named)"}.\n` +
        `Either grant the token permission to read the field definitions, or remove the ` +
        `[[board.fields]] entries that need them.`,
    );
    this.name = "FieldDefinitionsUnavailableError";
    if (status !== undefined) this.status = status;
  }
}

export interface OrphanReport {
  key: string;
  ref: string;
  url: string;
  // The identifier is listed as `retired`, so a death was declared. The link is
  // refused anyway, because the body reappeared under another identifier and a
  // declared death whose body reappeared is not less ambiguous than an
  // undeclared one — it is more.
  declared: boolean;
  // Planned items with no link yet whose body matches the board item's.
  candidates: string[];
}

// REQ-SYNC-015 — An orphan specd was not told to close stops the command.
//
// Two possible states — the requirement died, or it was renamed — and the
// difference is destructive in one direction. Closing a card discards the
// comment, the attachment and the logged hours somebody left on it, none of
// which the spec knows exist. P4: specd does not choose.
//
// The candidate is matched on the body, not on the whole projection. An item's
// title is derived from its identifier, so renaming changes the title by
// construction; comparing projections would never match in exactly the case
// this error exists to catch. The body is what survives a rename.
//
// The declared case reaches here too, and that is the Fatia 8 correction. A
// rename of an already realized requirement is written `REMOVED: REQ-002` plus
// `ADDED: REQ-009`, because the delta has no vocabulary for renaming — so the
// declaration does not distinguish the two readings, and trusting it there is
// reading intent where only vocabulary is missing.
export class UndeclaredOrphanError extends SyncError {
  readonly orphans: readonly OrphanReport[];

  constructor(orphans: readonly OrphanReport[]) {
    const one = orphans.length === 1;
    super(
      `${orphans.length} board link${one ? "" : "s"} no longer ` +
        `${one ? "has a" : "have a"} requirement in the spec, and specd was not told to close ` +
        `${one ? "it" : "them"}.\n` +
        orphans.map(describeOrphan).join("\n") +
        `\nspecd will not close a board item it was not told to close.\n` +
        `  - renamed: rename the key under \`board:\` in the capability frontmatter, and drop the\n` +
        `    identifier from \`retired\` if it is listed there\n` +
        `  - really gone, and no body reappeared: add the identifier to \`retired\` in that frontmatter\n` +
        `  - really gone, and a body did reappear: close the item on the board yourself and delete its\n` +
        `    entry from \`board:\` — by hand, because that is what makes the cost visible\n` +
        `Nothing was written, to either side.`,
    );
    this.name = "UndeclaredOrphanError";
    this.orphans = [...orphans];
  }
}

function describeOrphan(orphan: OrphanReport): string {
  const head = `  ${orphan.key} -> ${orphan.url} (ref ${orphan.ref})`;
  if (orphan.candidates.length === 0) return head;
  const names = orphan.candidates.join(", ");
  if (orphan.declared) {
    return (
      `${head}\n` +
      `      listed as retired, and the same body is now ${names} — a declared death whose ` +
      `body reappeared is still ambiguous`
    );
  }
  return (
    `${head}\n` +
    `      same body as ${names} — probably a rename, but specd does not decide that`
  );
}

function quoteServer(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "  (empty body)";
  return trimmed
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
