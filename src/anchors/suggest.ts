import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ConflictError } from "../core/conflict.js";
import { loadCapabilities, type Capability } from "../parser/capability.js";
import type { Requirement } from "../parser/requirement.js";
import { SEARCH_EXCLUDE_PREFIXES } from "./resolve.js";
import { findSymbolInRepo, type SymbolMatch } from "./search.js";

export type Confidence = "unique" | "ambiguous" | "none";

export interface AnchorCandidate {
  // The term lifted from the requirement text.
  term: string;
  // The anchor symbol proposed for it, ready to paste. Absent when the term
  // was only found as free text, which yields a file-only anchor.
  symbol?: string;
  confidence: Confidence;
  matches: SymbolMatch[];
}

export interface RequirementSuggestion {
  requirementId: string;
  title: string;
  // True when the requirement already declares anchors; suggestions are still
  // produced, so an existing anchor can be reviewed against them.
  hasAnchors: boolean;
  candidates: AnchorCandidate[];
}

export interface SuggestReport {
  capability: string;
  file: string;
  requirements: RequirementSuggestion[];
}

export interface SuggestOptions {
  root: string;
  // Capability name, e.g. "anchors".
  capability: string;
}

// Words that look like identifiers but never usefully name code: EARS keywords,
// the product name, and nouns so generic that every match is a coincidence.
const STOPWORDS = new Set([
  "SHALL",
  "WHEN",
  "WHILE",
  "THEN",
  "WHERE",
  "NOT",
  "specd",
  "TODO",
  "file",
  "symbol",
  "line",
  "name",
  "path",
  "text",
  "code",
  "list",
  "value",
]);

const CODE_SPAN = /`([^`]+)`/g;
// camelCase, PascalCase, snake_case, dotted and slashed paths — the shapes a
// symbol or a file takes. Plain lowercase prose words are not candidates.
const IDENTIFIER =
  /\b(?:[a-z]+(?:[A-Z][a-z0-9]*)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+|[\w-]+(?:\/[\w.-]+)+|\w+\.\w{1,4})\b/g;

const MIN_TERM_LENGTH = 3;

// A term is worth proposing as a symbol when it is declared somewhere. Searching
// for the declaration rather than the bare word is what turns a noisy word count
// into a line the author can paste into the spec. Ordered from most specific.
//
// Only exported declarations: a requirement is realized by a module's public
// surface, and matching local bindings turned every generic word in the prose
// into a candidate ("symbol" proposing `function symbol`, "file" proposing
// `const file`).
const DECLARATION_FORMS = [
  "export async function ",
  "export function ",
  "export interface ",
  "export const ",
  "export class ",
  "export type ",
  "export enum ",
  "export default ",
];

// Anchors point at code. Prose repeats every term in the spec and would drown
// the report; a lockfile repeats them too and means nothing.
const SUGGEST_EXCLUDE_PREFIXES = [...SEARCH_EXCLUDE_PREFIXES, "openspec/"];
const SUGGEST_EXCLUDE_EXTENSIONS = [".md", ".lock", ".txt"];
const SUGGEST_EXCLUDE_FILES = ["package-lock.json", "pnpm-lock.yaml"];

// A bare term is only proposed when it is shaped like an identifier or a path.
// Without this, backticked prose words like `git` or `init` match everywhere.
const STRUCTURED_TERM = /[A-Z_./-]/;

// REQ-ANC-001 / REQ-ANC-003: propose anchors for a capability by lifting
// candidate terms from each requirement and searching the repository for them.
//
// This reads and reports. It never writes to the capability file: an anchor the
// tool invented would report drift that never happened and burn the gate's
// credibility on first use.
export function suggestAnchors(options: SuggestOptions): SuggestReport {
  const specsDir = join(options.root, ".specd", "specs");
  if (!existsSync(specsDir)) {
    throw new ConflictError(
      `No capabilities found: "${specsDir}" does not exist.`,
      ["run `specd init` first, or point at a repository that has specs"],
    );
  }

  const capability = selectCapability(specsDir, options);
  return {
    capability: capability.name,
    file: capability.file,
    requirements: capability.requirements.map((requirement) =>
      suggestForRequirement(requirement, options.root),
    ),
  };
}

// REQ-CLI-003: a name that matches more than one capability is a conflict, not
// a coin toss.
function selectCapability(
  specsDir: string,
  options: SuggestOptions,
): Capability {
  const { capabilities } = loadCapabilities(specsDir, {
    pathsRelativeTo: options.root,
  });
  const wanted = options.capability.toLowerCase();
  const matches = capabilities.filter(
    (c) =>
      c.name.toLowerCase() === wanted ||
      basename(c.file).replace(/\.md$/, "").toLowerCase() === wanted,
  );

  if (matches.length === 1) return matches[0] as Capability;
  if (matches.length > 1) {
    throw new ConflictError(
      `"${options.capability}" matches more than one capability:`,
      matches.map((c) => `${c.name} (${c.file})`),
    );
  }

  const available = readdirSync(specsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  throw new ConflictError(
    `No capability named "${options.capability}". Available capabilities:`,
    available,
  );
}

function suggestForRequirement(
  requirement: Requirement,
  root: string,
): RequirementSuggestion {
  const candidates: AnchorCandidate[] = [];
  for (const term of extractTerms(requirement)) {
    const candidate = candidateFor(term, root);
    if (candidate) candidates.push(candidate);
  }

  // Unique matches first, then ambiguous, then terms found nowhere: the reader
  // should hit the actionable candidates without scrolling.
  const order: Record<Confidence, number> = {
    unique: 0,
    ambiguous: 1,
    none: 2,
  };
  candidates.sort(
    (a, b) =>
      order[a.confidence] - order[b.confidence] || a.term.localeCompare(b.term),
  );

  return {
    requirementId: requirement.id,
    title: requirement.title,
    hasAnchors: requirement.anchors.length > 0,
    candidates,
  };
}

// Candidate terms come from the statement and the acceptance criteria: inline
// code spans first, since an author who wrote backticks already named a symbol.
export function extractTerms(requirement: Requirement): string[] {
  const sources = [requirement.statement, ...requirement.acceptance];
  const terms = new Set<string>();

  for (const source of sources) {
    CODE_SPAN.lastIndex = 0;
    let span: RegExpExecArray | null;
    while ((span = CODE_SPAN.exec(source)) !== null) {
      addTerm(terms, (span[1] as string).trim());
    }
  }
  for (const source of sources) {
    const withoutSpans = source.replace(CODE_SPAN, " ");
    IDENTIFIER.lastIndex = 0;
    let word: RegExpExecArray | null;
    while ((word = IDENTIFIER.exec(withoutSpans)) !== null) {
      addTerm(terms, word[0]);
    }
  }

  return [...terms];
}

function addTerm(terms: Set<string>, term: string): void {
  if (term.length < MIN_TERM_LENGTH) return;
  if (STOPWORDS.has(term)) return;
  // A term with whitespace is prose in backticks, not an identifier.
  if (/\s/.test(term)) return;
  terms.add(term);
}

// Looks for the term as a declaration first, and only then as free text. The
// first declaration form that matches wins, which is what makes the proposed
// symbol precise enough to anchor on.
function candidateFor(term: string, root: string): AnchorCandidate | undefined {
  for (const form of DECLARATION_FORMS) {
    const symbol = `${form}${term}`;
    const matches = search(symbol, root);
    if (matches.length > 0) {
      return { term, symbol, confidence: confidenceOf(matches), matches };
    }
  }

  if (!STRUCTURED_TERM.test(term)) return undefined;
  const matches = search(term, root);
  if (matches.length === 0) return undefined;
  return { term, confidence: confidenceOf(matches), matches };
}

function search(needle: string, root: string): SymbolMatch[] {
  return findSymbolInRepo(needle, {
    root,
    exclude: SUGGEST_EXCLUDE_FILES,
    excludePrefixes: SUGGEST_EXCLUDE_PREFIXES,
    excludeExtensions: SUGGEST_EXCLUDE_EXTENSIONS,
  });
}

function confidenceOf(matches: readonly SymbolMatch[]): Confidence {
  if (matches.length === 1) return "unique";
  if (matches.length === 0) return "none";
  return "ambiguous";
}

export function formatSuggestReport(report: SuggestReport): string {
  const lines = [
    `Anchor candidates for capability "${report.capability}" (${report.file})`,
    "specd never writes these into the spec — copy the ones you agree with.",
    "",
  ];

  for (const requirement of report.requirements) {
    const anchored = requirement.hasAnchors ? " [already anchored]" : "";
    lines.push(
      `${requirement.requirementId} — ${requirement.title}${anchored}`,
    );
    if (requirement.candidates.length === 0) {
      lines.push("    no candidate term resolved to a declaration");
    }
    for (const candidate of requirement.candidates) {
      if (candidate.confidence === "unique") {
        const match = candidate.matches[0] as SymbolMatch;
        lines.push(`    unique     - file: ${match.file}`);
        if (candidate.symbol !== undefined) {
          lines.push(
            `                 symbol: ${JSON.stringify(candidate.symbol)}`,
          );
        }
        continue;
      }
      // REQ-CLI-003: every match is listed, none is chosen.
      lines.push(
        `    ambiguous  ${candidate.symbol ?? candidate.term} -> ${candidate.matches.length} matches: ` +
          candidate.matches.map((m) => `${m.file}:${m.line}`).join(", "),
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
