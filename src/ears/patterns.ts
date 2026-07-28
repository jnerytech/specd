// The five EARS statement patterns (REQ-EARS-001). Nothing else is accepted.
export type EarsPattern =
  | "ubiquitous"
  | "event-driven"
  | "state-driven"
  | "unwanted-behaviour"
  | "optional-feature";

// REQ-EARS-002: EARS keywords are syntax, not prose. They are matched in
// English, uppercase, whatever language the requirement is written in.
export const KEYWORDS = {
  WHEN: "WHEN",
  WHILE: "WHILE",
  IF: "IF",
  THEN: "THEN",
  WHERE: "WHERE",
  SHALL: "SHALL",
  SHALL_NOT: "SHALL NOT",
} as const;

export interface EarsPatternSpec {
  pattern: EarsPattern;
  // Leading keyword, absent for the ubiquitous pattern.
  lead?: "WHEN" | "WHILE" | "IF" | "WHERE";
  // Shape quoted back to the author when nothing matches.
  template: string;
}

export const EARS_PATTERNS: readonly EarsPatternSpec[] = [
  {
    pattern: "ubiquitous",
    template: "The <system> SHALL <response>",
  },
  {
    pattern: "event-driven",
    lead: "WHEN",
    template: "WHEN <trigger>, the <system> SHALL <response>",
  },
  {
    pattern: "state-driven",
    lead: "WHILE",
    template: "WHILE <state>, the <system> SHALL <response>",
  },
  {
    pattern: "unwanted-behaviour",
    lead: "IF",
    template: "IF <condition>, THEN the <system> SHALL <response>",
  },
  {
    pattern: "optional-feature",
    lead: "WHERE",
    template: "WHERE <feature>, the <system> SHALL <response>",
  },
] as const;

// REQ-EARS-002: keywords translated into the prose language are the most
// likely mistake once requirements are written in another language, so they
// are named explicitly instead of falling through to "no SHALL found".
export const TRANSLATED_KEYWORDS: Readonly<Record<string, string>> = {
  QUANDO: "WHEN",
  CUANDO: "WHEN",
  LORSQUE: "WHEN",
  WENN: "WHEN",
  ENQUANTO: "WHILE",
  MIENTRAS: "WHILE",
  PENDANT: "WHILE",
  SE: "IF",
  SI: "IF",
  FALLS: "IF",
  ENTAO: "THEN",
  ENTÃO: "THEN",
  ENTONCES: "THEN",
  ALORS: "THEN",
  DANN: "THEN",
  ONDE: "WHERE",
  DONDE: "WHERE",
  DEVE: "SHALL",
  DEVERA: "SHALL",
  DEVERÁ: "SHALL",
  DEBE: "SHALL",
  DEBERA: "SHALL",
  DEBERÁ: "SHALL",
  DOIT: "SHALL",
  MUSS: "SHALL",
};

export function templateFor(pattern: EarsPattern): string {
  const spec = EARS_PATTERNS.find((p) => p.pattern === pattern);
  return spec?.template ?? "";
}

export function allTemplates(): string {
  return EARS_PATTERNS.map((p) => `  ${p.pattern}: ${p.template}`).join("\n");
}
