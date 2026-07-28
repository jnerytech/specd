// Parser findings are collected, not thrown. The gate must be able to report
// every violation of a spec file in one run instead of stopping at the first
// one; `verify` maps errors to a gate failure (exit 1) and surfaces warnings
// without failing.
export type Severity = "error" | "warning";

export interface Diagnostic {
  severity: Severity;
  // Absolute or repository-relative path of the file the finding belongs to.
  file: string;
  // 1-based line number of the offending construct.
  line: number;
  message: string;
  // Requirement the finding belongs to, when it was raised inside one.
  requirementId?: string;
}

export interface DiagnosticInput {
  file: string;
  line: number;
  message: string;
  requirementId?: string;
}

export function error(input: DiagnosticInput): Diagnostic {
  return { severity: "error", ...input };
}

export function warning(input: DiagnosticInput): Diagnostic {
  return { severity: "warning", ...input };
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}
