import { isMap, isSeq, parseDocument, type Node } from "yaml";
import type { AnchorDeclaration } from "../anchors/model.js";
import { error, type Diagnostic } from "./diagnostics.js";

// Fence info string that marks a block as an anchor declaration. Any other
// info string is an ordinary code block and is left untouched.
export const ANCHOR_FENCE_INFO = "yaml anchors";

const KNOWN_KEYS = ["file", "symbol"];

export interface AnchorBlockContext {
  file: string;
  // 1-based line of the first content line of the block (the line after the
  // opening fence).
  startLine: number;
  requirementId?: string;
}

export interface ParsedAnchorBlock {
  anchors: AnchorDeclaration[];
  diagnostics: Diagnostic[];
}

// REQ-FMT-008: parse the body of a ```yaml anchors fence into anchors. Each
// entry requires `file`; `symbol` is optional.
export function parseAnchorBlock(
  source: string,
  ctx: AnchorBlockContext,
): ParsedAnchorBlock {
  const anchors: AnchorDeclaration[] = [];
  const diagnostics: Diagnostic[] = [];
  const at = (offset: number | undefined): number =>
    ctx.startLine + lineOfOffset(source, offset ?? 0);
  const report = (line: number, message: string): void => {
    diagnostics.push(
      error({
        file: ctx.file,
        line,
        message,
        ...(ctx.requirementId === undefined
          ? {}
          : { requirementId: ctx.requirementId }),
      }),
    );
  };

  const doc = parseDocument(source);
  for (const problem of doc.errors) {
    report(
      at(problem.pos[0]),
      `Malformed anchor block: ${problem.message.split("\n")[0] ?? problem.message}`,
    );
  }
  if (doc.errors.length > 0) return { anchors, diagnostics };

  const root: unknown = doc.contents;
  if (root === null || (isSeq(root) && root.items.length === 0)) {
    report(
      ctx.startLine,
      "Anchor block is empty; remove it or declare an anchor.",
    );
    return { anchors, diagnostics };
  }
  if (!isSeq(root)) {
    report(
      ctx.startLine,
      'Anchor block must be a YAML list of entries, e.g. "- file: src/x.ts".',
    );
    return { anchors, diagnostics };
  }

  for (const item of root.items) {
    const node = item as Node;
    const line = at(node.range?.[0]);
    if (!isMap(node)) {
      report(line, 'Anchor entry must be a mapping with a "file" key.');
      continue;
    }

    let file: string | undefined;
    let symbol: string | undefined;
    let rejected = false;

    for (const pair of node.items) {
      const keyNode = pair.key as Node;
      const key = scalarString(keyNode);
      const keyLine = at(keyNode.range?.[0] ?? node.range?.[0]);
      if (key === undefined || !KNOWN_KEYS.includes(key)) {
        // Rejected rather than ignored: a mistyped `symbols:` would silently
        // degrade a symbol anchor into a file-only anchor, which resolves
        // trivially and hides exactly the drift this tool exists to catch.
        report(
          keyLine,
          `Unknown key "${key ?? String(pair.key)}" in anchor entry; valid keys are ${KNOWN_KEYS.join(", ")}.`,
        );
        rejected = true;
        continue;
      }
      const value = scalarString(pair.value as Node);
      if (value === undefined || value.length === 0) {
        report(keyLine, `Anchor key "${key}" must be a non-empty string.`);
        rejected = true;
        continue;
      }
      if (key === "file") file = value;
      else symbol = value;
    }

    if (file === undefined) {
      if (!rejected) {
        report(line, 'Anchor entry is missing the required "file" key.');
      }
      continue;
    }
    if (rejected) continue;

    anchors.push({
      anchor: symbol === undefined ? { file } : { file, symbol },
      line,
    });
  }

  return { anchors, diagnostics };
}

function scalarString(node: Node | null): string | undefined {
  if (node === null || typeof node !== "object" || !("value" in node)) {
    return undefined;
  }
  const { value } = node as { value: unknown };
  return typeof value === "string" ? value : undefined;
}

// Number of newlines before `offset`, i.e. the 0-based line index of that
// offset inside `source`.
function lineOfOffset(source: string, offset: number): number {
  let count = 0;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source[i] === "\n") count++;
  }
  return count;
}
