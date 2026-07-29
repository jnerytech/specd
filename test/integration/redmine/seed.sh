#!/usr/bin/env bash
#
# Brings the local Redmine instance to a state the `sync` adapter can be
# exercised against, and writes the emitted API key to sandbox/redmine/.env.
#
# Idempotent by construction: every object is looked up before it is created,
# so running this twice changes nothing. Same discipline as `hooks install`.
#
# Two creation paths, because Redmine's REST API does not cover everything:
#   - rails runner: settings, trackers, custom fields, API key (no REST write
#     endpoint exists for any of these)
#   - REST API: project and issues (this is the surface the adapter will use,
#     so the seed exercises it rather than bypassing it)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
SANDBOX_DIR="$REPO_ROOT/sandbox/redmine"
ENV_FILE="$SANDBOX_DIR/.env"

REDMINE_PORT="${REDMINE_PORT:-18080}"
BASE_URL="http://localhost:${REDMINE_PORT}"
PROJECT_IDENTIFIER="${PROJECT_IDENTIFIER:-specd-sync}"
PROJECT_NAME="${PROJECT_NAME:-specd sync fixture}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
fail() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 2
}

dc() { docker compose -f "$HERE/docker-compose.yml" "$@"; }

# ---------------------------------------------------------------------------
# 0. wait for the container to actually serve
# ---------------------------------------------------------------------------

log "waiting for Redmine at ${BASE_URL} ..."
deadline=$((SECONDS + 300))
# Redmine resets the connection (curl 56) while Puma is still binding, so the
# loop must swallow stderr — the failures here are expected, not diagnostic.
until curl -fsS -o /dev/null "${BASE_URL}/login" 2>/dev/null; do
  [ "$SECONDS" -lt "$deadline" ] || fail "Redmine did not become ready in 300s"
  sleep 2
done
log "Redmine is serving after ${SECONDS}s"

# ---------------------------------------------------------------------------
# 1. things with no REST write endpoint: settings, trackers, custom fields
# ---------------------------------------------------------------------------
#
# The REST API is disabled by default (Setting.rest_api_enabled). There is no
# bootstrap endpoint to turn it on, and the API cannot enable itself. The only
# non-manual path is the Rails console inside the container.

log "enabling REST API, seeding trackers and custom fields ..."
RUNNER_OUT="$(dc exec -T redmine bundle exec rails runner - <<'RUBY'
# Default data (statuses, priorities, base trackers) is not loaded by every
# entrypoint path. Load it only when the tables are empty.
if IssueStatus.count.zero?
  Redmine::DefaultData::Loader.load('en')
  puts "DEFAULT_DATA=loaded"
else
  puts "DEFAULT_DATA=present"
end

Setting.rest_api_enabled = '1'

admin = User.find_by_login('admin') or abort 'no admin user'
if admin.must_change_passwd?
  admin.must_change_passwd = false
  admin.save!(validate: false)
end

default_status = IssueStatus.order(:position).first or abort 'no issue status'

# Trackers the mapping will use. Tracker has no REST write endpoint.
%w[Epic Story Task].each do |name|
  t = Tracker.find_or_initialize_by(name: name)
  next unless t.new_record?
  t.default_status = default_status
  t.save!
end

trackers = Tracker.all.to_a

# A tracker created without workflow rows accepts `status_id` on a PUT, answers
# 204, and does not apply it — measured, and the reason `close` reads back. The
# fixture copies the default tracker's transitions so it behaves like a board
# somebody actually configured, instead of one that lies quietly.
source_tracker = Tracker.find_by(name: 'Bug')
if source_tracker
  %w[Epic Story Task].each do |name|
    target = Tracker.find_by(name: name) or next
    next if WorkflowTransition.where(tracker_id: target.id).exists?
    WorkflowTransition.copy(source_tracker, nil, target, nil)
  end
end
puts "WORKFLOWS=#{WorkflowTransition.where(tracker_id: Tracker.where(name: %w[Epic Story Task]).select(:id)).count}"

# At least one REQUIRED custom field. This is the case `[board.fields]` exists
# to serve; without it the adapter is born never exercising the part that
# differs per client.
cliente = IssueCustomField.find_or_initialize_by(name: 'Cliente')
cliente.field_format = 'string'
cliente.is_required  = true
cliente.is_for_all   = true
cliente.is_filter    = true
cliente.trackers     = trackers
cliente.save!

# One optional list field, to see how a non-required field of a non-string
# format is shaped in the payload.
sprint = IssueCustomField.find_or_initialize_by(name: 'Sprint')
sprint.field_format    = 'list'
sprint.possible_values = %w[S-1 S-2 S-3]
sprint.is_required     = false
sprint.is_for_all      = true
sprint.is_filter       = true
sprint.trackers        = trackers
sprint.save!

# One multi-valued field. Its `value` in an issue payload is an ARRAY, not a
# string — the same key changes JSON type depending on a field definition the
# issue payload does not carry. An adapter that assumes `string` breaks here.
times = IssueCustomField.find_or_initialize_by(name: 'Times')
times.field_format    = 'list'
times.possible_values = %w[plataforma produto dados]
times.multiple        = true
times.is_required     = false
times.is_for_all      = true
times.trackers        = trackers
times.save!

puts "CF_TIMES_ID=#{times.id}"
puts "REDMINE_VERSION=#{Redmine::VERSION.to_s}"
puts "RAILS_VERSION=#{Rails.version}"
puts "DB_ADAPTER=#{ActiveRecord::Base.connection.adapter_name}"
puts "CF_CLIENTE_ID=#{cliente.id}"
puts "CF_SPRINT_ID=#{sprint.id}"
# User#api_key creates the API token on first read.
puts "API_KEY=#{admin.api_key}"
RUBY
)" || fail "rails runner failed"

printf '%s\n' "$RUNNER_OUT" | sed 's/^API_KEY=.*/API_KEY=<redacted>/'

get_kv() { printf '%s\n' "$RUNNER_OUT" | grep -m1 "^$1=" | cut -d= -f2-; }

API_KEY="$(get_kv API_KEY)"
CF_CLIENTE_ID="$(get_kv CF_CLIENTE_ID)"
CF_SPRINT_ID="$(get_kv CF_SPRINT_ID)"
CF_TIMES_ID="$(get_kv CF_TIMES_ID)"
REDMINE_VERSION="$(get_kv REDMINE_VERSION)"
[ -n "$API_KEY" ] || fail "could not read the admin API key"

api() {
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" \
    -H "X-Redmine-API-Key: ${API_KEY}" \
    -H 'Content-Type: application/json' \
    "$@" "${BASE_URL}${path}"
}

# ---------------------------------------------------------------------------
# 2. project — REST, idempotent by identifier
# ---------------------------------------------------------------------------

if api GET "/projects/${PROJECT_IDENTIFIER}.json" >/dev/null 2>&1; then
  log "project ${PROJECT_IDENTIFIER} already exists"
else
  log "creating project ${PROJECT_IDENTIFIER} ..."
  TRACKER_IDS="$(api GET '/trackers.json' |
    python3 -c 'import json,sys; print(json.dumps([t["id"] for t in json.load(sys.stdin)["trackers"]]))')"
  api POST '/projects.json' --data @- >/dev/null <<JSON
{"project":{"name":"${PROJECT_NAME}","identifier":"${PROJECT_IDENTIFIER}",
 "is_public":true,"tracker_ids":${TRACKER_IDS},
 "enabled_module_names":["issue_tracking","time_tracking"]}}
JSON
fi

# ---------------------------------------------------------------------------
# 3. issues — REST, idempotent by subject
# ---------------------------------------------------------------------------

existing_id_for() {
  api GET "/issues.json?project_id=${PROJECT_IDENTIFIER}&status_id=*&limit=100" |
    python3 -c '
import json, sys
want = sys.argv[1]
for i in json.load(sys.stdin)["issues"]:
    if i["subject"] == want:
        print(i["id"]); break
' "$1"
}

# tracker_name, subject, cliente, sprint, times (comma list), parent_id ("" for none)
ensure_issue() {
  local tracker="$1" subject="$2" cliente="$3" sprint="$4" times="$5" parent="${6:-}"
  local found
  found="$(existing_id_for "$subject")"
  if [ -n "$found" ]; then
    printf '%s' "$found"
    return
  fi
  local tracker_id
  tracker_id="$(api GET '/trackers.json' |
    python3 -c 'import json,sys; print(next(t["id"] for t in json.load(sys.stdin)["trackers"] if t["name"]==sys.argv[1]))' "$tracker")"
  local parent_field=""
  [ -n "$parent" ] && parent_field=",\"parent_issue_id\":${parent}"
  # A multi-valued field takes a JSON array on write, not a string.
  local times_json
  times_json="$(printf '%s' "$times" |
    python3 -c 'import json,sys; s=sys.stdin.read().strip(); print(json.dumps([v for v in s.split(",") if v]))')"
  api POST '/issues.json' --data @- <<JSON |
{"issue":{"project_id":"${PROJECT_IDENTIFIER}","tracker_id":${tracker_id},
 "subject":"${subject}","description":"seeded by test/integration/redmine/seed.sh"
 ${parent_field},
 "custom_fields":[{"id":${CF_CLIENTE_ID},"value":"${cliente}"},
                  {"id":${CF_SPRINT_ID},"value":"${sprint}"},
                  {"id":${CF_TIMES_ID},"value":${times_json}}]}}
JSON
    python3 -c 'import json,sys; print(json.load(sys.stdin)["issue"]["id"])'
}

log "seeding issues ..."
EPIC_ID="$(ensure_issue Epic 'Sincronizar specd com o board' 'ACME' 'S-1' 'plataforma,dados')"
CHILD_A="$(ensure_issue Story 'Ler cards do board' 'ACME' 'S-1' 'plataforma' "$EPIC_ID")"
CHILD_B="$(ensure_issue Story 'Escrever de volta no board' 'ACME' 'S-2' 'plataforma' "$EPIC_ID")"
# No pai, and the multi-valued field left empty — the contrast case.
FLAT_ID="$(ensure_issue Task 'Issue sem pai, para contraste' 'GLOBEX' 'S-3' '')"
log "epic=${EPIC_ID} children=${CHILD_A},${CHILD_B} flat=${FLAT_ID}"

# ---------------------------------------------------------------------------
# 4. a non-admin member, and why the fixture needs one
# ---------------------------------------------------------------------------
#
# `/custom_fields.json` is admin-only: a non-admin gets 403 with an EMPTY body,
# while `/trackers.json` and `/issue_statuses.json` are readable by an ordinary
# project member. That asymmetry is the P8 case — an adapter holding a real
# client's token can read issues but cannot read what the fields mean, and must
# say so instead of assuming a format. The fixture ships the token that
# reproduces it.

log "ensuring the non-admin member exists ..."
BOT_OUT="$(dc exec -T redmine bundle exec rails runner - <<RUBY
user = User.find_by_login('specd-bot')
if user.nil?
  user = User.new(login: 'specd-bot', firstname: 'specd', lastname: 'bot',
                  mail: 'specd-bot@example.invalid', language: 'en')
  user.password = 'specd-bot-password-1'
  user.admin = false
  user.save!
end
user.activate! unless user.active?
if user.must_change_passwd?
  user.must_change_passwd = false
  user.save!(validate: false)
end

project = Project.find_by_identifier('${PROJECT_IDENTIFIER}') or abort 'no project'
role = Role.givable.find_by(name: 'Manager') || Role.givable.first or abort 'no role'
member = Member.find_or_initialize_by(user: user, project: project)
member.roles = [role]
member.save!

puts "BOT_ADMIN=#{user.admin?}"
puts "BOT_KEY=#{user.api_key}"
RUBY
)" || fail "could not create the non-admin member"

printf '%s\n' "$BOT_OUT" | sed 's/^BOT_KEY=.*/BOT_KEY=<redacted>/'
BOT_KEY="$(printf '%s\n' "$BOT_OUT" | grep -m1 '^BOT_KEY=' | cut -d= -f2-)"
[ -n "$BOT_KEY" ] || fail "could not read the non-admin API key"

# ---------------------------------------------------------------------------
# 5. emit credentials — gitignored
# ---------------------------------------------------------------------------

mkdir -p "$SANDBOX_DIR"
cat >"$ENV_FILE" <<ENV
# Generated by test/integration/redmine/seed.sh. Gitignored.
# Local test instance only — these credentials are not secrets and the
# instance is not reachable off-host.
REDMINE_URL=${BASE_URL}
REDMINE_PORT=${REDMINE_PORT}
REDMINE_VERSION=${REDMINE_VERSION}
REDMINE_API_KEY=${API_KEY}
REDMINE_PROJECT=${PROJECT_IDENTIFIER}
REDMINE_ADMIN_USER=admin
REDMINE_ADMIN_PASSWORD=admin
# Ordinary project member, not an admin. Reads issues; gets 403 with an empty
# body from /custom_fields.json. This is the token the P8 test uses.
REDMINE_MEMBER_API_KEY=${BOT_KEY}
CF_CLIENTE_ID=${CF_CLIENTE_ID}
CF_SPRINT_ID=${CF_SPRINT_ID}
CF_TIMES_ID=${CF_TIMES_ID}
SEED_EPIC_ID=${EPIC_ID}
SEED_FLAT_ID=${FLAT_ID}
ENV
chmod 600 "$ENV_FILE"

log "wrote ${ENV_FILE}"
log "done — Redmine ${REDMINE_VERSION} at ${BASE_URL}, project ${PROJECT_IDENTIFIER}"
