import { parse as parseYaml, YAMLParseError } from "yaml";
import { error, type Diagnostic } from "./diagnostics.js";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export interface Frontmatter {
  fields: Record<string, unknown>;
  // 1-based line where the document body starts, just after the closing `---`.
  bodyStartLine: number;
}

// Reads the leading YAML frontmatter of a Markdown document.
//
// Reports instead of throwing, so one run surfaces every problem in the file.
// `what` names the artifact in the diagnostic — "capability", "delta", "task".
export function readFrontmatter(
  source: string,
  file: string,
  what: string,
  diagnostics: Diagnostic[],
): Frontmatter | undefined {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    diagnostics.push(
      error({
        file,
        line: 1,
        message: `Missing YAML frontmatter; a ${what} file opens with "---".`,
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
        message: `Malformed YAML frontmatter: ${
          cause instanceof YAMLParseError
            ? (cause.message.split("\n")[0] as string)
            : String(cause)
        }`,
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

  let newlines = 0;
  for (const char of match[0]) {
    if (char === "\n") newlines++;
  }
  return {
    fields: front as Record<string, unknown>,
    bodyStartLine: newlines + 1,
  };
}
