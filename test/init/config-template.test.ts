import { describe, expect, it } from "vitest";
import { ConfigSchema, type FieldSpec } from "../../src/config/schema.js";
import { renderConfig } from "../../src/init/config-template.js";

// Every key the schema accepts, as dotted paths.
function schemaKeys(
  fields: Record<string, FieldSpec>,
  path: string[] = [],
): string[] {
  const keys: string[] = [];
  for (const [name, spec] of Object.entries(fields)) {
    keys.push([...path, name].join("."));
    if (spec.kind === "section" || spec.kind === "table-array") {
      keys.push(...schemaKeys(spec.fields, [...path, name]));
    }
  }
  return keys;
}

// REQ-CFG-011 — The init template covers every supported configuration key.
//
// The template opens by claiming that every supported section is present. In
// run 006 six keys were missing — four of `sync`, and two of the MCP transport
// that had been absent since before change `board-sync-redmine`. Nobody noticed for three slices,
// because a claim written in prose does not fail.
//
// The check reads `ConfigSchema` rather than a second list written by hand. A
// second list is the defect it is meant to catch, one indirection later.
describe("init config template", () => {
  it("covers every ConfigSchema key", () => {
    const template = renderConfig();
    const missing = schemaKeys(ConfigSchema).filter((key) => {
      const leaf = key.split(".").pop() as string;
      return !template.includes(leaf);
    });
    expect(missing).toEqual([]);
  });

  it("fails when a key is added to the schema and not to the template", () => {
    // Proves the check would fail CI rather than pass by finding nothing.
    const withNewKey: Record<string, FieldSpec> = {
      ...ConfigSchema,
      telemetry: {
        kind: "section",
        fields: { endpoint_that_is_not_in_the_template: { kind: "string" } },
      },
    };
    const template = renderConfig();
    const missing = schemaKeys(withNewKey).filter((key) => {
      const leaf = key.split(".").pop() as string;
      return !template.includes(leaf);
    });
    expect(missing).toContain("telemetry.endpoint_that_is_not_in_the_template");
  });

  it("still claims full coverage, which is now a claim the test backs", () => {
    expect(renderConfig()).toContain("Every section below is supported");
  });

  it("keeps the sync keys readable, with an example value and not just a name", () => {
    const template = renderConfig();
    expect(template).toContain('capability = "Epic"');
    expect(template).toContain('collapse = ["task"]');
    expect(template).toContain('constant = "ACME"');
  });
});
