import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface StackDetection {
  // Short label for the ecosystem, e.g. "node".
  name: string;
  // Manifest file that identified it.
  manifest: string;
  // Command proposed for `verify.validation_command`.
  validationCommand: string[];
}

// Manifests specd recognises as "this is a build, and I do not know how to run
// its checks". Reported by name so the message is true; guessing a command for
// them would be worse than saying nothing.
const UNKNOWN_MANIFESTS = [
  "build.gradle",
  "build.gradle.kts",
  "CMakeLists.txt",
  "meson.build",
  "mix.exs",
  "Gemfile",
  "composer.json",
  "BUILD.bazel",
  "dune-project",
];

// Make targets that mean "run the project's checks", most specific first.
const MAKE_TARGETS = ["verify", "check", "ci", "test"];

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
  const dotnet = findDotnetManifest(root);
  if (dotnet !== undefined) {
    return {
      name: "dotnet",
      manifest: dotnet,
      validationCommand: ["dotnet", "test"],
    };
  }
  // Last, deliberately. A repository with both a Makefile and a language
  // manifest usually has the Makefile wrapping the other one, but the language
  // manifest is the more specific answer and changing that would silently
  // rewrite what already-initialised projects were told.
  const make = findMakeTarget(root);
  if (make !== undefined) {
    return {
      name: "make",
      manifest: "Makefile",
      validationCommand: ["make", make],
    };
  }
  return undefined;
}

// REQ-CFG-005: manifests found but not understood, named so the message can be
// true. `init` used to report "no build manifest recognised" in a repository
// with a solution file at the root and twelve project files under it.
export function unrecognisedManifests(root: string): string[] {
  const found = UNKNOWN_MANIFESTS.filter((name) =>
    existsSync(join(root, name)),
  );
  return found.sort();
}

function findDotnetManifest(root: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return undefined;
  }
  const solution = entries.filter((name) => name.endsWith(".sln")).sort()[0];
  if (solution !== undefined) return solution;
  return entries.filter((name) => name.endsWith(".csproj")).sort()[0];
}

function findMakeTarget(root: string): string | undefined {
  const path = join(root, "Makefile");
  if (!existsSync(path)) return undefined;
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
  const declared = new Set(
    [...content.matchAll(/^([A-Za-z0-9_.-]+):(?!=)/gm)].map(
      (m) => m[1] as string,
    ),
  );
  return MAKE_TARGETS.find((target) => declared.has(target));
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
