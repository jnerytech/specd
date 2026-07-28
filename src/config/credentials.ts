import { ConfigError } from "./errors.js";

// Known credential prefixes (GitHub, GitLab, Slack, OpenAI-style, AWS, Google
// OAuth, JWT). Deterministic and conservative: a match is always a credential.
const TOKEN_PREFIXES =
  /^(gh[pousr]_|github_pat_|glpat-|xox[abprs]-|sk-[A-Za-z0-9]|AKIA[0-9A-Z]|ya29\.|eyJ[A-Za-z0-9_-]{10,})/;

// Long unbroken base64/hex-ish blob mixing letters and digits, with no path
// separators or spaces — not something a human types as configuration.
const RANDOM_BLOB = /^[A-Za-z0-9+/=_-]{40,}$/;

export function looksLikeToken(value: string): boolean {
  if (TOKEN_PREFIXES.test(value)) return true;
  return RANDOM_BLOB.test(value) && /\d/.test(value) && /[A-Za-z]/.test(value);
}

// Credentials are read only through the environment variable named in
// `token_env` (REQ-CFG-003). This module performs no network access; a missing
// variable therefore always fails before any network call can happen.
export function resolveToken(
  tokenEnv: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[tokenEnv];
  if (value === undefined || value === "") {
    throw new ConfigError(
      `Environment variable "${tokenEnv}" is not set. ` +
        `Credentials are read only from the environment variable named in token_env; ` +
        `never write the token itself into a configuration file.`,
    );
  }
  return value;
}
