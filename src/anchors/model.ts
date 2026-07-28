// REQ-ANC-001: an anchor is a required `file` path plus an optional `symbol`.
// The path is always interpreted from the repository root, never from the
// location of the spec file that declares it.
export interface Anchor {
  file: string;
  symbol?: string;
}

// An anchor together with the position it was declared at, so diagnostics can
// point back at the exact line of the capability file.
export interface AnchorDeclaration {
  anchor: Anchor;
  // 1-based line number inside the declaring file.
  line: number;
}
