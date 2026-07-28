import { error, type Diagnostic } from "../parser/diagnostics.js";
import {
  EARS_PATTERNS,
  TRANSLATED_KEYWORDS,
  allTemplates,
  templateFor,
  type EarsPattern,
  type EarsPatternSpec,
} from "./patterns.js";

// REQ-EARS-005: the pattern that matched is part of the requirement's internal
// model, so `specd status` can aggregate requirements by pattern.
export interface ParsedStatement {
  pattern: EarsPattern;
  // The statement as written.
  text: string;
  // Condition introduced by WHEN / WHILE / IF / WHERE, absent for ubiquitous.
  condition?: string;
  // The system the requirement constrains.
  subject: string;
  // What the system does, or must not do when `negated`.
  response: string;
  // True for "SHALL NOT".
  negated: boolean;
}

export interface StatementContext {
  file: string;
  line: number;
  requirementId: string;
}

export interface ParsedStatementResult {
  statement?: ParsedStatement;
  diagnostics: Diagnostic[];
}

const SHALL = /\bSHALL\b/g;
// A keyword inside an inline code span is a mention of the keyword, not a
// clause — "SHALL reject any statement without `SHALL`" states one behaviour,
// not two.
const CODE_SPAN = /`[^`]*`/g;
const SHALL_SPLIT = /^(.*?)\s+SHALL(\s+NOT)?\s+(.*)$/s;
// Boundary between condition and subject: the last comma wins, so a condition
// containing its own comma still parses. Statements written without a comma
// fall back to the "the <system>" marker.
const BY_COMMA = /^(.+),\s*(\S.*)$/s;
const BY_ARTICLE = /^(.+?)\s+([Tt]he\s+\S.*)$/s;

// Parses one EARS statement, or reports why it is not one.
export function parseStatement(
  text: string,
  ctx: StatementContext,
): ParsedStatementResult {
  const statement = text.trim();

  const translated = findTranslatedKeyword(statement);
  if (translated) {
    return {
      diagnostics: [
        report(
          ctx,
          `Statement of ${ctx.requirementId} uses "${translated.word}" where EARS expects the English keyword ` +
            `"${translated.keyword}". EARS keywords are syntax, not prose — the prose around them may be written ` +
            `in any language, but the keywords are always English and uppercase.`,
        ),
      ],
    };
  }

  const missing = assertShallPresent(statement, ctx);
  if (missing) return { diagnostics: [missing] };

  const split = assertSingleShall(statement, ctx);
  if (split) return { diagnostics: [split] };

  const spec = leadingPattern(statement);
  const body =
    spec.lead === undefined
      ? statement
      : statement.slice(spec.lead.length).trimStart();

  const clause = SHALL_SPLIT.exec(body);
  if (!clause) {
    return { diagnostics: [malformed(ctx, spec)] };
  }
  const head = (clause[1] as string).trim();
  const negated = clause[2] !== undefined;
  const response = (clause[3] as string).trim();

  if (spec.pattern === "ubiquitous") {
    if (head.length === 0) return { diagnostics: [malformed(ctx, spec)] };
    return {
      statement: {
        pattern: spec.pattern,
        text: statement,
        subject: head,
        response,
        negated,
      },
      diagnostics: [],
    };
  }

  const parts =
    spec.pattern === "unwanted-behaviour"
      ? splitOnThen(head)
      : splitCondition(head);
  if (!parts) return { diagnostics: [malformed(ctx, spec)] };

  return {
    statement: {
      pattern: spec.pattern,
      text: statement,
      condition: parts.condition,
      subject: parts.subject,
      response,
      negated,
    },
    diagnostics: [],
  };
}

// REQ-EARS-004: a statement without SHALL is not a requirement.
export function assertShallPresent(
  statement: string,
  ctx: StatementContext,
): Diagnostic | undefined {
  if (countShall(statement) > 0) return undefined;
  return report(
    ctx,
    `Statement of ${ctx.requirementId} contains no "SHALL"; it describes rather than requires. ` +
      `Valid EARS patterns:\n${allTemplates()}`,
  );
}

// REQ-EARS-003: one behaviour per requirement.
export function assertSingleShall(
  statement: string,
  ctx: StatementContext,
): Diagnostic | undefined {
  const count = countShall(statement);
  if (count <= 1) return undefined;
  return report(
    ctx,
    `Statement of ${ctx.requirementId} contains ${count} "SHALL" clauses; a requirement states exactly one ` +
      `behaviour. Split it into separate requirements, one per clause, each with its own identifier and anchors.`,
  );
}

function countShall(statement: string): number {
  return withoutCodeSpans(statement).match(SHALL)?.length ?? 0;
}

function withoutCodeSpans(statement: string): string {
  return statement.replace(CODE_SPAN, (span) => " ".repeat(span.length));
}

function leadingPattern(statement: string): EarsPatternSpec {
  const first = /^([A-Z]+)\b/.exec(statement)?.[1];
  const match = EARS_PATTERNS.find((spec) => spec.lead === first);
  // Anything not opening with a keyword is read as ubiquitous; if it is not
  // one either, the SHALL split below rejects it.
  return match ?? (EARS_PATTERNS[0] as EarsPatternSpec);
}

interface ConditionAndSubject {
  condition: string;
  subject: string;
}

function splitCondition(head: string): ConditionAndSubject | undefined {
  const byComma = BY_COMMA.exec(head) ?? BY_ARTICLE.exec(head);
  if (!byComma) return undefined;
  const condition = (byComma[1] as string).trim();
  const subject = (byComma[2] as string).trim();
  if (condition.length === 0 || subject.length === 0) return undefined;
  return { condition, subject };
}

function splitOnThen(head: string): ConditionAndSubject | undefined {
  const match = /^(.+?),?\s+THEN\s+(\S.*)$/s.exec(head);
  if (!match) return undefined;
  const condition = (match[1] as string).trim();
  const subject = (match[2] as string).trim();
  if (condition.length === 0 || subject.length === 0) return undefined;
  return { condition, subject };
}

function findTranslatedKeyword(
  statement: string,
): { word: string; keyword: string } | undefined {
  for (const raw of withoutCodeSpans(statement).split(/[^\p{L}]+/u)) {
    if (raw.length === 0) continue;
    // Only an all-caps token is a keyword slot; ordinary prose is untouched.
    if (raw !== raw.toUpperCase()) continue;
    const keyword = TRANSLATED_KEYWORDS[raw];
    if (keyword !== undefined) return { word: raw, keyword };
  }
  return undefined;
}

function malformed(ctx: StatementContext, spec: EarsPatternSpec): Diagnostic {
  return report(
    ctx,
    `Statement of ${ctx.requirementId} does not match the ${spec.pattern} pattern ` +
      `"${templateFor(spec.pattern)}".\nValid EARS patterns:\n${allTemplates()}`,
  );
}

function report(ctx: StatementContext, message: string): Diagnostic {
  return error({
    file: ctx.file,
    line: ctx.line,
    requirementId: ctx.requirementId,
    message,
  });
}
