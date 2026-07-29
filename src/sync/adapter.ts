// REQ-SYNC-002 — The adapter interface is the whole coupling surface.
//
// Nothing in this file names a vendor, an endpoint or an HTTP verb. Everything
// that does lives under `src/sync/adapters/`, and swapping one adapter for
// another touches neither the merge, the hash, the mapping nor the link.
//
// Six members, not four. The four writes were the design as asked, and they
// held: `link` stays separate because in Azure DevOps it is a real resource,
// while in Redmine it collapses to a three-line delegation to `update`. The
// generality sits on the side that needs it.
//
// The two reads are the gap the four did not cover, and there is no way around
// them: a three-way merge needs the remote state, and refusing honestly under
// absence-is-not-compliance needs the field definitions. Neither is an operation on the board's state,
// so neither belongs among the writes — but without them there is no merge and
// no honest refusal.

// A single-valued field is a string; a multi-valued one is an array. The board
// decides which, and the issue payload does not say — that is what
// `describeFields` is for.
export type FieldValue = string | string[];

export interface BoardFieldDefinition {
  id: number;
  name: string;
  // Vendor's own format token, kept as reported rather than mapped onto an
  // invented taxonomy.
  format: string;
  required: boolean;
  multiple: boolean;
}

// A field already resolved to both of its identities, so the adapter never has
// to look one up at write time (REQ-SYNC-009).
export interface BoundFieldValue {
  id: number;
  name: string;
  // `null` is the explicit "no value", distinct from the field being absent.
  value: FieldValue | null;
}

export interface BoardItemRef {
  // Vendor identifier, as a string: board ids are opaque, not arithmetic.
  id: string;
  url: string;
}

// The fields the spec owns. This shape is what gets hashed, so anything the
// board owns is deliberately absent from it (REQ-SYNC-003).
export interface BoardItemContent {
  title: string;
  body: string;
  parent?: BoardItemRef;
  fields: BoundFieldValue[];
}

export interface BoardItemDraft extends BoardItemContent {
  // Board item type, resolved from the level mapping.
  type: string;
}

export interface BoardItemSnapshot {
  ref: BoardItemRef;
  type: string;
  content: BoardItemContent;
  // Board-owned. Read so the report can show them; never written by `sync`.
  status?: string;
  assignee?: string;
  iteration?: string;
  // REQ-SYNC-013: a scan filter, never an input to a decision. Present so the
  // report can say why an item was fetched, not whether it changed.
  modifiedAt?: string;
}

export interface BoardAdapter {
  readonly provider: string;

  // --- writes ---------------------------------------------------------------
  create(draft: BoardItemDraft): Promise<BoardItemRef>;
  update(ref: BoardItemRef, content: BoardItemContent): Promise<void>;
  link(child: BoardItemRef, parent: BoardItemRef): Promise<void>;
  close(ref: BoardItemRef, reason: string): Promise<void>;
  // REQ-SYNC-017: move the item to a named status and prove it landed. Kept
  // apart from `close` on purpose — a transition says the work reached a stage,
  // a close says it ended, and one function serving both erases the difference
  // for every board that has anything between "in progress" and "done".
  transition(ref: BoardItemRef, status: string, notes: string): Promise<void>;

  // --- reads ----------------------------------------------------------------
  // `undefined` when the item is gone: deleted on the board is not the same as
  // unchanged, and the caller has to be able to tell.
  read(ref: BoardItemRef): Promise<BoardItemSnapshot | undefined>;
  // Throws FieldDefinitionsUnavailableError when it cannot answer. Returning an
  // empty list would be the absence-is-not-compliance failure this interface exists to prevent.
  describeFields(): Promise<BoardFieldDefinition[]>;
}
