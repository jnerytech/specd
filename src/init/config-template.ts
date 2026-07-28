import { VERIFY_LEVELS } from "../config/schema.js";
import type { StackDetection } from "./detect-stack.js";

// REQ-CFG-004: the generated file lists every layer, derived from the one list
// the pipeline itself reads.
//
// This used to be a hand-kept copy, and it drifted: three layers shipped in
// later slices and the template kept offering three of six, so every project
// scaffolded after them started with half the gate switched off and no way to
// know. A duplicated list is a promise to remember.
const IMPLEMENTED_LEVELS: readonly string[] = VERIFY_LEVELS;

// REQ-CFG-004 — Init writes complete defaults.
//
// Every supported section is present with its recommended value and an inline
// comment explaining it. This is not an empty skeleton: a generated file that
// says nothing forces the reader to the documentation, and a file that omits a
// section hides that the knob exists.
//
// `verify.validation_command` is the one field left commented, because there is
// nothing honest to put there until a stack is detected.
export const DEFAULT_CONFIG = `# specd — project configuration
# Every section below is supported; values shown are the recommended defaults.
# Full reference: https://github.com/jnerytech/specd

[project]
# Client or organisation this repository belongs to. Free text, used in reports.
# client = "acme"
# Language for requirement prose. EARS keywords stay English regardless.
language = "en"

[board]
# Card provider and project, used by \`specd explore\` to resolve a bare card id.
# provider = "jira"
# project = "ACME"
# Endpoint template for one card; {project} and {card} are filled in.
# url_template = "https://acme.atlassian.net/rest/api/3/issue/{card}"
# Name of the environment variable holding the token. Never the token itself.
# token_env = "SPECD_BOARD_TOKEN"

# Sources collected by \`specd explore\`, in order. Repeat the block per source.
# A source marked required that fails blocks the bundle.
# [[explore.sources]]
# name = "card"
# type = "board"          # board | git | mcp | http
# required = true
# redact = ["fields.reporter.emailAddress"]

# [[explore.sources]]
# name = "recent-log"
# type = "git"
# args = ["log", "--oneline", "-20"]

[verify]
# Layers that run, in the fixed order provenance, schema, coverage, anchors,
# evidence, project. Only membership is configurable; the order is not.
levels = [${IMPLEMENTED_LEVELS.map((level) => `"${level}"`).join(", ")}]
__VALIDATION_COMMAND__

[verify.anchors]
# Severity of a dangling anchor, by where the requirement is written.
# strict    — error whether it is realized or in flight
# graduated — error in .specd/specs/, which is realized truth, and a warning in
#             the delta of an open change, which is work not written yet
# lenient   — warning in both, for adopting specd on an existing repository
policy = "graduated"

[anchors]
# Resolution strategy for extensions without a fixed mapping. grep is the only
# strategy implemented in this version.
default = "grep"

[memory]
# Working notes kept alongside a change. Limits are advisory: \`specd status\`
# reports files that exceed them, it does not truncate them.
enabled = true
change_limit_lines = 150
task_limit_lines = 200
`;

const UNDETECTED_COMMAND = `# Command specd runs for the project layer, as an argv array executed without a
# shell. No build manifest was recognised here, so fill this in by hand:
# validation_command = ["make", "check"]`;

// Renders the template for a repository, filling in the validation command when
// the stack was recognised.
export function renderConfig(detection?: StackDetection): string {
  if (detection === undefined) {
    return DEFAULT_CONFIG.replace("__VALIDATION_COMMAND__", UNDETECTED_COMMAND);
  }
  const argv = detection.validationCommand
    .map((part) => JSON.stringify(part))
    .join(", ");
  return DEFAULT_CONFIG.replace(
    "__VALIDATION_COMMAND__",
    `# Command specd runs for the project layer, as an argv array executed without a\n` +
      `# shell. Detected from ${detection.manifest} (${detection.name}).\n` +
      `validation_command = [${argv}]`,
  );
}
