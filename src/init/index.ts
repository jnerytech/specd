import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../config/errors.js";
import { renderConfig } from "./config-template.js";
import { detectStack, type StackDetection } from "./detect-stack.js";
import { GENERATED_PATTERNS, GITATTRIBUTES_HEADER } from "./gitattributes.js";

export interface InitOptions {
  cwd?: string;
  // Overwrite an existing `.specd/config.toml`.
  force?: boolean;
}

export interface InitResult {
  configPath: string;
  createdDirectories: string[];
  detection?: StackDetection;
  gitattributesUpdated: boolean;
}

const DIRECTORIES = [
  join(".specd", "specs"),
  join(".specd", "changes"),
  join(".specd", "archive"),
];

// REQ-CFG-004 / REQ-CFG-005 — writes the project scaffold and a complete,
// commented configuration with a validation command matching the detected
// stack.
export function init(options: InitOptions = {}): InitResult {
  const root = options.cwd ?? process.cwd();
  const configPath = join(root, ".specd", "config.toml");

  if (existsSync(configPath) && options.force !== true) {
    // P4: an existing configuration is the user's, not ours to replace.
    throw new ConfigError(
      `"${configPath}" already exists. Pass --force to overwrite it; specd will not replace a configuration you wrote.`,
    );
  }

  const createdDirectories: string[] = [];
  for (const directory of DIRECTORIES) {
    const absolute = join(root, directory);
    if (!existsSync(absolute)) createdDirectories.push(directory);
    mkdirSync(absolute, { recursive: true });
  }

  const detection = detectStack(root);
  writeFileSync(configPath, renderConfig(detection), "utf8");

  return {
    configPath,
    createdDirectories,
    ...(detection === undefined ? {} : { detection }),
    gitattributesUpdated: updateGitattributes(root),
  };
}

// REQ-EXP-006: the bundle is generated content that stays versioned. The block
// is appended once and left alone afterwards, so a hand-edited file survives a
// second `init`.
function updateGitattributes(root: string): boolean {
  const path = join(root, ".gitattributes");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const missing = GENERATED_PATTERNS.filter(
    (pattern) => !existing.includes(pattern),
  );
  if (missing.length === 0) return false;

  const separator =
    existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  const header = existing.includes(GITATTRIBUTES_HEADER)
    ? []
    : [GITATTRIBUTES_HEADER];
  writeFileSync(
    path,
    `${existing}${separator}${[...header, ...missing, ""].join("\n")}`,
    "utf8",
  );
  return true;
}

export function formatInitResult(result: InitResult): string {
  const lines = [`Wrote ${result.configPath}`];
  for (const directory of result.createdDirectories) {
    lines.push(`Created ${directory}/`);
  }
  lines.push(
    result.detection === undefined
      ? "No build manifest recognised — fill in verify.validation_command by hand."
      : `Detected ${result.detection.name} from ${result.detection.manifest}; ` +
          `proposed validation_command = ${JSON.stringify(result.detection.validationCommand)}`,
  );
  if (result.gitattributesUpdated) {
    lines.push("Registered the explore bundle in .gitattributes");
  }
  lines.push(
    "",
    "Next: write a capability under .specd/specs/, then run `specd verify`.",
  );
  return lines.join("\n");
}
