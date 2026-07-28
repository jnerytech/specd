import { extname } from "node:path";

export interface Declaration {
  // 1-based line in the file.
  line: number;
  // Text lifted verbatim from that line, ready to paste as an anchor `symbol`.
  symbol: string;
}

export type DeclarationListing =
  | { known: true; language: string; declarations: Declaration[] }
  // P8: an extension with no known pattern is a third outcome. Returning an
  // empty list would make "this file declares nothing" and "I cannot read this
  // kind of file" the same answer, and only one of them is safe to act on.
  | { known: false; extension: string };

interface Language {
  name: string;
  extensions: readonly string[];
  patterns: readonly RegExp[];
}

// Line-anchored patterns, not a parser. Each one must capture the declaration
// from its first keyword through the identifier, because the matched text is
// what gets proposed as the anchor symbol — and an anchor symbol has to occur
// verbatim in the file for the ladder's third step to find it again.
const LANGUAGES: readonly Language[] = [
  {
    name: "typescript",
    extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
    patterns: [
      /^export\s+default\s+(?:async\s+)?(?:function|class)\s+[A-Za-z_$][\w$]*/,
      /^export\s+(?:declare\s+)?(?:async\s+)?function\s*\*?\s*[A-Za-z_$][\w$]*/,
      /^export\s+(?:declare\s+)?(?:abstract\s+)?class\s+[A-Za-z_$][\w$]*/,
      /^export\s+(?:declare\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*/,
      /^export\s+(?:declare\s+)?(?:interface|type|enum)\s+[A-Za-z_$][\w$]*/,
    ],
  },
  {
    name: "csharp",
    extensions: [".cs"],
    patterns: [
      /^(?:public|internal|protected|private)(?:\s+(?:static|sealed|abstract|partial|new|unsafe|readonly|ref))*\s+(?:class|interface|enum|delegate|record\s+struct|record\s+class|record|struct)\s+[A-Za-z_]\w*/,
    ],
  },
  {
    name: "python",
    extensions: [".py"],
    patterns: [/^(?:async\s+def|def|class)\s+[A-Za-z_]\w*/],
  },
  {
    name: "go",
    extensions: [".go"],
    patterns: [/^func\s+(?:\([^)]*\)\s*)?[A-Za-z_]\w*/, /^type\s+[A-Za-z_]\w*/],
  },
];

// REQ-ANC-012 — list what the file declares, instead of guessing what the
// requirement meant.
//
// The term extractor works the other way round: it lifts words from requirement
// prose and searches for them. Run 002 measured why that yields nothing useful —
// the prose says "the tenant accessor is disposed" and the type is called
// `TenantAccessor`, so the extracted term is `Tenant` and matches no
// declaration. Composing `TenantAccessor` out of adjacent words would be
// inventing a symbol name, which P4 forbids.
//
// Inverting the question removes the guess entirely: nothing here is composed,
// every symbol reported is text that occurs in the file, and the author chooses.
export function listDeclarations(
  content: string,
  path: string,
): DeclarationListing {
  const extension = extname(path).toLowerCase();
  const language = LANGUAGES.find((candidate) =>
    candidate.extensions.includes(extension),
  );
  if (language === undefined) {
    return { known: false, extension: extension === "" ? "(none)" : extension };
  }

  const declarations: Declaration[] = [];
  const lines = content.split("\n");
  for (const [index, raw] of lines.entries()) {
    // Leading indentation is stripped before matching and never becomes part of
    // the symbol; the rest of the line is used as written.
    const line = raw.replace(/^[\t ]+/, "");
    for (const pattern of language.patterns) {
      const match = pattern.exec(line);
      if (match === null) continue;
      declarations.push({ line: index + 1, symbol: match[0] });
      break;
    }
  }

  return { known: true, language: language.name, declarations };
}

export function knownDeclarationExtensions(): string[] {
  return LANGUAGES.flatMap((language) => [...language.extensions]).sort();
}
