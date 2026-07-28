// REQ-EXP-006 — the bundle is generated content, but it is versioned content.
//
// Marking it `linguist-generated` collapses it in review diffs without hiding
// it from git. It deliberately does not go into `.gitignore`: context that
// cannot be reviewed in a diff is context nobody can audit.
export const GENERATED_PATTERNS: readonly string[] = [
  ".specd/changes/*/explore/** linguist-generated=true",
  ".specd/changes/*/explore/**/*.json diff=json",
];

export const GITATTRIBUTES_HEADER = "# Managed by specd — generated context";

export function gitattributesBlock(): string {
  return [GITATTRIBUTES_HEADER, ...GENERATED_PATTERNS, ""].join("\n");
}
