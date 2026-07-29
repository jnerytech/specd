import { Marked, type Token, type Tokens } from "marked";

const gfm = new Marked({ gfm: true });

// Fences tagged this way carry the anchor declarations REQ-FMT-008 defines.
const ANCHOR_FENCE = "yaml anchors";

// The marker REQ-FMT-006 requires on every requirement block.
const STATEMENT_MARKER = "**Statement.**";

export interface ReadingOptions {
  // Render the Markdown whole, omitting nothing.
  full: boolean;
}

// REQ-READ-004 — What is not prose is replaced by a marker.
//
// 21% of this repository's capability lines are anchor blocks: 448 of 2.170,
// across 107 fences. Spoken, each one becomes "file colon src slash cli slash
// index dot ts" once per requirement. An anchor answers *where in the code*,
// and that question does not exist for someone listening away from the editor —
// anchor-necessary-not-sufficient from its least-quoted side, where the anchor
// is the spec's index rather than the spec.
//
// The marker is what separates this from lying. A requirement read with no
// anchor and a requirement whose anchor the tool removed sound identical, and
// one of them is false — absence-is-not-compliance in the form the listener
// meets it, with no diff at hand to check against.
export function renderForReading(
  markdown: string,
  options: ReadingOptions,
): string {
  // REQ-READ-007 applies in both modes: `--full` turns off omission, not
  // language marking. One flag cannot answer for two different things.
  if (options.full) {
    return gfm.parser(markStatementLanguage(gfm.lexer(markdown)));
  }

  const body = stripFrontmatter(markdown);
  const tokens = markStatementLanguage(subtract(gfm.lexer(body.text)));
  const rendered = gfm.parser(tokens);
  return body.stripped ? marker("front matter omitted") + rendered : rendered;
}

// REQ-READ-007 — The EARS statement is marked as English.
//
// REQ-EARS-002 makes the keyword syntax rather than prose: the statement is
// English by contract inside a document whose prose is Portuguese. A speech
// engine picks one voice per page, so without this `SHALL NOT invoke any
// language model` is spoken with Portuguese phonetics, once per requirement.
//
// Recognition is by the `**Statement.**` marker REQ-FMT-006 already requires —
// never by guessing the language of a paragraph, which is semantic judgement
// and is what no-llm-in-decision-path keeps out of here.
//
// What this does not promise: whether a reader honours `lang` is a third
// party's decision. The attribute is what specd writes; the voice is not.
export function markStatementLanguage(tokens: Token[]): Token[] {
  return tokens.map((token) => {
    if (token.type !== "paragraph") return token;
    const paragraph = token as Tokens.Paragraph;
    if (!paragraph.text.startsWith(STATEMENT_MARKER)) return token;
    const inline = gfm.parseInline(paragraph.text, { async: false });
    return html(`<p lang="en">${inline}</p>\n`);
  });
}

// Frontmatter is taken before the lexer sees it: to Markdown it is a thematic
// break followed by prose, which is exactly how it would be read aloud.
function stripFrontmatter(markdown: string): {
  text: string;
  stripped: boolean;
} {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(markdown);
  if (match === null) return { text: markdown, stripped: false };
  return { text: markdown.slice(match[0].length), stripped: true };
}

function subtract(tokens: Token[]): Token[] {
  return tokens.map((token) => {
    switch (token.type) {
      case "code":
        return html(marker(describeCode(token as Tokens.Code)));
      case "table":
        return html(tableAsList(token as Tokens.Table));
      case "blockquote":
      case "list_item": {
        const parent = token as Tokens.Blockquote | Tokens.ListItem;
        parent.tokens = subtract(parent.tokens);
        return token;
      }
      case "list": {
        const list = token as Tokens.List;
        list.items = subtract(list.items) as Tokens.ListItem[];
        return token;
      }
      default:
        return token;
    }
  });
}

function describeCode(token: Tokens.Code): string {
  const lang = token.lang?.trim() ?? "";
  if (lang === ANCHOR_FENCE) return "anchors omitted";
  return lang === "" ? "code omitted" : `${lang} code omitted`;
}

// A table read by a screen reader arrives cell by cell with no header repeated,
// so by the third row nobody knows which column they are hearing. One item per
// row, each cell announced by its column, keeps the pairing in the audio.
function tableAsList(token: Tokens.Table): string {
  const headers = token.header.map((cell) => cell.text.trim());
  const items = token.rows.map((row) => {
    const pairs = row.map((cell, index) => {
      const header = headers[index] ?? "";
      const value = cell.text.trim();
      return header === "" ? value : `${header}: ${value}`;
    });
    return `<li>${escape(pairs.join("; "))}</li>`;
  });
  return `<ul class="table-as-list">\n${items.join("\n")}\n</ul>\n`;
}

function marker(text: string): string {
  return `<p class="omitted">(${escape(text)})</p>\n`;
}

function html(text: string): Tokens.HTML {
  return { type: "html", raw: text, pre: false, text, block: true };
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
