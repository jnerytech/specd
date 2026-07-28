import type { AnchorSearchStrategy } from "../strategy.js";

// REQ-ANC-005: grep is the only strategy shipped in version 1. It is a literal
// substring search — no language grammar, no WASM, no heuristics — which is
// what makes the ladder reproducible on any stack.
export const grepStrategy: AnchorSearchStrategy = {
  name: "grep",
  matches(content: string, symbol: string): boolean {
    return content.includes(symbol);
  },
  find(content: string, symbol: string): number | undefined {
    const index = content.indexOf(symbol);
    if (index === -1) return undefined;
    let line = 1;
    for (let i = 0; i < index; i++) {
      if (content[i] === "\n") line++;
    }
    return line;
  },
};
