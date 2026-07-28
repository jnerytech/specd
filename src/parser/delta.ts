import { readFileSync } from "node:fs";
import { error, warning, type Diagnostic } from "./diagnostics.js";
import { readFrontmatter } from "./frontmatter.js";
import { headingText, scanLines, type SourceLine } from "./markdown.js";
import { isValidRequirementId } from "./requirement-id.js";
import {
  parseRequirement,
  type Requirement,
  type RequirementSection,
} from "./requirement.js";
import { renderSection, splitRequirementSections } from "./sections.js";

// REQ-FMT-005: exactly these three, and nothing else.
export const DELTA_SECTIONS = ["ADDED", "MODIFIED", "REMOVED"] as const;
export type DeltaSection = (typeof DELTA_SECTIONS)[number];

const CAPABILITY_LABEL = /^\s*\*\*Capability\.?\*\*\s*(.*)$/;

export interface DeltaRequirement {
  section: "ADDED" | "MODIFIED";
  // Destination capability. Declared by the `**Capability.**` field for ADDED;
  // for MODIFIED it is resolved from wherever the identifier already lives.
  capability?: string;
  requirement: Requirement;
  // The block as Markdown, with the `**Capability.**` line removed — what
  // `archive` writes into the capability file.
  text: string;
}

export interface Delta {
  change: string;
  file: string;
  added: DeltaRequirement[];
  modified: DeltaRequirement[];
  // REQ-FMT-005: identifiers only, no body.
  removed: string[];
}

export interface ParsedDelta {
  // Absent when the file could not be read as a delta at all.
  delta?: Delta;
  diagnostics: Diagnostic[];
}

// REQ-FMT-005 — Delta declares three sections.
//
// Under Modelo B this is the writing surface: ADDED and MODIFIED carry the
// complete requirement, in the same shape a capability file uses, so the block
// moves into `.specd/specs/` unchanged when `archive` applies it.
export function parseDelta(source: string, file: string): ParsedDelta {
  const diagnostics: Diagnostic[] = [];

  const front = readFrontmatter(source, file, "delta", diagnostics);
  if (front === undefined) return { diagnostics };

  const change = front.fields["change"];
  if (typeof change !== "string" || change.trim().length === 0) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          'Delta frontmatter is missing "change"; it names the change this delta belongs to.',
      }),
    );
    return { diagnostics };
  }

  const document = scanLines(source);
  if (document.unterminatedFence !== undefined) {
    diagnostics.push(
      error({
        file,
        line: document.unterminatedFence,
        message:
          "Unterminated fenced code block; everything below it is read as code.",
      }),
    );
  }

  const spans = sectionSpans(
    document.lines,
    front.bodyStartLine,
    file,
    diagnostics,
  );

  const delta: Delta = {
    change: change.trim(),
    file,
    added: [],
    modified: [],
    removed: [],
  };
  const seen = new Map<string, DeltaSection>();

  for (const span of spans) {
    if (span.name === "REMOVED") {
      for (const id of readRemoved(span.lines, file, diagnostics)) {
        recordSection(seen, id, "REMOVED", file, span.line, diagnostics);
        delta.removed.push(id);
      }
      continue;
    }

    const sections = splitRequirementSections(
      span.lines,
      span.startLine,
      file,
      diagnostics,
    );
    for (const section of sections) {
      recordSection(
        seen,
        section.id,
        span.name,
        file,
        section.line,
        diagnostics,
      );

      const capability = readCapabilityField(
        section,
        span.name,
        file,
        diagnostics,
      );
      const parsed = parseRequirement(section, {
        file,
        capability: capability ?? "",
      });
      diagnostics.push(...parsed.diagnostics);

      const missing = assertFullReplacement(
        parsed.requirement,
        span.name,
        file,
      );
      if (missing) diagnostics.push(missing);

      const entry: DeltaRequirement = {
        section: span.name,
        ...(capability === undefined ? {} : { capability }),
        requirement: parsed.requirement,
        text: renderSection(
          section,
          (line) => CAPABILITY_LABEL.test(line.text) && !line.fenced,
        ),
      };
      if (span.name === "ADDED") delta.added.push(entry);
      else delta.modified.push(entry);
    }
  }

  return { delta, diagnostics };
}

export function parseDeltaFile(path: string, display?: string): ParsedDelta {
  return parseDelta(readFileSync(path, "utf8"), display ?? path);
}

// REQ-FMT-006 — ADDED and MODIFIED carry full text.
//
// `parseRequirement` already reports a missing statement as an error and a
// missing acceptance as a warning. Inside a delta the acceptance is not
// optional: the block is the whole requirement, and one arriving without
// acceptance criteria would land in a capability with nothing to test against.
export function assertFullReplacement(
  requirement: Requirement,
  section: "ADDED" | "MODIFIED",
  file: string,
): Diagnostic | undefined {
  if (requirement.acceptance.length > 0) return undefined;
  return error({
    file,
    line: requirement.line,
    requirementId: requirement.id,
    message:
      `Requirement ${requirement.id} appears under ${section} without "**Acceptance.**" criteria. ` +
      `A delta block carries the complete requirement, not a patch.`,
  });
}

interface SectionSpan {
  name: DeltaSection;
  // 1-based line of the "## …" heading.
  line: number;
  // 1-based line where the section body starts.
  startLine: number;
  lines: SourceLine[];
}

function sectionSpans(
  lines: readonly SourceLine[],
  bodyStartLine: number,
  file: string,
  diagnostics: Diagnostic[],
): SectionSpan[] {
  const spans: SectionSpan[] = [];
  let current: SectionSpan | undefined;

  for (const line of lines) {
    if (line.line < bodyStartLine) continue;

    const heading = headingText(line, 2);
    if (heading === undefined) {
      if (current) current.lines.push(line);
      continue;
    }

    current = undefined;
    const name = heading.trim().toUpperCase();
    if (!DELTA_SECTIONS.includes(name as DeltaSection)) {
      diagnostics.push(
        error({
          file,
          line: line.line,
          message:
            `Delta section "${heading.trim()}" is not one of ${DELTA_SECTIONS.join(", ")}. ` +
            `Anything else — deferral, notes, migration — is prose for the proposal, ` +
            `because only these three correspond to something archive does to a capability.`,
        }),
      );
      continue;
    }
    current = {
      name: name as DeltaSection,
      line: line.line,
      startLine: line.line + 1,
      lines: [],
    };
    spans.push(current);
  }

  return spans;
}

function recordSection(
  seen: Map<string, DeltaSection>,
  id: string,
  section: DeltaSection,
  file: string,
  line: number,
  diagnostics: Diagnostic[],
): void {
  const first = seen.get(id);
  if (first !== undefined) {
    diagnostics.push(
      error({
        file,
        line,
        requirementId: id,
        message: `Requirement ${id} appears under both ${first} and ${section}; a delta declares one operation per identifier.`,
      }),
    );
    return;
  }
  seen.set(id, section);
}

function readCapabilityField(
  section: RequirementSection,
  which: "ADDED" | "MODIFIED",
  file: string,
  diagnostics: Diagnostic[],
): string | undefined {
  for (const line of section.body) {
    if (line.fenced) continue;
    const match = CAPABILITY_LABEL.exec(line.text);
    if (!match) continue;
    const name = (match[1] as string).trim();
    if (name.length > 0) return name;
    diagnostics.push(
      error({
        file,
        line: line.line,
        requirementId: section.id,
        message: `Requirement ${section.id} declares an empty "**Capability.**" field.`,
      }),
    );
    return undefined;
  }

  // REQ-FMT-005: only ADDED needs it. A modified requirement already lives
  // somewhere, and the identifier is enough to find it.
  if (which === "ADDED") {
    diagnostics.push(
      error({
        file,
        line: section.line,
        requirementId: section.id,
        message:
          `Requirement ${section.id} appears under ADDED without a "**Capability.**" field. ` +
          `The identifier prefix does not determine the destination — REQ-FMT-002 allows them to differ — ` +
          `so archive would not know which capability file to write it into.`,
      }),
    );
  }
  return undefined;
}

function readRemoved(
  lines: readonly SourceLine[],
  file: string,
  diagnostics: Diagnostic[],
): string[] {
  const ids: string[] = [];
  for (const line of lines) {
    if (line.fenced) continue;
    const text = line.text.trim();
    if (text.length === 0) continue;

    const bullet = /^[-*]\s+(.*)$/.exec(text);
    if (!bullet) {
      // Prose under REMOVED is tolerated with a warning: "Nenhum." is how an
      // empty section is written, and rejecting it would be pedantry.
      if (!/^nenhum/i.test(text) && !/^none/i.test(text)) {
        diagnostics.push(
          warning({
            file,
            line: line.line,
            message:
              "REMOVED accepts only a list of identifiers; this line is ignored.",
          }),
        );
      }
      continue;
    }

    const token = (bullet[1] as string).split(/\s+/)[0] as string;
    if (!isValidRequirementId(token)) {
      diagnostics.push(
        error({
          file,
          line: line.line,
          message: `REMOVED entry "${token}" is not a requirement identifier.`,
        }),
      );
      continue;
    }
    ids.push(token);
  }
  return ids;
}
