import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectImportGraph,
  findForbidden,
  type ForbiddenRule,
} from "./import-graph.js";

const VERIFY_ENTRY = join(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "verify",
  "index.ts",
);

// no-llm-in-decision-path / REQ-CLI-002 — no language model in the decision path.
//
// An exit code that depends on a model stops being reproducible, which is the
// one property the whole product is sold on. The list is explicit so that
// adding a client is a deliberate act with a visible diff.
const FORBIDDEN: ForbiddenRule[] = [
  { pattern: /^src\/llm\//, reason: "local LLM module" },
  { pattern: /(^|\/)llm(\/|$)/, reason: "LLM module" },
  { pattern: /^@anthropic-ai\//, reason: "Anthropic client" },
  { pattern: /^openai$|^@openai\//, reason: "OpenAI client" },
  {
    pattern: /^@google\/(generative-ai|genai)$/,
    reason: "Google GenAI client",
  },
  { pattern: /^@mistralai\/|^cohere-ai$|^replicate$/, reason: "LLM client" },
  { pattern: /^langchain|^@langchain\/|^llamaindex$/, reason: "LLM framework" },
  { pattern: /^ollama$|^@huggingface\//, reason: "model runtime client" },
  { pattern: /^@modelcontextprotocol\//, reason: "MCP client" },
];

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() as string, { recursive: true, force: true });
  }
});

describe("no-llm-in-verify", () => {
  it("reaches the real verify graph", () => {
    const graph = collectImportGraph(VERIFY_ENTRY);
    expect(graph.files.length).toBeGreaterThan(5);
  });

  it("no module reachable from verify() imports an LLM client", () => {
    const graph = collectImportGraph(VERIFY_ENTRY);
    const matches = findForbidden(graph, FORBIDDEN).map(
      (m) => `${m.importer} imports ${m.specifier} (${m.reason})`,
    );
    expect(matches).toEqual([]);
  });

  // REQ-CLI-002 acceptance: the test fails if src/verify/** imports src/llm/**.
  it("catches an import of src/llm from inside verify", () => {
    const root = mkdtempSync(join(tmpdir(), "specd-arch-"));
    roots.push(root);
    mkdirSync(join(root, "layers"), { recursive: true });
    writeFileSync(
      join(root, "index.ts"),
      'import { layer } from "./layers/one.js";\nexport const verify = layer;\n',
    );
    writeFileSync(
      join(root, "layers", "one.ts"),
      'import { ask } from "../../llm/client.js";\nexport const layer = ask;\n',
    );

    const matches = findForbidden(
      collectImportGraph(join(root, "index.ts")),
      FORBIDDEN,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.reason).toBe("LLM module");
  });

  it("catches a vendor client imported anywhere in the graph", () => {
    const root = mkdtempSync(join(tmpdir(), "specd-arch-"));
    roots.push(root);
    writeFileSync(
      join(root, "index.ts"),
      'import Anthropic from "@anthropic-ai/sdk";\nexport const verify = Anthropic;\n',
    );

    const matches = findForbidden(
      collectImportGraph(join(root, "index.ts")),
      FORBIDDEN,
    );
    expect(matches.map((m) => m.specifier)).toEqual(["@anthropic-ai/sdk"]);
  });

  it("completes well under two seconds", () => {
    const started = process.hrtime.bigint();
    findForbidden(collectImportGraph(VERIFY_ENTRY), FORBIDDEN);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    expect(elapsedMs).toBeLessThan(2000);
  });
});
