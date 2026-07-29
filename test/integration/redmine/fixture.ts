import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Credentials and endpoint come from the file the seed emits. They are never
// committed, and the suite refuses to run rather than inventing a default that
// would silently point at somebody's real board.
export interface RedmineEnv {
  url: string;
  apiKey: string;
  memberApiKey: string;
  project: string;
  version: string;
  clienteFieldId: number;
  timesFieldId: number;
  sprintFieldId: number;
  epicId: string;
}

const ENV_FILE = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "sandbox",
  "redmine",
  ".env",
);

export function loadRedmineEnv(): RedmineEnv {
  if (!existsSync(ENV_FILE)) {
    throw new Error(
      `${ENV_FILE} is missing. Run \`npm run test:integration\`, which brings the ` +
        `container up and seeds it, instead of invoking vitest directly.`,
    );
  }
  const values = new Map<string, string>();
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    values.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  const need = (key: string): string => {
    const value = values.get(key);
    if (value === undefined || value === "") {
      throw new Error(`${ENV_FILE} has no ${key}; re-run seed.sh.`);
    }
    return value;
  };
  return {
    url: need("REDMINE_URL"),
    apiKey: need("REDMINE_API_KEY"),
    memberApiKey: need("REDMINE_MEMBER_API_KEY"),
    project: need("REDMINE_PROJECT"),
    version: need("REDMINE_VERSION"),
    clienteFieldId: Number(need("CF_CLIENTE_ID")),
    timesFieldId: Number(need("CF_TIMES_ID")),
    sprintFieldId: Number(need("CF_SPRINT_ID")),
    epicId: need("SEED_EPIC_ID"),
  };
}

export interface RequirementSpec {
  id: string;
  title: string;
  statement: string;
  acceptance: string[];
}

export interface ProjectOptions {
  env: RedmineEnv;
  capability: string;
  requirements: RequirementSpec[];
  // Extra TOML appended to [board]; used to vary the field configuration.
  fieldsToml?: string;
  tokenEnv?: string;
}

// A throwaway specd project pointed at the live Redmine. One per test, so the
// tests never share a capability file and can run in any order.
export function makeProject(options: ProjectOptions): string {
  const root = mkdtempSync(join(tmpdir(), "specd-sync-"));
  mkdirSync(join(root, ".specd", "specs"), { recursive: true });
  mkdirSync(join(root, ".specd", "changes"), { recursive: true });

  writeFileSync(
    join(root, ".specd", "config.toml"),
    `[board]
provider = "redmine"
url = "${options.env.url}"
project = "${options.env.project}"
token_env = "${options.tokenEnv ?? "SPECD_BOARD_TOKEN"}"

[board.mapping]
capability = "Epic"
requirement = "Story"
collapse = ["task"]
closed_status = "Closed"
${options.fieldsToml ?? ""}`,
    "utf8",
  );

  writeCapability(root, options.capability, options.requirements);
  return root;
}

export function writeCapability(
  root: string,
  capability: string,
  requirements: readonly RequirementSpec[],
): void {
  const blocks = requirements.map(
    (requirement) => `### ${requirement.id} — ${requirement.title}

**Statement.** ${requirement.statement}

**Acceptance.**
${requirement.acceptance.map((criterion) => `- ${criterion}`).join("\n")}
`,
  );
  writeFileSync(
    capabilityPath(root, capability),
    `---
capability: ${capability}
retired: []
---

${blocks.join("\n")}`,
    "utf8",
  );
}

// Edits one requirement heading in place.
//
// Rewriting the whole capability file would erase the `board:` block sync just
// wrote, and the test would then be measuring a lost link rather than a spec
// edit. Editing the heading is what a person changing a title actually does.
export function retitle(
  root: string,
  capability: string,
  id: string,
  title: string,
): void {
  const path = capabilityPath(root, capability);
  const source = readFileSync(path, "utf8");
  const pattern = new RegExp(`^### ${id} — .*$`, "m");
  if (!pattern.test(source)) {
    throw new Error(`no heading for ${id} in ${path}`);
  }
  writeFileSync(path, source.replace(pattern, `### ${id} — ${title}`), "utf8");
}

// Removes one requirement block, frontmatter untouched — the spec-side shape of
// "this requirement was archived".
export function dropRequirement(
  root: string,
  capability: string,
  id: string,
): void {
  const path = capabilityPath(root, capability);
  const source = readFileSync(path, "utf8");
  const pattern = new RegExp(`^### ${id} — [\\s\\S]*?(?=^### |\\s*$)`, "m");
  if (!pattern.test(source)) {
    throw new Error(`no block for ${id} in ${path}`);
  }
  writeFileSync(path, source.replace(pattern, ""), "utf8");
}

export function capabilityPath(root: string, capability: string): string {
  return join(root, ".specd", "specs", `${capability}.md`);
}

export function readCapability(root: string, capability: string): string {
  return readFileSync(capabilityPath(root, capability), "utf8");
}

// Direct API access, for arranging board-side state the adapter is then asked
// to observe. Deliberately not going through the adapter: a test that arranges
// with the same code it verifies proves only that the code agrees with itself.
export function redmineApi(env: RedmineEnv, apiKey = env.apiKey) {
  const call = async (
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; text: string }> => {
    const response = await fetch(`${env.url}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-redmine-api-key": apiKey,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, text: await response.text() };
  };

  return {
    call,
    async issue(id: string): Promise<Record<string, unknown>> {
      const { text } = await call("GET", `/issues/${id}.json`);
      return (JSON.parse(text) as { issue: Record<string, unknown> }).issue;
    },
    async issueCount(): Promise<number> {
      const { text } = await call(
        "GET",
        `/issues.json?project_id=${env.project}&status_id=*&limit=100`,
      );
      return (JSON.parse(text) as { total_count: number }).total_count;
    },
    async createIssue(payload: Record<string, unknown>): Promise<string> {
      const { text } = await call("POST", "/issues.json", { issue: payload });
      return String((JSON.parse(text) as { issue: { id: number } }).issue.id);
    },
    async deleteIssue(id: string): Promise<void> {
      await call("DELETE", `/issues/${id}.json`);
    },
  };
}

export const REQUIREMENTS: RequirementSpec[] = [
  {
    id: "REQ-DEMO-001",
    title: "First",
    statement: "The demo system SHALL do the first thing.",
    acceptance: ["primeiro critério"],
  },
  {
    id: "REQ-DEMO-002",
    title: "Second",
    statement: "The demo system SHALL do the second thing.",
    acceptance: ["segundo critério"],
  },
];

// Declares a requirement dead the way `archive` does: the block goes, and the
// identifier joins `retired` in the frontmatter.
export function retire(root: string, capability: string, id: string): void {
  dropRequirement(root, capability, id);
  const path = capabilityPath(root, capability);
  const source = readFileSync(path, "utf8");
  const match = /^retired: \[(.*)\]$/m.exec(source);
  if (match === null) throw new Error(`no inline retired list in ${path}`);
  const current = (match[1] as string)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  writeFileSync(
    path,
    source.replace(match[0], `retired: [${[...current, id].join(", ")}]`),
    "utf8",
  );
}

// Renames a requirement everywhere the spec mentions it — heading and, if the
// capability holds one, nothing else. The board link keeps the old key, which
// is exactly the state REQ-SYNC-015 exists to catch.
export function renameRequirement(
  root: string,
  capability: string,
  from: string,
  to: string,
): void {
  const path = capabilityPath(root, capability);
  const source = readFileSync(path, "utf8");
  const heading = new RegExp(`^### ${from} — `, "m");
  if (!heading.test(source)) throw new Error(`no heading for ${from}`);
  writeFileSync(path, source.replace(heading, `### ${to} — `), "utf8");
}
