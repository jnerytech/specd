import { readFileSync } from "node:fs";
import { OperationalError } from "../core/operational.js";
import type { ReadFile } from "./collect.js";
import { renderForReading } from "./render.js";

export interface DocumentOptions {
  // Passed through to the renderer: omit nothing.
  full: boolean;
}

// REQ-READ-003 — One document, in deterministic order.
//
// Single document is the requirement itself, not a layout preference: a
// browser's read-aloud stops at the end of the page, so ten files served as ten
// pages are ten manual restarts, and listening does not survive that.
//
// The order is not decided here. `collect` settles it, and re-sorting would be
// a second opinion about the same thing.
export function buildDocument(
  files: readonly ReadFile[],
  options: DocumentOptions,
): string {
  const sections = files.map((file) => ({
    id: identifier(file.displayPath),
    displayPath: file.displayPath,
    html: renderForReading(read(file), options),
  }));

  // Counted over what survived the cuts. Counting the omitted anchors would
  // report a length nobody is going to hear.
  const words = sections.reduce(
    (total, section) => total + countWords(section.html),
    0,
  );

  return [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>specd — reading view</title>",
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<header>",
    "<h1>specd — reading view</h1>",
    `<p class="summary">${plural(files.length, "file")}, ${plural(words, "word")}</p>`,
    "</header>",
    contents(sections),
    ...sections.map(
      (section) =>
        `<section id="${section.id}">\n` +
        `<h2 class="file">${escape(section.displayPath)}</h2>\n` +
        `${section.html}</section>`,
    ),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// A file that cannot be read stops the command. Serving the rest would leave a
// hole nothing in the audio marks, and a listener cannot diff what they heard
// against what was there (absence-is-not-compliance).
function read(file: ReadFile): string {
  try {
    return readFileSync(file.absolutePath, "utf-8");
  } catch (cause) {
    throw new OperationalError(
      `Cannot read ${file.displayPath}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

function contents(
  sections: readonly { id: string; displayPath: string }[],
): string {
  const items = sections.map(
    (section) =>
      `<li><a href="#${section.id}">${escape(section.displayPath)}</a></li>`,
  );
  return [
    '<nav aria-label="Contents">',
    "<h2>Contents</h2>",
    "<ul>",
    ...items,
    "</ul>",
    "</nav>",
  ].join("\n");
}

// Whoever is about to listen is deciding whether it fits the time they have,
// and a file count does not answer that: 85 files can be twenty minutes or five
// hours.
function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .trim();
  return text === "" ? 0 : text.split(/\s+/).length;
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;
}

function identifier(displayPath: string): string {
  return `f-${displayPath.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// No JavaScript, on purpose: a screen reader works over the DOM it is handed,
// and a page that assembles its content afterwards is a page it reads half of.
const STYLE = `
:root { color-scheme: light dark; }
body {
  margin: 0 auto;
  max-width: 42rem;
  padding: 2rem 1.25rem 6rem;
  font-family: Georgia, "Iowan Old Style", serif;
  font-size: 1.125rem;
  line-height: 1.7;
}
header { border-bottom: 1px solid currentColor; margin-bottom: 2rem; }
h1, h2, h3, h4 { font-family: system-ui, sans-serif; line-height: 1.3; }
h2.file {
  margin-top: 3.5rem;
  padding-top: 1rem;
  border-top: 1px solid currentColor;
  font-size: 1rem;
  opacity: 0.7;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
nav ul { padding-left: 1.25rem; }
nav a { text-decoration: none; }
p.summary { opacity: 0.7; font-size: 0.95rem; }
p.omitted { opacity: 0.55; font-style: italic; font-size: 0.95rem; }
ul.table-as-list li { margin-bottom: 0.35rem; }
code { font-size: 0.95em; }
`.trim();
