import { createHash } from "node:crypto";
import type { BoardItemContent } from "./adapter.js";

// A projection is the spec-owned content reduced to comparable values. Absent
// means absent: there is exactly one representation of "no value", and it is
// the key not being there.
export type ProjectionValue = string | string[];
export type Projection = Readonly<Record<string, ProjectionValue>>;

// REQ-SYNC-004 — The hash is computed over a normalized projection.
//
// Redmine returns `null` for an unset single-valued field and `[]` for an unset
// multi-valued one. Both mean "not filled in", and they are not the same value.
// Hashing the raw payload makes the hash move when the server changes the shape
// without the content changing — and a hash that moves on its own turns every
// sync into a false conflict, which is how a team learns to ignore the tool.
//
// The rules, all of them:
//   - `undefined`, `null`, `""` and `[]`      -> the key is dropped
//   - an array drops its empty entries, and disappears if nothing is left
//   - CRLF becomes LF and trailing whitespace goes, because a round trip
//     through a web form is not a content change
//   - key order does not matter; value order inside an array does, because
//     that order is content
export function normalizeProjection(raw: Record<string, unknown>): Projection {
  const out: Record<string, ProjectionValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeValue(value);
    if (normalized === undefined) continue;
    out[key] = normalized;
  }
  return out;
}

function normalizeValue(value: unknown): ProjectionValue | undefined {
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    const items = value
      .map((entry) => normalizeScalar(entry))
      .filter((entry): entry is string => entry !== undefined);
    return items.length === 0 ? undefined : items;
  }

  return normalizeScalar(value);
}

function normalizeScalar(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  return cleaned.length === 0 ? undefined : cleaned;
}

// Stable digest of a normalized projection. Keys are sorted here rather than by
// the caller, so two projections built in different orders cannot disagree.
export function syncedHash(projection: Projection): string {
  const canonical = Object.keys(projection)
    .sort()
    .map((key) => [key, projection[key]] as const);
  const digest = createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
  return `sha256:${digest}`;
}

// The spec-owned view of an item, in the one shape both sides get reduced to
// before anything is compared.
export function projectContent(content: BoardItemContent): Projection {
  const raw: Record<string, unknown> = {
    title: content.title,
    body: content.body,
    parent: content.parent?.id,
  };
  for (const field of content.fields) {
    // Keyed by id: the name can be renamed on the board without the field
    // having changed, and a rename must not move the hash.
    raw[`field:${field.id}`] = field.value;
  }
  return normalizeProjection(raw);
}
