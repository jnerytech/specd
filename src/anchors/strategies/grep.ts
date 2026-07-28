import type { AnchorSearchStrategy } from "../strategy.js";

// Characters that can belong to an identifier in the languages specd sees.
// `$` is there for JavaScript, `_` for nearly everything.
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;

// REQ-ANC-005: grep is the only strategy shipped in version 1 — no language
// grammar, no WASM, no heuristics — which is what makes the ladder reproducible
// on any stack.
//
// REQ-ANC-010: it matches an identifier, not a substring. A plain
// `content.includes(symbol)` makes any symbol match every longer identifier it
// prefixes, and that is not hypothetical: in a real repository
// `public class TenantAccessor` also matched
// `public class TenantAccessorRegisterMiddleware`, so the ladder refused a
// suggestion over an ambiguity that did not exist.
export const grepStrategy: AnchorSearchStrategy = {
  name: "grep",
  matches(content: string, symbol: string): boolean {
    return indexOfSymbol(content, symbol) !== -1;
  },
  find(content: string, symbol: string): number | undefined {
    const index = indexOfSymbol(content, symbol);
    if (index === -1) return undefined;
    let line = 1;
    for (let i = 0; i < index; i++) {
      if (content[i] === "\n") line++;
    }
    return line;
  },
};

// First occurrence of `symbol` delimited by non-identifier characters.
//
// The boundary is only checked on a side whose own edge character could join an
// identifier: an anchor like `"bin"` or `export const X` already ends in
// punctuation, and demanding a boundary there would reject every legitimate
// match.
export function indexOfSymbol(content: string, symbol: string): number {
  if (symbol.length === 0) return -1;
  const needsLeft = IDENTIFIER_CHAR.test(symbol[0] as string);
  const needsRight = IDENTIFIER_CHAR.test(symbol[symbol.length - 1] as string);

  let from = 0;
  for (;;) {
    const index = content.indexOf(symbol, from);
    if (index === -1) return -1;
    const before = index === 0 ? "" : (content[index - 1] as string);
    const after = content[index + symbol.length] ?? "";
    const leftOk = !needsLeft || before === "" || !IDENTIFIER_CHAR.test(before);
    const rightOk = !needsRight || after === "" || !IDENTIFIER_CHAR.test(after);
    if (leftOk && rightOk) return index;
    from = index + 1;
  }
}
