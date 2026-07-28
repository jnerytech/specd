import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse as parseYaml, YAMLParseError } from "yaml";
import { ANCHOR_FENCE_INFO } from "./anchors.js";
import { error, warning, type Diagnostic } from "./diagnostics.js";
import { headingText, isHeadingAtOrAbove, scanLines } from "./markdown.js";
import {
  REQ_ID_PATTERN_DESCRIPTION,
  isPrefixAbbreviationOf,
  isValidRequirementId,
  prefixOf,
} from "./requirement-id.js";
import {
  parseRequirement,
  type Requirement,
  type RequirementSection,
} from "./requirement.js";

export interface Capability {
  name: string;
  // Requirement identifiers retired by past changes; never reusable.
  retired: string[];
  requirements: Requirement[];
  file: string;
}

export interface ParsedCapability {
  // Absent when the file could not be read as a capability at all.
  capability?: Capability;
  diagnostics: Diagnostic[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
// A level-3 heading claiming to be a requirement: first token, then an
// optional dash-separated title.
const REQUIREMENT_HEADING = /^(\S+)(?:\s*[—–-]\s*(.*))?$/;

// REQ-FMT-001: read a capability as frontmatter plus requirements expressed as
// level-3 headings.
export function parseCapability(
  source: string,
  file: string,
): ParsedCapability {
  const diagnostics: Diagnostic[] = [];

  const front = readFrontmatter(source, file, diagnostics);
  if (front === undefined) return { diagnostics };

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

  const sections = splitRequirements(
    document.lines,
    front.bodyStartLine,
    file,
    diagnostics,
  );

  const requirements: Requirement[] = [];
  const seen = new Map<string, number>();
  for (const section of sections) {
    const first = seen.get(section.id);
    if (first !== undefined) {
      diagnostics.push(
        error({
          file,
          line: section.line,
          requirementId: section.id,
          message: `Duplicate requirement ${section.id}; already declared at line ${first}.`,
        }),
      );
      continue;
    }
    seen.set(section.id, section.line);

    if (front.retired.includes(section.id)) {
      diagnostics.push(
        error({
          file,
          line: section.line,
          requirementId: section.id,
          message: `Requirement ${section.id} is listed as retired in the frontmatter of ${front.name}; retired identifiers are never reused.`,
        }),
      );
      continue;
    }

    const prefix = prefixOf(section.id);
    if (prefix !== undefined && !isPrefixAbbreviationOf(prefix, front.name)) {
      diagnostics.push(
        warning({
          file,
          line: section.line,
          requirementId: section.id,
          message: `Requirement ${section.id} uses prefix "${prefix}", which does not abbreviate capability "${front.name}".`,
        }),
      );
    }

    const parsed = parseRequirement(section, { file, capability: front.name });
    diagnostics.push(...parsed.diagnostics);
    requirements.push(parsed.requirement);
  }

  return {
    capability: {
      name: front.name,
      retired: front.retired,
      requirements,
      file,
    },
    diagnostics,
  };
}

export function parseCapabilityFile(path: string): ParsedCapability {
  return parseCapability(readFileSync(path, "utf8"), path);
}

export interface LoadedCapabilities {
  capabilities: Capability[];
  diagnostics: Diagnostic[];
}

export interface LoadOptions {
  // Report paths relative to this root instead of as given. Diagnostics read
  // better as `.specd/specs/cli.md:36` than as an absolute path.
  pathsRelativeTo?: string;
}

// Reads every `*.md` under a `.specd/specs/` directory, in stable name order so
// that two runs over the same tree report findings identically.
export function loadCapabilities(
  specsDir: string,
  options: LoadOptions = {},
): LoadedCapabilities {
  const capabilities: Capability[] = [];
  const diagnostics: Diagnostic[] = [];
  const files = readdirSync(specsDir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  for (const name of files) {
    const path = join(specsDir, name);
    const display =
      options.pathsRelativeTo === undefined
        ? path
        : relative(options.pathsRelativeTo, path).split(sep).join("/");
    const parsed = parseCapability(readFileSync(path, "utf8"), display);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.capability) capabilities.push(parsed.capability);
  }
  return { capabilities, diagnostics };
}

interface Frontmatter {
  name: string;
  retired: string[];
  // 1-based line where the document body starts, just after the closing `---`.
  bodyStartLine: number;
}

function readFrontmatter(
  source: string,
  file: string,
  diagnostics: Diagnostic[],
): Frontmatter | undefined {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          'Missing YAML frontmatter; a capability file opens with "---" and declares "capability" and "retired".',
      }),
    );
    return undefined;
  }

  let front: unknown;
  try {
    front = parseYaml(match[1] as string);
  } catch (cause) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: `Malformed YAML frontmatter: ${cause instanceof YAMLParseError ? cause.message.split("\n")[0] : String(cause)}`,
      }),
    );
    return undefined;
  }

  if (front === null || typeof front !== "object" || Array.isArray(front)) {
    diagnostics.push(
      error({ file, line: 1, message: "Frontmatter must be a YAML mapping." }),
    );
    return undefined;
  }

  const fields = front as Record<string, unknown>;
  const name = fields["capability"];
  if (typeof name !== "string" || name.trim().length === 0) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message:
          'Frontmatter is missing "capability"; it names the capability this file specifies.',
      }),
    );
    return undefined;
  }

  const bodyStartLine = countLines(source.slice(0, match[0].length)) + 1;
  const retired = readRetired(fields, file, diagnostics);
  return { name: name.trim(), retired, bodyStartLine };
}

function readRetired(
  fields: Record<string, unknown>,
  file: string,
  diagnostics: Diagnostic[],
): string[] {
  const raw = fields["retired"];
  if (raw === undefined) {
    diagnostics.push(
      warning({
        file,
        line: 1,
        message:
          'Frontmatter has no "retired" list; declare it as an empty list to make the absence explicit.',
      }),
    );
    return [];
  }
  if (!Array.isArray(raw)) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: '"retired" must be a list of requirement identifiers.',
      }),
    );
    return [];
  }
  const retired: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !isValidRequirementId(entry)) {
      diagnostics.push(
        error({
          file,
          line: 1,
          message: `"retired" contains ${JSON.stringify(entry)}, which is not a requirement identifier. Expected ${REQ_ID_PATTERN_DESCRIPTION}.`,
        }),
      );
      continue;
    }
    retired.push(entry);
  }
  return retired;
}

function splitRequirements(
  lines: ReturnType<typeof scanLines>["lines"],
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

function countLines(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char === "\n") count++;
  }
  return count;
}
