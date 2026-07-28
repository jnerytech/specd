import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface StackDetection {
  // Short label for the ecosystem, e.g. "node".
  name: string;
  // Manifest file that identified it.
  manifest: string;
  // Command proposed for `verify.validation_command`.
  validationCommand: string[];
}

// npm scripts that mean "run the project's checks", most specific first. An
// existing aggregate script beats a bare `npm test`: it is what the project
// already asks contributors to run.
const NPM_SCRIPTS = ["verify", "check", "ci", "test"];

// REQ-CFG-005 — Init detects the stack.
//
// Inspects the repository for a known build manifest and proposes the matching
// validation command. Returns undefined when nothing is recognised; the caller
// leaves the field commented rather than guessing.
export function detectStack(root: string): StackDetection | undefined {
  if (existsSync(join(root, "package.json"))) {
    return {
      name: "node",
      manifest: "package.json",
      validationCommand: npmCommand(root),
    };
  }
  if (existsSync(join(root, "pyproject.toml"))) {
    return {
      name: "python",
      manifest: "pyproject.toml",
      validationCommand: ["pytest"],
    };
  }
  if (existsSync(join(root, "Cargo.toml"))) {
    return {
      name: "rust",
      manifest: "Cargo.toml",
      validationCommand: ["cargo", "test"],
    };
  }
  if (existsSync(join(root, "go.mod"))) {
    return {
      name: "go",
      manifest: "go.mod",
      validationCommand: ["go", "test", "./..."],
    };
  }
  if (existsSync(join(root, "pom.xml"))) {
    return {
      name: "maven",
      manifest: "pom.xml",
      validationCommand: ["mvn", "-q", "test"],
    };
  }
  return undefined;
}

function npmCommand(root: string): string[] {
  const scripts = readScripts(join(root, "package.json"));
  for (const name of NPM_SCRIPTS) {
    if (scripts[name] === undefined) continue;
    return name === "test" ? ["npm", "test"] : ["npm", "run", name];
  }
  return ["npm", "test"];
}

function readScripts(path: string): Record<string, string> {
  try {
    const manifest = JSON.parse(readFileSync(path, "utf8")) as {
      scripts?: Record<string, string>;
    };
    return manifest.scripts ?? {};
  } catch {
    // An unreadable manifest still identifies the ecosystem; only the script
    // list is lost.
    return {};
  }
}
