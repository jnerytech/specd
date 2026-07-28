import type { VerifyLevel } from "../config/schema.js";
import type { Diagnostic } from "../parser/diagnostics.js";

// A single finding, carrying its own severity so a consumer can tell a blocking
// violation from an advisory one without re-deriving it (REQ-VER-008).
export type Violation = Diagnostic;

export type LayerStatus = "passed" | "failed" | "skipped";

export interface LayerReport {
  layer: VerifyLevel;
  // REQ-VER-007: a skipped layer is reported as skipped, never as passed.
  status: LayerStatus;
  violations: Violation[];
  // Project layer only (REQ-VER-006).
  command?: string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  // Anchors layer only (REQ-VER-012): how the repository was listed for the
  // fallback search, and how much of it that listing could see.
  listing?: { mode: "git" | "walk"; files: number };
}

export interface VerifyReport {
  // False when any executed layer failed. Maps to exit code 1 (REQ-CLI-004).
  ok: boolean;
  // Layers in execution order, including the ones that were skipped.
  layers: LayerReport[];
  // REQ-VER-001: the layer execution stopped at, absent when every layer ran.
  stoppedAt?: VerifyLevel;
  // Every violation of every executed layer, in layer order.
  violations: Violation[];
  // Layers configured off in `verify.levels`; they neither run nor appear
  // among `layers` (REQ-VER-002).
  disabled: VerifyLevel[];
}

export function countBySeverity(violations: readonly Violation[]): {
  errors: number;
  warnings: number;
} {
  return {
    errors: violations.filter((v) => v.severity === "error").length,
    warnings: violations.filter((v) => v.severity === "warning").length,
  };
}

// Human-readable rendering. REQ-VER-008 sends this to stderr when `--json` is
// active, so the JSON on stdout stays machine-parseable.
export function formatReport(report: VerifyReport): string {
  const lines: string[] = [];
  for (const layer of report.layers) {
    const { errors, warnings } = countBySeverity(layer.violations);
    const summary =
      layer.status === "skipped"
        ? "skipped"
        : `${layer.status} (${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"})`;
    lines.push(`${symbolFor(layer.status)} ${layer.layer}: ${summary}`);
    for (const violation of layer.violations) {
      const where = `${violation.file}:${violation.line}`;
      const id = violation.requirementId ? ` [${violation.requirementId}]` : "";
      lines.push(
        `    ${violation.severity} ${where}${id} ${violation.message}`,
      );
    }
    if (layer.listing) {
      lines.push(
        `    listed ${layer.listing.files} file${layer.listing.files === 1 ? "" : "s"} via ${layer.listing.mode}`,
      );
    }
    if (layer.stdout) lines.push(indent(layer.stdout));
    if (layer.stderr) lines.push(indent(layer.stderr));
  }

  if (report.disabled.length > 0) {
    lines.push(`  disabled in verify.levels: ${report.disabled.join(", ")}`);
  }
  if (report.stoppedAt !== undefined) {
    lines.push(`Stopped at layer "${report.stoppedAt}".`);
  }
  lines.push(report.ok ? "verify: passed" : "verify: failed");
  return lines.join("\n");
}

function symbolFor(status: LayerStatus): string {
  if (status === "passed") return "  ok  ";
  if (status === "failed") return " fail ";
  return " skip ";
}

function indent(text: string): string {
  return text
    .trimEnd()
    .split("\n")
    .map((line) => `    | ${line}`)
    .join("\n");
}
