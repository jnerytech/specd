import { ANCHOR_FENCE_INFO } from "./anchors.js";
import { error, warning, type Diagnostic } from "./diagnostics.js";
import {
  headingText,
  isHeadingAtOrAbove,
  type SourceLine,
} from "./markdown.js";
import {
  REQ_ID_PATTERN_DESCRIPTION,
  isValidRequirementId,
} from "./requirement-id.js";
import type { RequirementSection } from "./requirement.js";

// A level-3 heading claiming to be a requirement: first token, then an
// optional dash-separated title.
const REQUIREMENT_HEADING = /^(\S+)(?:\s*[—–-]\s*(.*))?$/;

// Splits a document body into requirement sections.
//
// Shared by capability files and change deltas, which is the point: under
// Modelo B a requirement block in `delta.md` has the same shape as one in a
// capability, so the delta needed a reframing of this parser rather than a
// parser of its own.
export function splitRequirementSections(
  lines: readonly SourceLine[],
  bodyStartLine: number,
  file: string,
  diagnostics: Diagnostic[],
): RequirementSection[] {
  const sections: RequirementSection[] = [];
  let current: RequirementSection | undefined;

  for (const line of lines) {
    if (line.line < bodyStartLine) continue;

    const heading = headingText(line, 3);
    if (heading !== undefined) {
      current = undefined;
      const match = REQUIREMENT_HEADING.exec(heading);
      const token = match?.[1];
      // Only headings that claim to be requirements are validated; other
      // level-3 headings are ordinary prose structure.
      if (token === undefined || !/^req/i.test(token)) continue;
      if (!isValidRequirementId(token)) {
        diagnostics.push(
          error({
            file,
            line: line.line,
            message: `Invalid requirement identifier "${token}". Expected ${REQ_ID_PATTERN_DESCRIPTION}.`,
          }),
        );
        continue;
      }
      current = {
        id: token,
        title: (match?.[2] ?? "").trim(),
        line: line.line,
        body: [],
      };
      sections.push(current);
      continue;
    }

    if (isHeadingAtOrAbove(line, 3)) {
      current = undefined;
      continue;
    }

    if (current) {
      current.body.push(line);
      continue;
    }

    // REQ-FMT-008: anchors live on requirements. A block outside one is
    // ignored with a warning rather than rejected.
    if (line.fenceInfo === ANCHOR_FENCE_INFO) {
      diagnostics.push(
        warning({
          file,
          line: line.line,
          message:
            "Anchor block declared outside a requirement; anchors only apply inside a requirement block and this one is ignored.",
        }),
      );
    }
  }

  return sections;
}

// Renders a requirement section back to Markdown, dropping the lines matched by
// `omit`. `archive` uses it to move a block from a delta into a capability
// without reformatting anything the author wrote.
export function renderSection(
  section: RequirementSection,
  omit: (line: SourceLine) => boolean = () => false,
): string {
  const heading =
    section.title.length === 0
      ? `### ${section.id}`
      : `### ${section.id} — ${section.title}`;
  const kept = section.body
    .filter((line) => !omit(line))
    .map((line) => line.text);
  // Removing a line leaves its blank neighbours behind. Collapsing runs keeps
  // the block looking as the author wrote it once the field archive strips is
  // gone, instead of growing a blank line per application.
  const body: string[] = [];
  for (const line of kept) {
    if (line.trim() === "" && body[body.length - 1]?.trim() === "") continue;
    body.push(line);
  }
  while (body.length > 0 && (body[body.length - 1] as string).trim() === "") {
    body.pop();
  }
  while (body.length > 0 && (body[0] as string).trim() === "") body.shift();
  return [heading, "", ...body].join("\n");
}
