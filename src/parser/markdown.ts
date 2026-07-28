// Minimal, single-pass line model of a Markdown document. The parser only ever
// needs two structural facts — where the fenced code blocks are and what their
// info string says — so a full CommonMark parser would buy nothing here. What
// matters is that headings inside a fence are never mistaken for requirements.

export interface SourceLine {
  text: string;
  // 1-based line number.
  line: number;
  // True for every line of a fenced code block, delimiters included.
  fenced: boolean;
  // Info string of the opening delimiter, set only on that line.
  fenceInfo?: string;
}

export interface ScannedDocument {
  lines: SourceLine[];
  // 1-based line of an opening delimiter that was never closed, if any.
  unterminatedFence?: number;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function scanLines(source: string): ScannedDocument {
  const lines: SourceLine[] = [];
  let openDelimiter: string | undefined;
  let openLine = 0;

  const raw = source.split("\n");
  for (let i = 0; i < raw.length; i++) {
    const text = raw[i] as string;
    const line = i + 1;
    const match = FENCE.exec(text);

    if (openDelimiter === undefined) {
      if (match) {
        const delimiter = match[1] as string;
        openDelimiter = delimiter;
        openLine = line;
        const info = (match[2] as string).trim();
        lines.push({
          text,
          line,
          fenced: true,
          ...(info.length > 0 ? { fenceInfo: info } : {}),
        });
        continue;
      }
      lines.push({ text, line, fenced: false });
      continue;
    }

    // A closing delimiter uses the same character, is at least as long as the
    // opening one, and carries no info string.
    const closes =
      match !== null &&
      (match[1] as string)[0] === openDelimiter[0] &&
      (match[1] as string).length >= openDelimiter.length &&
      (match[2] as string).trim().length === 0;
    lines.push({ text, line, fenced: true });
    if (closes) openDelimiter = undefined;
  }

  return {
    lines,
    ...(openDelimiter === undefined ? {} : { unterminatedFence: openLine }),
  };
}

// Text of a heading of the given level, or undefined when the line is not one.
// Fenced lines never produce a heading.
export function headingText(
  line: SourceLine,
  level: number,
): string | undefined {
  if (line.fenced) return undefined;
  const match = new RegExp(`^ {0,3}#{${level}}(?!#)\\s*(.*?)\\s*#*\\s*$`).exec(
    line.text,
  );
  return match?.[1];
}

// True when the line opens a heading of level 1..maxLevel — used to find the
// end of a requirement section.
export function isHeadingAtOrAbove(
  line: SourceLine,
  maxLevel: number,
): boolean {
  if (line.fenced) return false;
  const match = /^ {0,3}(#{1,6})\s/.exec(line.text);
  if (!match) return false;
  return (match[1] as string).length <= maxLevel;
}
