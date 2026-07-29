import { resolveToken } from "../../config/credentials.js";
import type {
  BoardAdapter,
  BoardFieldDefinition,
  BoardItemContent,
  BoardItemDraft,
  BoardItemRef,
  BoardItemSnapshot,
  BoundFieldValue,
  FieldValue,
} from "../adapter.js";
import {
  BoardRefusedError,
  FieldDefinitionsUnavailableError,
  SyncError,
} from "../errors.js";

export interface RedmineOptions {
  // Base URL of the instance, e.g. http://localhost:18080.
  baseUrl: string;
  // Project identifier the items belong to.
  project: string;
  // Environment variable holding the API key (REQ-SYNC-008).
  tokenEnv: string;
  // Status name `close` moves an item to. Falls back to the first status the
  // instance marks as closed.
  closedStatus?: string;
}

interface RedmineCustomField {
  id: number;
  name: string;
  value: string | string[] | null;
  // Present only on multi-valued fields. Absent — not `false` — on the rest, so
  // this reads as `true | undefined` and never as a boolean.
  multiple?: boolean;
}

interface RedmineIssue {
  id: number;
  subject: string;
  description?: string | null;
  tracker?: { id: number; name: string };
  status?: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  fixed_version?: { id: number; name: string };
  parent?: { id: number };
  custom_fields?: RedmineCustomField[];
  updated_on?: string;
}

// REQ-SYNC-013 — Board timestamps filter the scan and decide nothing.
//
// Measured in run 004: an issue's `updated_on` moves when a child is attached
// or removed, and does NOT move when that child's own content changes. It says
// "this row changed", not "the content changed", and the row changes for
// reasons that are not content.
//
// So it narrows what to fetch and nothing else. Deciding whether an item
// changed is the `synced_hash`'s job, and using this instead would raise a
// phantom conflict every time someone reorders the hierarchy — which, on a
// board that collapses parent and child, is routine rather than exceptional.
export function scanFilter(since?: Date): string {
  if (since === undefined) return "";
  return `updated_on=%3E%3D${since.toISOString().slice(0, 10)}`;
}

// REQ-SYNC-008 — Board credentials come only from the environment.
//
// `resolveToken` throws when the variable is unset, and it is called here,
// before the adapter exists — so the failure happens before any request can be
// made, and the token never appears in a report, a log or an error.
export function createRedmineAdapter(options: RedmineOptions): BoardAdapter {
  const token = resolveToken(options.tokenEnv);
  const base = options.baseUrl.replace(/\/+$/, "");

  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    // Redmine's own auth header. This is the only place in the codebase that
    // knows it exists (REQ-SYNC-002).
    "x-redmine-api-key": token,
  };

  let trackerCache: Map<string, number> | undefined;
  let statusCache:
    { id: number; name: string; is_closed: boolean }[] | undefined;

  async function request(
    method: string,
    path: string,
    body?: unknown,
    item = path,
  ): Promise<{ status: number; text: string }> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) {
      // REQ-SYNC-011: the body travels unchanged. No parsing, no translation,
      // no classification — Redmine's 422 is localized prose with no code.
      throw new BoardRefusedError(item, response.status, text);
    }
    return { status: response.status, text };
  }

  async function trackerId(type: string): Promise<number> {
    if (trackerCache === undefined) {
      const { text } = await request("GET", "/trackers.json");
      const parsed = JSON.parse(text) as {
        trackers: { id: number; name: string }[];
      };
      trackerCache = new Map(parsed.trackers.map((t) => [t.name, t.id]));
    }
    const id = trackerCache.get(type);
    if (id === undefined) {
      throw new SyncError(
        `The board has no tracker named "${type}". ` +
          `Trackers it reports: ${[...trackerCache.keys()].join(", ") || "(none)"}. ` +
          `Fix [board.mapping] or create the tracker.`,
      );
    }
    return id;
  }

  async function statuses(): Promise<
    { id: number; name: string; is_closed: boolean }[]
  > {
    if (statusCache === undefined) {
      const { text } = await request("GET", "/issue_statuses.json");
      statusCache = (
        JSON.parse(text) as {
          issue_statuses: { id: number; name: string; is_closed: boolean }[];
        }
      ).issue_statuses;
    }
    return statusCache;
  }

  async function closedStatusId(): Promise<number> {
    const known = await statuses();
    const wanted = options.closedStatus;
    const match =
      wanted === undefined
        ? known.find((s) => s.is_closed)
        : known.find((s) => s.name === wanted);
    if (match === undefined) {
      throw new SyncError(
        wanted === undefined
          ? `The board reports no closed status, so specd cannot close an item. ` +
              `Statuses: ${known.map((s) => s.name).join(", ")}.`
          : `The board has no status named "${wanted}". ` +
              `Statuses: ${known.map((s) => s.name).join(", ")}.`,
      );
    }
    return match.id;
  }

  async function statusIdNamed(name: string): Promise<number> {
    const known = await statuses();
    const match = known.find((s) => s.name === name);
    if (match === undefined) {
      throw new SyncError(
        `The board has no status named "${name}". ` +
          `Statuses: ${known.map((s) => s.name).join(", ")}.`,
      );
    }
    return match.id;
  }

  // The write and the proof, once. Redmine accepts `status_id`, answers 204 and
  // applies nothing when the tracker has no workflow row for the transition; a
  // success response is not evidence that the write happened, and the reread is
  // what turns it into evidence.
  async function applyStatus(
    ref: BoardItemRef,
    target: number,
    notes: string,
    what: string,
  ): Promise<void> {
    await request(
      "PUT",
      `/issues/${ref.id}.json`,
      { issue: { status_id: target, notes } },
      `issue ${ref.id}`,
    );

    const { text } = await request("GET", `/issues/${ref.id}.json`);
    const applied = (JSON.parse(text) as { issue: RedmineIssue }).issue.status;
    if (applied?.id !== target) {
      throw new SyncError(
        `issue ${ref.id}: the board accepted the ${what} and did not apply it. ` +
          `The status is still "${applied?.name ?? "unknown"}" (id ${applied?.id ?? "unknown"}), not id ${target}.\n` +
          `In Redmine this happens when the item's tracker has no workflow transition ` +
          `to that status: the PUT answers 204 and changes nothing.\n` +
          `specd reports this as a failure rather than as a ${what}, because a ${what} ` +
          `that did not happen is worse than one that refused.`,
      );
    }
  }

  function refFor(id: number): BoardItemRef {
    return { id: String(id), url: `${base}/issues/${id}` };
  }

  return {
    provider: "redmine",

    async create(draft: BoardItemDraft): Promise<BoardItemRef> {
      const payload = {
        issue: {
          project_id: options.project,
          tracker_id: await trackerId(draft.type),
          subject: draft.title,
          description: draft.body,
          ...(draft.parent === undefined
            ? {}
            : { parent_issue_id: Number(draft.parent.id) }),
          custom_fields: writeFields(draft.fields),
        },
      };
      const { text } = await request(
        "POST",
        "/issues.json",
        payload,
        draft.title,
      );
      const created = JSON.parse(text) as { issue: { id: number } };
      return refFor(created.issue.id);
    },

    async update(ref: BoardItemRef, content: BoardItemContent): Promise<void> {
      await request(
        "PUT",
        `/issues/${ref.id}.json`,
        {
          issue: {
            subject: content.title,
            description: content.body,
            ...(content.parent === undefined
              ? {}
              : { parent_issue_id: Number(content.parent.id) }),
            custom_fields: writeFields(content.fields),
          },
        },
        `issue ${ref.id}`,
      );
    },

    // In Redmine the parent link is a field of the child, not a resource. Azure
    // DevOps makes it a resource, which is why the interface keeps `link`
    // separate — the generality costs three lines here and would cost a missing
    // operation there.
    async link(child: BoardItemRef, parent: BoardItemRef): Promise<void> {
      await request(
        "PUT",
        `/issues/${child.id}.json`,
        { issue: { parent_issue_id: Number(parent.id) } },
        `issue ${child.id}`,
      );
    },

    // Reads back on purpose. Measured: a Redmine tracker with no workflow rows
    // accepts `status_id`, answers 204, and does not apply it. A write that
    // reports success without happening is absence-is-not-compliance arriving from the board's side —
    // silence presented as approval — so the one status write specd makes is
    // also the one it confirms.
    async close(ref: BoardItemRef, reason: string): Promise<void> {
      await applyStatus(ref, await closedStatusId(), reason, "close");
    },

    // REQ-SYNC-017. Same proof as `close`, different target and a different
    // meaning: the item reached a stage of the client's workflow, and is still
    // alive. A board with `Em homologação` between `Em curso` and `Fechada` had
    // nowhere to receive "ready to validate", and closing early erases from the
    // board work that still has steps ahead of it.
    async transition(
      ref: BoardItemRef,
      status: string,
      notes: string,
    ): Promise<void> {
      await applyStatus(ref, await statusIdNamed(status), notes, "transition");
    },

    async read(ref: BoardItemRef): Promise<BoardItemSnapshot | undefined> {
      let text: string;
      try {
        ({ text } = await request("GET", `/issues/${ref.id}.json`));
      } catch (cause) {
        // Gone is not unchanged, and the caller has to be able to tell.
        if (cause instanceof BoardRefusedError && cause.status === 404) {
          return undefined;
        }
        throw cause;
      }
      return snapshotOf((JSON.parse(text) as { issue: RedmineIssue }).issue);
    },

    // REQ-SYNC-010: `/custom_fields.json` is admin-only. An ordinary project
    // member gets 403 with an EMPTY body, while `/trackers.json` and
    // `/issue_statuses.json` answer 200 to the same token — measured in run
    // 004, not read in the documentation. Returning [] here would be the exact
    // absence-is-not-compliance failure: "I could not check" presented as "there is nothing".
    async describeFields(): Promise<BoardFieldDefinition[]> {
      let text: string;
      try {
        ({ text } = await request("GET", "/custom_fields.json"));
      } catch (cause) {
        if (cause instanceof BoardRefusedError) {
          throw new FieldDefinitionsUnavailableError(
            cause.body.trim().length === 0
              ? "the board answered with an empty body; in Redmine this endpoint is admin-only"
              : cause.body.trim(),
            [],
            cause.status,
          );
        }
        throw new FieldDefinitionsUnavailableError(
          cause instanceof Error ? cause.message : String(cause),
          [],
        );
      }

      const parsed = JSON.parse(text) as {
        custom_fields: {
          id: number;
          name: string;
          field_format: string;
          is_required: boolean;
          multiple: boolean;
        }[];
      };
      return parsed.custom_fields.map((field) => ({
        id: field.id,
        name: field.name,
        format: field.field_format,
        required: field.is_required,
        multiple: field.multiple,
      }));
    },
  };

  function snapshotOf(issue: RedmineIssue): BoardItemSnapshot {
    return {
      ref: refFor(issue.id),
      type: issue.tracker?.name ?? "",
      content: {
        title: issue.subject,
        body: issue.description ?? "",
        ...(issue.parent === undefined
          ? {}
          : { parent: refFor(issue.parent.id) }),
        fields: (issue.custom_fields ?? []).map(readField),
      },
      ...(issue.status === undefined ? {} : { status: issue.status.name }),
      ...(issue.assigned_to === undefined
        ? {}
        : { assignee: issue.assigned_to.name }),
      ...(issue.fixed_version === undefined
        ? {}
        : { iteration: issue.fixed_version.name }),
      ...(issue.updated_on === undefined
        ? {}
        : { modifiedAt: issue.updated_on }),
    };
  }
}

// Reading: an unset single-valued field is `null` and an unset multi-valued one
// is `[]`. Both are carried through as-is; `normalizeProjection` is what
// collapses them to the same absence, and it does that in one place rather than
// once per adapter.
function readField(field: RedmineCustomField): BoundFieldValue {
  return { id: field.id, name: field.name, value: field.value };
}

// Writing: a multi-valued field takes a JSON array, a single-valued one a
// string. `null` is sent as the empty string, which is how Redmine clears a
// single-valued field.
function writeFields(
  fields: readonly BoundFieldValue[],
): { id: number; value: FieldValue }[] {
  return fields.map((field) => ({
    id: field.id,
    value: field.value ?? "",
  }));
}
