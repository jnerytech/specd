#!/usr/bin/env bash
#
# Owns the container's whole lifecycle for one integration run: up, seed, test,
# down. Invoked by `npm run test:integration`.
#
# `npm run verify` does not call this, and must not: the gate over this
# repository has to run without Docker, or the offline layers stop being
# offline.
#
# --keep leaves the container running afterwards, for iterating by hand.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
COMPOSE=("docker" "compose" "-f" "$HERE/docker-compose.yml")

KEEP=0
for argument in "$@"; do
  [ "$argument" = "--keep" ] && KEEP=1
done

cleanup() {
  local status=$?
  if [ "$KEEP" -eq 0 ]; then
    printf '\033[1;34m==>\033[0m tearing the container down\n'
    "${COMPOSE[@]}" down -v >/dev/null 2>&1 || true
  else
    printf '\033[1;34m==>\033[0m --keep: container left running\n'
  fi
  exit "$status"
}
trap cleanup EXIT

printf '\033[1;34m==>\033[0m bringing Redmine up\n'
"${COMPOSE[@]}" up -d

"$HERE/seed.sh"

printf '\033[1;34m==>\033[0m running the integration suite\n'
cd "$REPO_ROOT"
npx vitest run --config vitest.integration.config.ts
