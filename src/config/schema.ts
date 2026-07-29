import { looksLikeToken } from "./credentials.js";
import { ConfigError } from "./errors.js";

export const VERIFY_LEVELS = [
  "provenance",
  "schema",
  "coverage",
  "anchors",
  "evidence",
  "project",
] as const;
export type VerifyLevel = (typeof VERIFY_LEVELS)[number];

export const ANCHOR_POLICIES = ["strict", "graduated", "lenient"] as const;
export type AnchorPolicy = (typeof ANCHOR_POLICIES)[number];

export const ANCHOR_STRATEGIES = ["grep", "treesitter"] as const;
export type AnchorStrategy = (typeof ANCHOR_STRATEGIES)[number];

// REQ-EXP-002: the four source types `explore` supports. A type outside this
// list is a configuration error, not an ignored entry.
export const SOURCE_TYPES = ["board", "git", "mcp", "http"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// REQ-CFG-012: whether a change has to declare the board card it was born
// from. Read from the configuration, never inferred from the repository — a
// skill concluding "this one looks like it has a board" would be deciding the
// cycle by resemblance, which is what no-guessing-on-conflict forbids.
export const BOARD_CARD_MODES = ["required", "optional"] as const;
export type BoardCardMode = (typeof BOARD_CARD_MODES)[number];

// REQ-SYNC-006: the spec levels a board mapping can name. A level outside this
// list is a configuration error, not an ignored entry.
export const SPEC_LEVELS = ["capability", "requirement", "task"] as const;
export type SpecLevel = (typeof SPEC_LEVELS)[number];

// REQ-SYNC-009: where the value written into a board field comes from. `constant`
// covers the case the run 004 exposed — a client's required field the spec has
// no source for at all, which would otherwise make `create` impossible.
export const FIELD_SOURCES = [
  "capability",
  "requirement_id",
  "title",
  "level",
] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

// REQ-SYNC-009 — a field is named by id, by name, or by both.
//
// `id` is stable and unreadable; `name` is readable and survives the board
// being recreated. Both are accepted so the configuration can be reviewed
// without consulting the board's database, and a disagreement between them is
// a conflict rather than a guess.
export interface BoardFieldConfig {
  id?: number;
  name?: string;
  // Literal value specd always writes into this field.
  constant?: string;
  // Spec attribute the value is taken from.
  from?: FieldSource;
}

export interface ExploreSource {
  // Identifies the source in the manifest and names its output file.
  name: string;
  type: SourceType;
  // REQ-EXP-003: a required source that fails blocks the bundle.
  required?: boolean;
  // REQ-EXP-005: field paths removed before the payload is written.
  redact?: string[];
  // `http` and `mcp`: endpoint. `board`: overrides board.url_template.
  url?: string;
  // `git`: argv passed to git, without the executable.
  args?: string[];
  // `mcp`: tool to call and the arguments to call it with.
  tool?: string;
  arguments?: Record<string, unknown>;
  // Environment variable holding the bearer token for this source
  // (REQ-CFG-003). For `board`, defaults to board.token_env.
  token_env?: string;
}

// Fully resolved configuration: fields with built-in defaults are always
// present; the rest stay optional.
export interface SpecdConfig {
  project: { client?: string; language: string };
  board: {
    // Names the adapter `sync` uses, and labels the card provider for
    // `explore`. One board, one name.
    provider?: string;
    // REQ-CFG-012. Absent means the built-in default, which only applies where
    // a board is configured at all.
    card?: BoardCardMode;
    project?: string;
    token_env?: string;
    // Template for a card endpoint, with {project} and {card} placeholders.
    url_template?: string;
    // Base URL of the board's API — what `sync` talks to.
    url?: string;
    // REQ-SYNC-006: spec level -> board item type, plus the collapse rule.
    mapping: {
      capability?: string;
      requirement?: string;
      task?: string;
      // Levels that do not become their own item; their content folds into the
      // nearest mapped ancestor.
      collapse?: SpecLevel[];
      // Status name `close` moves an item to. REQ-SYNC-003's single exception.
      closed_status?: string;
      // REQ-SYNC-017: status name `archive --sync` moves the change's items to.
      // Absent means no transition is attempted, which is reported rather than
      // assumed.
      archived_status?: string;
    };
    fields: BoardFieldConfig[];
  };
  explore: { sources: ExploreSource[] };
  verify: {
    levels: VerifyLevel[];
    validation_command?: string[];
    anchors: { policy: AnchorPolicy };
  };
  anchors: { default: AnchorStrategy };
  memory: {
    enabled: boolean;
    change_limit_lines: number;
    task_limit_lines: number;
  };
}

// Shape of a single configuration source (file layer or CLI flags): every
// field optional, merged field by field by the resolver.
export interface PartialConfig {
  project?: Partial<SpecdConfig["project"]>;
  board?: Omit<Partial<SpecdConfig["board"]>, "mapping"> & {
    mapping?: Partial<SpecdConfig["board"]["mapping"]>;
  };
  explore?: { sources?: ExploreSource[] };
  verify?: {
    levels?: VerifyLevel[];
    validation_command?: string[];
    anchors?: { policy?: AnchorPolicy };
  };
  anchors?: Partial<SpecdConfig["anchors"]>;
  memory?: Partial<SpecdConfig["memory"]>;
}

export const DEFAULT_CONFIG: SpecdConfig = {
  project: { language: "en" },
  board: { mapping: {}, fields: [] },
  explore: { sources: [] },
  verify: {
    levels: [...VERIFY_LEVELS],
    anchors: { policy: "graduated" },
  },
  anchors: { default: "grep" },
  memory: { enabled: true, change_limit_lines: 150, task_limit_lines: 200 },
};

// REQ-CFG-012. `undefined` is "no board here, so the question does not arise" —
// a third answer, kept apart from "optional" on purpose: a repository without a
// board never starts demanding cards because a default said so.
export function boardCardMode(config: SpecdConfig): BoardCardMode | undefined {
  if (config.board.provider === undefined) return undefined;
  return config.board.card ?? "required";
}

export type FieldSpec =
  | { kind: "string"; envName?: boolean }
  | { kind: "boolean" }
  | { kind: "integer" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "string-array"; values?: readonly string[]; nonEmpty?: boolean }
  | { kind: "table" }
  | {
      kind: "table-array";
      fields: Record<string, FieldSpec>;
      requiredFields?: readonly string[];
    }
  | { kind: "section"; fields: Record<string, FieldSpec> };

function section(fields: Record<string, FieldSpec>): FieldSpec {
  return { kind: "section", fields };
}

// Declarative schema of every supported key. Unknown keys and wrong types are
// rejected at load time (REQ-CFG-002); this object is the single source of
// truth for what "known" means.
// REQ-VER-002: which layers run is configurable; the order they run in is not.
// An empty list is rejected at load time — a gate that checks nothing would
// pass silently, which is worse than no gate at all.
export const VerifyLevelsSchema: FieldSpec = {
  kind: "string-array",
  values: VERIFY_LEVELS,
  nonEmpty: true,
};

export const ConfigSchema: Record<string, FieldSpec> = {
  project: section({
    client: { kind: "string" },
    language: { kind: "string" },
  }),
  board: section({
    provider: { kind: "string" },
    card: { kind: "enum", values: BOARD_CARD_MODES },
    project: { kind: "string" },
    token_env: { kind: "string", envName: true },
    url_template: { kind: "string" },
    url: { kind: "string" },
    mapping: section({
      capability: { kind: "string" },
      requirement: { kind: "string" },
      task: { kind: "string" },
      collapse: { kind: "string-array", values: SPEC_LEVELS },
      closed_status: { kind: "string" },
      archived_status: { kind: "string" },
    }),
    // REQ-SYNC-009: neither `id` nor `name` is required on its own, because
    // either identifies a field. `bindFields` rejects an entry that declares
    // neither — that check needs the board's answer, so it does not live here.
    fields: {
      kind: "table-array",
      fields: {
        id: { kind: "integer" },
        name: { kind: "string" },
        constant: { kind: "string" },
        from: { kind: "enum", values: FIELD_SOURCES },
      },
    },
  }),
  explore: section({
    // REQ-EXP-002: sources are declared as an array of tables; every entry is
    // validated against the same field set, so an unknown type or a misspelled
    // key fails at load time rather than mid-collection.
    sources: {
      kind: "table-array",
      requiredFields: ["name", "type"],
      fields: {
        name: { kind: "string" },
        type: { kind: "enum", values: SOURCE_TYPES },
        required: { kind: "boolean" },
        redact: { kind: "string-array" },
        url: { kind: "string" },
        args: { kind: "string-array" },
        tool: { kind: "string" },
        arguments: { kind: "table" },
        token_env: { kind: "string", envName: true },
      },
    },
  }),
  verify: section({
    levels: VerifyLevelsSchema,
    validation_command: { kind: "string-array" },
    anchors: section({
      policy: { kind: "enum", values: ANCHOR_POLICIES },
    }),
  }),
  anchors: section({
    default: { kind: "enum", values: ANCHOR_STRATEGIES },
  }),
  memory: section({
    enabled: { kind: "boolean" },
    change_limit_lines: { kind: "integer" },
    task_limit_lines: { kind: "integer" },
  }),
};

const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

// Validate a parsed TOML document against ConfigSchema. Returns the document
// typed as a configuration layer, or throws ConfigError (exit 2) citing file,
// key and nearby valid keys.
export function validateConfig(raw: unknown, file: string): PartialConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError(
      `Invalid configuration in ${file}: expected a table of sections at the top level.`,
    );
  }
  validateSection(raw as Record<string, unknown>, ConfigSchema, file, []);
  return raw as PartialConfig;
}

function validateSection(
  value: Record<string, unknown>,
  fields: Record<string, FieldSpec>,
  file: string,
  path: string[],
): void {
  for (const [key, entry] of Object.entries(value)) {
    const spec = fields[key];
    const keyPath = [...path, key].join(".");
    if (spec === undefined) {
      throw new ConfigError(
        unknownKeyMessage(file, keyPath, key, fields, path),
      );
    }
    validateField(entry, spec, file, keyPath);
  }
}

function validateField(
  value: unknown,
  spec: FieldSpec,
  file: string,
  keyPath: string,
): void {
  switch (spec.kind) {
    case "section": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw typeMismatch(file, keyPath, "a table", value);
      }
      validateSection(
        value as Record<string, unknown>,
        spec.fields,
        file,
        keyPath.split("."),
      );
      return;
    }
    case "string": {
      if (typeof value !== "string") {
        throw typeMismatch(file, keyPath, "a string", value);
      }
      assertNotLiteralToken(value, file, keyPath);
      if (spec.envName && !ENV_NAME.test(value)) {
        throw new ConfigError(
          `Invalid configuration in ${file}: "${keyPath}" must name an environment ` +
            `variable (e.g. "SPECD_BOARD_TOKEN"), got "${value}". ` +
            `Credentials never live in configuration files.`,
        );
      }
      return;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        throw typeMismatch(file, keyPath, "a boolean", value);
      }
      return;
    }
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw typeMismatch(file, keyPath, "an integer", value);
      }
      return;
    }
    case "enum": {
      if (typeof value !== "string" || !spec.values.includes(value)) {
        throw typeMismatch(
          file,
          keyPath,
          `one of ${spec.values.map((v) => `"${v}"`).join(", ")}`,
          value,
        );
      }
      return;
    }
    case "table": {
      // Free-form payload (MCP tool arguments): the remote tool owns its own
      // schema, so specd only insists that it is a table.
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw typeMismatch(file, keyPath, "a table", value);
      }
      return;
    }
    case "table-array": {
      if (!Array.isArray(value)) {
        throw typeMismatch(file, keyPath, "an array of tables", value);
      }
      value.forEach((entry, index) => {
        const at = `${keyPath}[${index}]`;
        if (
          entry === null ||
          typeof entry !== "object" ||
          Array.isArray(entry)
        ) {
          throw typeMismatch(file, at, "a table", entry);
        }
        const table = entry as Record<string, unknown>;
        validateSection(table, spec.fields, file, at.split("."));
        for (const required of spec.requiredFields ?? []) {
          if (table[required] === undefined) {
            throw new ConfigError(
              `Invalid configuration in ${file}: "${at}" is missing the required key "${required}".`,
            );
          }
        }
      });
      return;
    }
    case "string-array": {
      if (!Array.isArray(value)) {
        throw typeMismatch(file, keyPath, "an array of strings", value);
      }
      if (spec.nonEmpty && value.length === 0) {
        throw new ConfigError(
          `Invalid configuration in ${file}: "${keyPath}" is empty. ` +
            `Remove the key to keep the defaults, or list the values you want.`,
        );
      }
      for (const item of value) {
        if (typeof item !== "string") {
          throw typeMismatch(file, keyPath, "an array of strings", item);
        }
        if (spec.values && !spec.values.includes(item)) {
          throw new ConfigError(
            `Invalid configuration in ${file}: "${keyPath}" contains "${item}"; ` +
              `valid values are ${spec.values.map((v) => `"${v}"`).join(", ")}.`,
          );
        }
        assertNotLiteralToken(item, file, keyPath);
      }
      return;
    }
  }
}

// REQ-CFG-003: any string value that looks like a literal credential rejects
// the whole load, wherever it appears.
function assertNotLiteralToken(
  value: string,
  file: string,
  keyPath: string,
): void {
  if (looksLikeToken(value)) {
    throw new ConfigError(
      `Invalid configuration in ${file}: "${keyPath}" appears to contain a literal ` +
        `credential. Store the token in an environment variable and reference it ` +
        `via token_env instead.`,
    );
  }
}

function typeMismatch(
  file: string,
  keyPath: string,
  expected: string,
  value: unknown,
): ConfigError {
  return new ConfigError(
    `Invalid configuration in ${file}: "${keyPath}" expects ${expected}, ` +
      `got ${describe(value)}.`,
  );
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return `the string "${value}"`;
  if (typeof value === "object") return "a table";
  return `${typeof value} ${String(value)}`;
}

function unknownKeyMessage(
  file: string,
  keyPath: string,
  key: string,
  fields: Record<string, FieldSpec>,
  path: string[],
): string {
  const valid = Object.keys(fields);
  const suggestion = suggest(key, valid);
  const where = path.length > 0 ? `[${path.join(".")}]` : "the top level";
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
  return (
    `Invalid configuration in ${file}: unknown key "${keyPath}".${hint} ` +
    `Valid keys in ${where}: ${valid.join(", ")}.`
  );
}

function suggest(key: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(key, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= 3 ? best : undefined;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[] = Array.from({ length: rows * cols }, () => 0);
  for (let i = 0; i < rows; i++) dist[i * cols] = i;
  for (let j = 0; j < cols; j++) dist[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i * cols + j] = Math.min(
        (dist[(i - 1) * cols + j] as number) + 1,
        (dist[i * cols + (j - 1)] as number) + 1,
        (dist[(i - 1) * cols + (j - 1)] as number) + cost,
      );
    }
  }
  return dist[rows * cols - 1] as number;
}
