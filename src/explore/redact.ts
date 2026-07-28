// REQ-EXP-005 — Redaction before persistence.
//
// Returns a copy with the listed field paths removed. The caller redacts and
// then writes; nothing ever reaches the disk and gets cleaned up afterwards,
// because a file that briefly held a secret has already leaked it.
//
// A path is dot-separated and walks into arrays element by element, so
// "items.owner.email" clears the field on every item.
export function redactPayload(
  payload: unknown,
  paths: readonly string[],
): unknown {
  let result = clone(payload);
  for (const path of paths) {
    const segments = path.split(".").filter((part) => part.length > 0);
    if (segments.length === 0) continue;
    result = removeAt(result, segments);
  }
  return result;
}

function removeAt(node: unknown, segments: string[]): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return node;

  if (Array.isArray(node)) {
    return node.map((item) => removeAt(item, segments));
  }
  if (node === null || typeof node !== "object") return node;

  const record = node as Record<string, unknown>;
  if (!(head in record)) return record;
  if (rest.length === 0) {
    const remaining = { ...record };
    delete remaining[head];
    return remaining;
  }
  return { ...record, [head]: removeAt(record[head], rest) };
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = clone(item);
  }
  return out;
}
