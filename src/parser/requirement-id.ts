// REQ-FMT-002: the only accepted shape for a requirement identifier.
export const REQ_ID_PATTERN = /^REQ-[A-Z][A-Z0-9]*-\d{3}$/;

// Human-readable form of REQ_ID_PATTERN, quoted verbatim in error messages so
// the author sees the rule and not only the rejection.
export const REQ_ID_PATTERN_DESCRIPTION =
  'REQ-<PREFIX>-<NNN> (uppercase prefix, three digits) — pattern "^REQ-[A-Z][A-Z0-9]*-\\d{3}$", e.g. "REQ-AUTH-003"';

export function isValidRequirementId(id: string): boolean {
  return REQ_ID_PATTERN.test(id);
}

// Prefix segment of a valid identifier, e.g. "AUTH" for "REQ-AUTH-003".
export function prefixOf(id: string): string | undefined {
  const match = /^REQ-([A-Z][A-Z0-9]*)-\d{3}$/.exec(id);
  return match?.[1];
}

// REQ-FMT-002: the prefix need not equal the capability name, but a divergence
// is worth a warning. A prefix is accepted as an abbreviation of the capability
// when its letters appear in order inside the capability name — that admits
// ANC/anchors, CFG/config and FMT/spec-format while still flagging AUTH inside
// a capability named billing.
export function isPrefixAbbreviationOf(
  prefix: string,
  capability: string,
): boolean {
  const haystack = capability.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  let cursor = 0;
  for (const char of prefix) {
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return false;
    cursor = found + 1;
  }
  return true;
}
