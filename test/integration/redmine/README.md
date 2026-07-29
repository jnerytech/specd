# Local Redmine — fixture for the `sync` adapter

A pinned Redmine + Postgres pair, plus a seed that leaves the instance in a
state the `sync` adapter can be exercised against.

**The recipe is versioned; the data is not.** This directory holds the
reproducible part. Credentials, the emitted API key and any payload dumps go
to `sandbox/redmine/`, which is gitignored. If the compose file lived only in
`sandbox/`, it would disappear the moment that folder is cleaned — and the
integration tests would depend on a container whose recipe nobody has.

## Run the integration suite

```bash
npm run test:integration            # up, seed, test, down
npm run test:integration -- --keep  # same, but leave the container running
```

`npm run verify` does **not** call this, and `vitest.config.ts` excludes
`test/integration/`. The gate over this repository has to run without Docker,
or the offline layers stop being offline.

From a cold cache the whole cycle — pull, migrate, seed, test, tear down —
takes about 30 seconds.

## Bring it up by hand

```bash
docker compose -f test/integration/redmine/docker-compose.yml up -d
./test/integration/redmine/seed.sh
```

The seed writes `sandbox/redmine/.env` with the URL, the admin API key, the
project identifier and the custom-field IDs. Source it to talk to the
instance:

```bash
set -a; . sandbox/redmine/.env; set +a
curl -H "X-Redmine-API-Key: $REDMINE_API_KEY" "$REDMINE_URL/issues.json?project_id=$REDMINE_PROJECT"
```

Web UI: <http://localhost:18080>, `admin` / `admin`.

## Tear down / reset

```bash
docker compose -f test/integration/redmine/docker-compose.yml down      # stop, keep data
docker compose -f test/integration/redmine/docker-compose.yml down -v   # stop, wipe data
```

`down -v` plus `up -d` plus `seed.sh` returns to a known state. State lives in
named volumes (`specd-redmine_db-data`, `specd-redmine_redmine-files`), not in
a bind mount, so the wipe is the volume flag and nothing else.

## Pinned versions

| Component | Pin            | Why                                                                                                         |
| --------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Redmine   | `6.1.3-alpine` | Newest of the mature 6.x line. `7.0.0` exists but is a `.0.0`; 6.x is what deployed instances actually run. |
| Postgres  | `16.14-alpine` | Comfortably inside every Redmine 6 support matrix; PG 18 is newer than what Redmine 6 is tested against.    |

`latest` in a test environment is the same class of problem as an unpinned
third-party payload contract: it changes without notice, and the test breaks
with no apparent cause and nothing in the diff to point at.

## Overrides

Environment variables read by both files:

| Variable             | Default      |
| -------------------- | ------------ |
| `REDMINE_PORT`       | `18080`      |
| `POSTGRES_PASSWORD`  | `redmine`    |
| `PROJECT_IDENTIFIER` | `specd-sync` |

## What the seed creates

- REST API enabled (`Setting.rest_api_enabled`), admin's forced password
  change cleared, admin API key emitted
- Trackers `Epic`, `Story`, `Task` on top of the default `Bug`/`Feature`/`Support`
- Custom fields:
  - `Cliente` — string, **required**, all trackers. The case `[board.fields]`
    exists to serve.
  - `Sprint` — list, optional
  - `Times` — list, **multi-valued**. Its `value` is a JSON array, so the same
    key changes type depending on a field definition the issue payload does
    not fully carry.
- Workflow transitions copied from `Bug` onto the three new trackers — without
  them a `status_id` write answers 204 and does nothing (see below)
- Project `specd-sync` with four issues: an `Epic` with two `Story` children
  (exercises the collapse rule) and one parentless `Task` for contrast
- A non-admin project member, `specd-bot`, whose API key is emitted as
  `REDMINE_MEMBER_API_KEY`. It reads issues and gets 403 from
  `/custom_fields.json` — the token that reproduces the P8 case

The seed is idempotent — every object is looked up before it is created.
Running it twice changes nothing.

## Two creation paths, and why

Redmine's REST API is read-only for trackers, custom fields and settings.
There is no endpoint that creates a tracker or a custom field, and the API
cannot enable itself. Those go through `rails runner` inside the container.
The project and the issues go through REST, because that is the surface the
adapter will use and the seed should exercise it rather than bypass it.

## Gotchas found by running it

All three were found against the server, not the documentation.

**A tracker with no workflow silently drops a status change.** `PUT` with
`status_id` onto an issue whose tracker has no `WorkflowTransition` rows
answers **204** and does not apply it. The trackers this seed creates start
that way; `Bug`/`Feature`/`Support` do not, because the default data ships
their workflows. The seed now copies `Bug`'s transitions onto the new trackers,
and the adapter's `close` reads the item back rather than trusting the 204 —
a write that reports success without happening is the P8 failure arriving from
the board's side.

**`REDMINE_SECRET_KEY_BASE` does not reach `docker compose exec`.** The
entrypoint reads it and `export`s `SECRET_KEY_BASE` into the server process.
An exported variable belongs to that process, not to the container, so an
`exec` shell starts from the image environment and never sees it — and
`rails runner` aborts with ``Missing `secret_key_base` for 'production'
environment``. The compose file sets the unprefixed `SECRET_KEY_BASE`
instead, which both the server and every `exec` see.

**Default data is not loaded by the image.** On a fresh volume there are zero
issue statuses and zero trackers, so anything that assumes `Bug` exists fails.
The seed calls `Redmine::DefaultData::Loader` when `IssueStatus.count` is
zero.

Full observation log, with real payloads: `sandbox/runs/004-redmine-setup.md`.
