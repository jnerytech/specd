import { requireProjectRoot } from "../core/root.js";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import { ConflictError } from "../core/conflict.js";
import { OperationalError } from "../core/operational.js";
import {
  knownDeclarationExtensions,
  listDeclarations,
  type Declaration,
} from "./declarations.js";
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
  // REQ-ANC-011: terms dropped for matching more files than the ceiling.
  discardedTerms?: number;
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
  const root = requireProjectRoot(options.root);
  const specsDir = join(root, ".specd", "specs");
  if (!existsSync(specsDir)) {
    throw new ConflictError(
      `No capabilities found: "${specsDir}" does not exist.`,
      ["run `specd init` first, or point at a repository that has specs"],
    );
  }

  const capability = selectCapability(specsDir, options, root);
  return {
    capability: capability.name,
    file: capability.file,
    requirements: capability.requirements.map((requirement) =>
      suggestForRequirement(requirement, root),
    ),
  };
}

export interface FileSuggestReport {
  file: string;
  // Absent when no declaration pattern is known for the extension.
  language?: string;
  extension: string;
  declarations: Declaration[];
}

export interface FileSuggestOptions {
  root: string;
  file: string;
}

// REQ-ANC-012 — the `--file` mode.
//
// Deterministic and free of invention: it reports what the file declares, in
// file order, and the author picks. This is the flow that actually happens —
// whoever writes a requirement about existing code has already read the file.
export function suggestForFile(options: FileSuggestOptions): FileSuggestReport {
  const root = requireProjectRoot(options.root);
  const path = isAbsolute(options.file)
    ? options.file
    : join(root, options.file);

  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new OperationalError(
      `"${options.file}" is not a readable file. --file takes a path, absolute or relative to the project root "${root}".`,
    );
  }

  const listing = listDeclarations(readFileSync(path, "utf8"), path);
  const file = isAbsolute(options.file)
    ? relative(root, path).split(sep).join("/")
    : options.file.split(sep).join("/");

  return listing.known
    ? {
        file,
        language: listing.language,
        extension: extensionOf(path),
        declarations: listing.declarations,
      }
    : { file, extension: listing.extension, declarations: [] };
}

function extensionOf(path: string): string {
  const dot = basename(path).lastIndexOf(".");
  return dot <= 0 ? "(none)" : basename(path).slice(dot).toLowerCase();
}

export function formatFileSuggestReport(report: FileSuggestReport): string {
  // absence-is-not-compliance: "I know this language and it declares nothing" and "I do not know this
  // language" are different answers, and only the first is safe to act on.
  if (report.language === undefined) {
    return [
      `No declaration pattern is known for "${report.extension}" (${report.file}).`,
      "This is not an empty file — specd cannot read declarations of this kind,",
      "so it reports nothing rather than reporting nothing found.",
      `Known extensions: ${knownDeclarationExtensions().join(" ")}`,
    ].join("\n");
  }

  const lines = [
    `Declarations in ${report.file} (${report.language})`,
    "specd never writes these into the spec — copy the one the requirement is about.",
    "",
  ];
  if (report.declarations.length === 0) {
    lines.push("    no declaration found");
    return lines.join("\n");
  }
  for (const declaration of report.declarations) {
    lines.push(`    ${report.file}:${declaration.line}`);
    lines.push(`      symbol: ${JSON.stringify(declaration.symbol)}`);
  }
  return lines.join("\n").trimEnd();
}

// REQ-CLI-003: a name that matches more than one capability is a conflict, not
// a coin toss.
function selectCapability(
  specsDir: string,
  options: SuggestOptions,
  root: string,
): Capability {
  const { capabilities } = loadCapabilities(specsDir, {
    pathsRelativeTo: root,
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
  let discarded = 0;
  for (const term of extractTerms(requirement)) {
    const candidate = candidateFor(term, root);
    if (candidate === undefined) continue;
    // REQ-ANC-011: a term matching more files than the ceiling is a namespace,
    // not a symbol. In one real repository the product name matched 119 files
    // — solution file, editor rules, every test — and the report came out with
    // fifteen candidates and none usable. A report nobody reads is worse than
    // an empty one, because it costs the reading before being discarded.
    if (candidate.matches.length > TERM_FILE_CEILING) {
      discarded++;
      continue;
    }
    candidates.push(candidate);
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
    ...(discarded === 0 ? {} : { discardedTerms: discarded }),
  };
}

// REQ-ANC-011 — the ceiling above which a term stops being a symbol.
//
// Deliberately generous: the point is to kill the namespace-wide term, not to
// second-guess a symbol that legitimately appears in a handful of places. A
// declaration form matching more than this many files is not a declaration.
export const TERM_FILE_CEILING = 8;

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
      if (requirement.discardedTerms) {
        lines.push(
          `    ${requirement.discardedTerms} term(s) discarded for matching more than ${TERM_FILE_CEILING} files — ` +
            "a term that wide is a namespace, not a symbol",
        );
      }
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
