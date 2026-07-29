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
    themeControl(),
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

// REQ-READ-008 — The reader chooses light or dark, without scripting.
//
// Following the system alone is not adjustable: reading at night on a light
// system, or in daylight on a dark one, leaves no way to ask for the opposite —
// and long-form reading is exactly where that stops being a matter of taste.
//
// No JavaScript, for REQ-READ-003's reason: a screen reader works over the DOM
// it is handed, and a page whose state depends on a script having run is a page
// whose reading depends on it too. This is form state plus a CSS selector, both
// settled before the document is handed over.
//
// It lives in the header, outside every `section`: a theme picker between files
// would be read aloud once per file, which is the failure REQ-READ-004 removes
// from anchor fences.
export function themeControl(): string {
  const choices = [
    { id: "theme-auto", label: "Auto", checked: true },
    { id: "theme-light", label: "Light", checked: false },
    { id: "theme-dark", label: "Dark", checked: false },
  ];
  return [
    '<fieldset class="theme">',
    "<legend>Theme</legend>",
    ...choices.map(
      (choice) =>
        `<input type="radio" name="theme" id="${choice.id}"${choice.checked ? " checked" : ""}>` +
        `<label for="${choice.id}">${choice.label}</label>`,
    ),
    "</fieldset>",
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

// REQ-READ-010 — The document is typeset like a rendered Markdown page.
//
// Reading the spec here and reading the same file in a Markdown preview have to
// feel like the same activity. A serif face is not wrong, and is different
// enough to cost half a second of reorientation per file — expensive in a
// document that exists to be moved through.
//
// Every stack ends in a generic family, so a system with none of the named
// faces still renders. And nothing is fetched: `read` serves on loopback and
// REQ-READ-005 says nothing leaves the machine, so a remote `@font-face` would
// open exactly the hole that requirement closes, by the route nobody inspects.
//
// This does not claim parity with GitHub. Their stack changes when they want it
// to, and asserting a match would claim a third party's fact this repository
// cannot verify — the line REQ-READ-007 already drew about voice switching.
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';

const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

// No JavaScript, on purpose: a screen reader works over the DOM it is handed,
// and a page that assembles its content afterwards is a page it reads half of.
const STYLE = `
:root {
  color-scheme: light;
  --bg: #ffffff;
  --fg: #1f2328;
  --rule: #d0d7de;
}
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --bg: #14171a; --fg: #e8e6e3; --rule: #333a41; }
}
/* An explicit choice wins over the system, and only then. */
body:has(#theme-light:checked) {
  color-scheme: light;
  --bg: #ffffff;
  --fg: #1f2328;
  --rule: #d0d7de;
}
body:has(#theme-dark:checked) {
  color-scheme: dark;
  --bg: #14171a;
  --fg: #e8e6e3;
  --rule: #333a41;
}
body {
  margin: 0 auto;
  max-width: 42rem;
  padding: 2rem 1.25rem 6rem;
  font-family: ${FONT_STACK};
  font-size: 16px;
  line-height: 1.5;
  background: var(--bg);
  color: var(--fg);
}
fieldset.theme {
  border: 0;
  padding: 0;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: ${FONT_STACK};
  font-size: 0.85rem;
}
fieldset.theme legend { float: left; padding: 0 0.5rem 0 0; opacity: 0.7; }
fieldset.theme input { margin: 0 0.15rem 0 0.5rem; }
fieldset.theme label { opacity: 0.8; }
header { border-bottom: 1px solid var(--rule); margin-bottom: 2rem; }
h1, h2, h3, h4 { font-family: ${FONT_STACK}; line-height: 1.25; }
h2.file {
  margin-top: 3.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
  font-size: 1rem;
  opacity: 0.7;
  font-family: ${MONO_STACK};
}
nav ul { padding-left: 1.25rem; }
nav a { text-decoration: none; }
p.summary { opacity: 0.7; font-size: 0.95rem; }
p.omitted { opacity: 0.55; font-style: italic; font-size: 0.95rem; }
ul.table-as-list li { margin-bottom: 0.35rem; }
code, pre { font-family: ${MONO_STACK}; font-size: 0.9em; }
`.trim();
