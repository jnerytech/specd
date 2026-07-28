import type { AnchorDeclaration } from "../anchors/model.js";
import { ANCHOR_FENCE_INFO, parseAnchorBlock } from "./anchors.js";
import { error, warning, type Diagnostic } from "./diagnostics.js";
import { type SourceLine } from "./markdown.js";

export interface Requirement {
  id: string;
  // Heading text after the identifier, e.g. "Anchor shape".
  title: string;
  capability: string;
  // EARS statement text, without the "**Statement.**" label.
  statement: string;
  // Acceptance criteria, one entry per bullet.
  acceptance: string[];
  anchors: AnchorDeclaration[];
  // 1-based line of the requirement heading.
  line: number;
  file: string;
}

export interface RequirementSection {
  id: string;
  title: string;
  // 1-based line of the "### …" heading.
  line: number;
  // Every line below the heading, up to the next heading of level 3 or above.
  body: SourceLine[];
}

export interface RequirementContext {
  file: string;
  capability: string;
}

export interface ParsedRequirement {
  requirement: Requirement;
  diagnostics: Diagnostic[];
}

const STATEMENT_LABEL = /^\s*\*\*Statement\.?\*\*\s*/;
const ACCEPTANCE_LABEL = /^\s*\*\*Acceptance\.?\*\*\s*$/;
const BULLET = /^\s*[-*]\s+(.*)$/;

// REQ-FMT-003: status belongs to the task, never to the requirement. Matches a
// `status` field declared as its own line, whether written as YAML (`status:`)
// or as a bold label (`**Status.**`); prose merely mentioning the word is not a
// declaration and must not be flagged.
const STATUS_FIELD = /^[ \t]*(?:\*\*)?status(?:\*\*)?[ \t]*[:.]/i;

export function parseRequirement(
  section: RequirementSection,
  ctx: RequirementContext,
): ParsedRequirement {
  const diagnostics: Diagnostic[] = [];
  const prose = section.body.filter((line) => !line.fenced);

  const statusFinding = assertNoStatus(section, ctx);
  if (statusFinding) diagnostics.push(statusFinding);

  const statement = extractStatement(prose);
  if (statement === undefined) {
    diagnostics.push(
      error({
        file: ctx.file,
        line: section.line,
        requirementId: section.id,
        message: `Requirement ${section.id} has no "**Statement.**" — every requirement declares exactly one EARS statement.`,
      }),
    );
  }

  const acceptance = extractAcceptance(prose);
  if (acceptance.length === 0) {
    diagnostics.push(
      warning({
        file: ctx.file,
        line: section.line,
        requirementId: section.id,
        message: `Requirement ${section.id} has no "**Acceptance.**" criteria; there is nothing to derive tests from.`,
      }),
    );
  }

  const anchors: AnchorDeclaration[] = [];
  for (const block of anchorBlocks(section.body)) {
    const parsed = parseAnchorBlock(block.source, {
      file: ctx.file,
      startLine: block.startLine,
      requirementId: section.id,
    });
    anchors.push(...parsed.anchors);
    diagnostics.push(...parsed.diagnostics);
  }

  return {
    requirement: {
      id: section.id,
      title: section.title,
      capability: ctx.capability,
      statement: statement ?? "",
      acceptance,
      anchors,
      line: section.line,
      file: ctx.file,
    },
    diagnostics,
  };
}

// REQ-FMT-003. Reports instead of throwing so that a single run can surface
// every violation of the file; the schema layer of `verify` turns the returned
// diagnostic into a gate failure.
export function assertNoStatus(
  section: RequirementSection,
  ctx: RequirementContext,
): Diagnostic | undefined {
  for (const line of section.body) {
    if (line.fenced) continue;
    if (!STATUS_FIELD.test(line.text)) continue;
    return error({
      file: ctx.file,
      line: line.line,
      requirementId: section.id,
      message:
        `Requirement ${section.id} declares a "status" field. Status belongs to the task ` +
        `that implements the requirement, not to the requirement itself — move it to the ` +
        `task frontmatter under .specd/changes/.`,
    });
  }
  return undefined;
}

function extractStatement(prose: SourceLine[]): string | undefined {
  const start = prose.findIndex((line) => STATEMENT_LABEL.test(line.text));
  if (start === -1) return undefined;
  const parts = [
    (prose[start] as SourceLine).text.replace(STATEMENT_LABEL, ""),
  ];
  for (let i = start + 1; i < prose.length; i++) {
    const text = (prose[i] as SourceLine).text;
    if (text.trim().length === 0) break;
    parts.push(text.trim());
  }
  return parts.join(" ").trim();
}

function extractAcceptance(prose: SourceLine[]): string[] {
  const start = prose.findIndex((line) => ACCEPTANCE_LABEL.test(line.text));
  if (start === -1) return [];
  const criteria: string[] = [];
  for (let i = start + 1; i < prose.length; i++) {
    const text = (prose[i] as SourceLine).text;
    const bullet = BULLET.exec(text);
    if (bullet) {
      criteria.push((bullet[1] as string).trim());
      continue;
    }
    if (text.trim().length === 0) {
      if (criteria.length > 0) break;
      continue;
    }
    break;
  }
  return criteria;
}

interface AnchorBlock {
  source: string;
  // 1-based line of the first content line of the block.
  startLine: number;
}

function anchorBlocks(body: SourceLine[]): AnchorBlock[] {
  const blocks: AnchorBlock[] = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i] as SourceLine;
    if (line.fenceInfo !== ANCHOR_FENCE_INFO) continue;
    const content: string[] = [];
    let cursor = i + 1;
    while (cursor < body.length && (body[cursor] as SourceLine).fenced) {
      const inner = body[cursor] as SourceLine;
      // The closing delimiter is fenced too; it is the last line of the block.
      if (/^ {0,3}(`{3,}|~{3,})\s*$/.test(inner.text)) break;
      content.push(inner.text);
      cursor++;
    }
    blocks.push({ source: content.join("\n"), startLine: line.line + 1 });
    i = cursor;
  }
  return blocks;
}
