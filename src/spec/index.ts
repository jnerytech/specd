import type { Anchor } from "../anchors/model.js";
import { requireProjectRoot } from "../core/root.js";
import type { Diagnostic } from "../parser/diagnostics.js";
import { effectiveSpecs, type RequirementOrigin } from "../verify/effective.js";

// REQ-EFF-002 — every requirement says where it is written.
//
// `origin` is not decoration: it is what decides whether a dangling anchor is
// drift or pending work. A consumer that reads the effective spec without it
// cannot tell the two apart, and telling them apart is the product.
export interface SpecRecord {
  id: string;
  title: string;
  capability: string;
  statement: string;
  acceptance: string[];
  anchors: Anchor[];
  origin: RequirementOrigin;
  // Set when `origin` is "delta": the change whose delta carries the text.
  change?: string;
  // Path of the file the text was read from, relative to the project root.
  source: string;
}

export interface SpecReport {
  requirements: SpecRecord[];
  // What reading the spec produced. Reported, never judged: `verify` owns the
  // verdict and this command owns the view (REQ-EFF-003).
  diagnostics: Diagnostic[];
}

export interface SpecOptions {
  cwd?: string;
}

// REQ-EFF-001 — The effective spec is a command, not a reconstruction.
//
// `effectiveSpecs` already backs `verify`, `status`, `sync` and `anchor fix`.
// What was missing was an exit: without one, whoever needs the overlay reads
// the loose files and applies it by hand, and the rule gains a second
// implementation in the layer that is not deterministic.
export function specReport(options: SpecOptions = {}): SpecReport {
  const root = requireProjectRoot(options.cwd ?? process.cwd());
  const effective = effectiveSpecs(root, { pathsRelativeTo: root });

  return {
    requirements: effective.requirements.map((entry) => ({
      id: entry.requirement.id,
      title: entry.requirement.title,
      capability: entry.capability,
      statement: entry.requirement.statement,
      acceptance: [...entry.requirement.acceptance],
      anchors: entry.requirement.anchors.map((declaration) => ({
        ...declaration.anchor,
      })),
      origin: entry.origin,
      ...(entry.change === undefined ? {} : { change: entry.change }),
      source: entry.requirement.file,
    })),
    diagnostics: effective.diagnostics,
  };
}

// The text rendering carries the same information as `--json`. One of them
// poorer is a reason to parse the other, and a consumer parsing the text
// rendering is a consumer coupled to its formatting.
export function formatSpec(report: SpecReport): string {
  if (report.requirements.length === 0) {
    return "No requirements: the capabilities are empty and no open change adds any.";
  }

  const blocks = report.requirements.map((record) => {
    const lines = [
      `${record.id} — ${record.title}`,
      field("capability", record.capability),
      field(
        "origin",
        record.change === undefined
          ? record.origin
          : `${record.origin} (${record.change})`,
      ),
      field("source", record.source),
      field("statement", record.statement),
    ];

    if (record.acceptance.length > 0) {
      lines.push(field("acceptance", `- ${record.acceptance[0] as string}`));
      for (const criterion of record.acceptance.slice(1)) {
        lines.push(field("", `- ${criterion}`));
      }
    }

    for (const anchor of record.anchors) {
      lines.push(
        field(
          "anchor",
          anchor.symbol === undefined
            ? anchor.file
            : `${anchor.file} :: ${anchor.symbol}`,
        ),
      );
    }

    return lines.join("\n");
  });

  // Diagnostics are counted and named, never acted on. Hiding them would make
  // a quiet report look like a clean one, which is the failure mode
  // absence-is-not-compliance names.
  if (report.diagnostics.length > 0) {
    blocks.push(
      `${report.diagnostics.length} diagnostic${report.diagnostics.length === 1 ? "" : "s"} ` +
        `while reading the spec; run \`specd verify\` for the verdict.`,
    );
  }

  return blocks.join("\n\n");
}

const LABEL_WIDTH = 10;

function field(label: string, value: string): string {
  return `  ${label.padEnd(LABEL_WIDTH)}  ${value}`;
}
