# Local development

How to run Atlas Bible's backing services on your machine. Every command here is
copy-pasteable as written, from the repository root (`W:\spark-expo`).

The client (`apps/mobile`) runs on the host via Expo. Everything it talks to —
Postgres, the API, the embeddings server — runs in Docker, so the only thing you
install is Docker itself.

---

## Contents

1. [What the stack contains](#1-what-the-stack-contains)
2. [Current status — read this first](#2-current-status--read-this-first)
3. [Prerequisites](#3-prerequisites)
4. [First run](#4-first-run)
5. [Day to day](#5-day-to-day)
6. [The database](#6-the-database)
7. [Logs](#7-logs)
8. [Tests](#8-tests)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What the stack contains

| Service | Image | Host port | Started by default? | Purpose |
|---|---|---|---|---|
| `db` | `pgvector/pgvector:pg16` | `5436` | yes | Postgres 16 + pgvector + pg_trgm. Scripture, enrichment, user data, vector index. |
| `api` | built from `infra/api/Dockerfile` | `8010` | yes | FastAPI under `uvicorn --reload`. Source bind-mounted from `apps/api`. |
| `migrate` | same image as `api` | — | runs during `up`, then exits | `alembic upgrade head`. `api` waits for it to succeed. |
| `embeddings` | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.8` | `8091` | no — profile `embeddings` | Local BGE-M3 fallback. `Q-010` was answered *against* self-hosting — the production path is a paid embedding API — so this is for offline experiments only. |

```
host                              docker network `atlas_bible_net`
─────────────────────────────     ─────────────────────────────────────
apps/mobile  (Expo, host)         ┌──────────────┐
   │ EXPO_PUBLIC_API_URL          │  api :8000   │──┐
   └──── localhost:8010 ─────────▶│  uvicorn     │  │ postgresql://…@db:5432
                                  └──────┬───────┘  │
apps/api/    ── bind mount ─────────────┘          ▼
   (hot reload, no rebuild)                  ┌──────────────┐
                                             │  db :5432    │
psql / loaders ── localhost:5436 ───────────▶│  pgvector    │
                                             └──────────────┘
                                  ┌────────────────────────┐
                                  │ embeddings :80         │  profile: embeddings
                                  └────────────────────────┘
```

Files that define all of this, and who owns them:

| Path | What it is |
|---|---|
| `docker-compose.yml` | The stack. Ports, volumes, health, profiles. |
| `infra/api/Dockerfile` | API image. Multi-stage, non-root, `dev` and `prod` targets. |
| `infra/api/Dockerfile.dockerignore` | Build-context exclusions for that Dockerfile. |
| `infra/db/init/01-extensions.sql` | First-boot extension bootstrap. Runs once, on an empty volume. |
| `apps/api/db/versions/` | Alembic migrations. The `migrate` service applies them. |
| `requirements.txt` · `requirements-dev.txt` | The repository's only Python manifests (rule 5.0.3). |
| `.env.example` | Template for `.env`. Every variable documented. |

---

## 2. Current status — read this first

**The whole stack works.** `apps/api/` serves the M1 scripture read API against
Postgres. Everything in the table below was run on 2026-08-29; the outputs quoted
elsewhere in this document are real, not illustrations.

| Command | Works today? |
|---|---|
| `docker compose config` | ✅ yes |
| `docker compose build api` | ✅ yes |
| `docker compose up -d` | ✅ yes — db healthy, migrations applied, api healthy in ~9 s cold |
| `docker compose run --rm migrate` | ✅ yes — `alembic upgrade head`, idempotent |
| `docker compose exec api pytest` | ✅ yes — 181 passed, 29 integration skipped |
| `docker compose exec -e ATLAS_TEST_DATABASE_URL=$DATABASE_URL api pytest` | ✅ yes — 210 passed |

**What is NOT here yet.** M1 covers reading. These endpoints from
`docs/architecture/flutter-port-map.md` §5 are not ported: cross-references
(`/verses/{osis}/cross-references`), chat streaming (`/chat/stream`), notes,
highlights, reading progress, saved conversations. Their schema partly exists;
their routes do not.

### The endpoint paths CHANGED from the prototype

The response bodies keep the prototype's field names so the ported reader
consumes them unchanged, but three paths moved. If you are porting client code,
this is the mapping:

| Prototype | Here | Why |
|---|---|---|
| `GET /read/{book}/{chapter}?translation=` | `GET /chapters/{translation}/{book}/{chapter}` | The translation identifies the resource, so it belongs in the path, not in a query string. |
| `GET /search/scripture?q=&book=` | `GET /search?q=&translation=&scope=` | `scope` is `all` or a book token — the two pills the reader UI actually offers. |
| `GET /me/prefs` returned bare, `PUT` wanted wrapped | both wrapped in `prefs` | The prototype's asymmetry meant a client could not write back what it read. |
| — | `GET /books` | New. The 66-book table, served from the domain constant, so it answers before any data is loaded. |
| — | `GET /ready` | New. Liveness and readiness are different questions. |

---

## 3. Prerequisites

| Software | Minimum version | Check with | Notes |
|---|---|---|---|
| Docker Engine | `>= 27.0` | `docker version` | Docker Desktop 4.30+ on Windows/macOS. Verified on 29.2.1. |
| Docker Compose | `>= 2.24` | `docker compose version` | Needs `env_file: required: false`. Verified on v5.0.2. |
| Node.js | `>= 20.19.4` | `node -v` | Client only. See `README.md`. |
| pnpm | `10.33.0` | `pnpm -v` | Client only. |

Also required:

- **WSL 2 backend** on Windows (Docker Desktop → Settings → General). The Hyper-V
  backend does not bind-mount reliably.
- **Drive sharing** for the drive holding this repo. Docker Desktop → Settings →
  Resources → File sharing. On Windows with WSL 2 this is automatic for local
  fixed drives; a network or substituted drive must be added by hand.
- **~4 GB free disk** for images, plus **~3 GB more** if you enable the
  `embeddings` profile (model weights).
- No account or API key is needed to run the database. An OpenRouter key is only
  needed for AI features — see `OPENROUTER_API_KEY` in `.env.example`.

---

## 4. First run

```bash
# 1 — create your local environment file. Never edit .env.example itself.
cp .env.example .env

# 2 — start everything. One command: Postgres boots, Alembic migrates, the API
#     starts only once the migration has succeeded.
docker compose up -d

# 3 — confirm.
curl http://localhost:8010/health
curl http://localhost:8010/ready
```

Real output from a cold start on an empty volume:

```
{"status":"ok","service":"atlas-api","version":"0.3.0","environment":"local"}
{"status":"ready","checks":{"database":"ok"}}
```

`docker compose ps -a` then shows — note that `migrate` is *meant* to be exited:

```
api       Up 11 seconds (healthy)
migrate   Exited (0) 11 seconds ago
db        Up 18 seconds (healthy)
```

Interactive API docs: <http://localhost:8010/docs>. OpenAPI JSON:
<http://localhost:8010/openapi.json>.

### Load real scripture

The database starts empty, so `GET /translations` returns `{"translations":[]}`
and every chapter is a 404. `GET /books` still answers, because the canon is a
domain constant rather than data.

```bash
pnpm db:seed      # from the repository root: db up, migrate, load, verify
```

```
[seed] loading 4 translations: BSB, KJV, WEB, ASV
[load] BSB: 31086 verses committed
[load] KJV: 31102 verses committed
[load] WEB: 31098 verses committed
[load] ASV: 31086 verses committed
[verify] OK: 4 translations loaded and sound
```

**124,372 verses.** All four are public domain, verified against the publisher's
own licence statement — see `data/scripture/PROVENANCE.md`. The text comes from
the committed cache in `data/scripture/sources/`, so this works offline; nothing
is fetched at load time.

The counts legitimately differ. The ASV and BSB follow the critical text and
print sixteen verses empty (Matt 17:21, 18:11, 23:14; Mark 7:16, 9:44, 9:46,
11:26, 15:28; Luke 17:36, 23:17; John 5:4; Acts 8:37, 15:34, 24:7, 28:29; Rom
16:24), which are dropped rather than stored blank. The WEB prints five of them
empty and sets the Romans doxology at 14:24-26 rather than 16:25-27. Each count
is asserted twice — on the parsed rows and again on the committed table, inside
the loading transaction — so a truncated or tampered file aborts rather than
leaving a half-Bible that looks healthy.

`pnpm db:verify` re-measures at any time. It also flags a translation that has
verses but no catalogue entry, which is how unlicensed text would reach the
switcher.

### Read something

```bash
curl "http://localhost:8010/chapters/BSB/John/3" | jq '.verses[15]'
curl "http://localhost:8010/search?q=lamp+unto+my+feet" | jq '.results[0].ref'
curl "http://localhost:8010/chapters/ASV/John/3" | jq -r '.verses[15].text'
```

The book token is tolerant — `John`, `Jhn`, `43`, `1cor`, `sos`, `iii john` and
`Song of Songs` all resolve.

### Endpoints that need an identity

There is no login. A client mints a stable random device id once and sends it as
`X-Atlas-Device-Id` on every request (decision `A-01`). There is **no anonymous
fallback**: without the header these routes are `401 identity_required`.

```bash
DEV="X-Atlas-Device-Id: device-$(openssl rand -hex 8)"
curl -H "$DEV" http://localhost:8010/me
curl -H "$DEV" -X PUT -H 'Content-Type: application/json'      -d '{"prefs":{"rag":true,"verseSize":19}}' http://localhost:8010/me/prefs
```

---

## 5. Day to day

```bash
docker compose up -d              # start everything (detached)
docker compose stop               # stop containers, keep them and the data
docker compose start              # start them again
docker compose down               # remove containers + network, KEEP the data volume
docker compose ps                 # what is running, and is it healthy
```

**Editing backend code.** Just save the file. `apps/api/` is bind-mounted into
the API container, and `uvicorn --reload` restarts the app in about a second. You
do **not** rebuild. Confirm it happened:

```bash
docker compose logs -f api
# WARNING:  WatchFiles detected changes in 'app/main.py'. Reloading...
```

**When you *do* need a rebuild** — only when dependencies change:

```bash
docker compose build api && docker compose up -d api
```

**Get a shell in a container:**

```bash
docker compose exec api bash     # runs as the non-root `atlas` user
docker compose exec db bash
```

**Run the client against the stack:**

```bash
pnpm web        # Expo web  — EXPO_PUBLIC_API_URL=http://localhost:8010
pnpm dev        # Expo Go / dev client
```

Android emulator cannot resolve `localhost` to your host — set
`EXPO_PUBLIC_API_URL=http://10.0.2.2:8010` in `.env`. A physical device needs your
machine's LAN IP, and that origin must also be added to `ALLOWED_ORIGINS`.

**Enable the embeddings server** (large download on first start):

```bash
docker compose --profile embeddings up -d embeddings
curl http://localhost:8091/health
```

---

## 6. The database

### Connect

```bash
# inside the container — no host client needed
docker compose exec db psql -U atlas -d atlas

# from the host, with your own psql / TablePlus / DBeaver
# host localhost · port 5436 · user atlas · password atlas · database atlas
psql "postgresql://atlas:atlas@localhost:5436/atlas"
```

### Run migrations

`docker compose up -d` already runs them — `api` will not start until they
succeed. Run them alone after authoring a new revision:

```bash
docker compose run --rm migrate            # alembic upgrade head
```

Migrations are **Alembic**, in `apps/api/db/versions/`, applied by the same image
the API runs so `env.py` can import `app.config` for the DSN. That is deliberate:
there is exactly one place a connection string comes from, so it is impossible to
migrate a different database than the one the service talks to.

```bash
docker compose exec api alembic current              # what is applied
docker compose exec api alembic history --verbose    # the chain
docker compose exec api alembic downgrade -1         # step back one
docker compose exec api alembic revision -m "add x"  # author a new one
```

`alembic revision` writes into the bind mount, so the new file lands on the host
where you can edit and commit it.

There are no ORM models and `--autogenerate` is not used. The schema has
generated columns, GiST range indexes and pgvector opclasses that SQLAlchemy
cannot express, and a half-autogenerated migration is worse than none. Migrations
are written as SQL inside `op.execute`.

What exists today:

| Revision | Contents |
|---|---|
| `0001` | `data_sources`, `translations`, `verses` (generated `tsvector` + GIN + trigram), `passages` (GiST range index). Both Q-009 shapes from commit one. |
| `0002` | `identities`, `identity_preferences`, `chapter_studies`. No `dev-user` row exists anywhere. |
| `0003` | `embeddings` — `vector(1536)` with an HNSW index on **`vector_cosine_ops`**. |

### Reset the database

Destroys all data and re-runs the first-boot bootstrap:

```bash
docker compose down -v            # -v also deletes the named volumes
docker compose up -d              # boots, migrates and starts the API again
docker compose exec api python -m scripts.load_scripture --all
```

`down -v` removes `atlas_bible_pgdata` **and** `atlas_bible_hf_cache`, so the
embeddings model will re-download. To keep the weights, remove only the database
volume:

```bash
docker compose down
docker volume rm atlas_bible_pgdata
docker compose up -d
```

### Dump and restore

```bash
docker compose exec -T db pg_dump -U atlas -d atlas --format=custom > atlas.dump
docker compose exec -T db pg_restore -U atlas -d atlas --clean --if-exists < atlas.dump
```

---

## 7. Logs

```bash
docker compose logs -f                 # everything, followed
docker compose logs -f api             # one service
docker compose logs --tail 200 db      # last 200 lines
docker compose logs --since 10m api    # recent only
```

Health-probe failures do not appear in `logs`. Read them from the container state:

```bash
docker inspect --format "{{json .State.Health}}" atlas-db
```

---

## 8. Tests

The JavaScript side runs on the host and needs no containers:

```bash
pnpm test            # Vitest, unit + logic
pnpm typecheck
pnpm lint
pnpm e2e             # Playwright — run `npx playwright install chromium` once first
```

**Backend tests** run inside the API container, so no host Python environment is
needed:

```bash
docker compose exec api pytest                 # 181 passed, 29 skipped
docker compose exec api ruff check .           # lint
docker compose exec api ruff format --check .  # formatting
```

The suite is in two halves, deliberately:

- **Contract and unit tests** build the real application and swap the container's
  repositories for in-memory doubles. They cover every endpoint, every documented
  error code, the identity seam and the error envelope — in about three seconds,
  with no database. That is what makes it affordable to test every failure path
  and not only the happy one.
- **Integration tests** need a live Postgres and are skipped unless
  `ATLAS_TEST_DATABASE_URL` is set. They cover what a double cannot prove: that
  the SQL parses, that the indexes exist, and that pgvector's distance operator
  ranks the way the score arithmetic assumes. Each runs inside a transaction that
  is rolled back, so they are safe against a database with real scripture loaded.

```bash
docker compose exec -e ATLAS_TEST_DATABASE_URL=postgresql://atlas:atlas@db:5432/atlas   api pytest                                   # 210 passed
```

Three test files are named after the three prototype defects recorded in
`docs/decisions/DECISIONS.md` §4. Each would fail if its defect were reintroduced:

| File | Defect |
|---|---|
| `tests/contract/test_defect_1_no_hardcoded_user.py` | Every `/me/*` route resolved to the literal `dev-user`. |
| `tests/contract/test_defect_2_study_write_requires_identity.py` | `PUT /study/{book}/{chapter}` was an unauthenticated write that also injected into the RAG index. |
| `tests/unit/test_defect_3_relevance_scores.py` + `tests/integration/test_pgvector_ranking.py` | Chroma persisted with L2 while the code computed `1.0 - distance` as if cosine. |

**Budget note.** Any test touching the AI layer must go through the spend guard
(`ATLAS_AI_CEILING_USD`, default `$2.00`, `$0.25` under `CI=true`). It fails closed.
See `docs/architecture/ai-model-strategy.md` §4.2 — an automated loop must not be
able to drain the key.

---

## 9. Troubleshooting

### `docker compose up` fails: `service "migrate" didn't complete successfully`

The schema could not be applied, so the API was correctly kept down rather than
being allowed to serve 500s against missing tables. Read the reason:

```bash
docker compose logs migrate
```

Common causes: a syntax error in a new revision; two revisions claiming the same
`down_revision`; or a database whose data predates a migration that has since
been edited. Editing an applied migration is not supported — add a new one, or
[reset](#reset-the-database).

### Port conflicts — `bind: address already in use` / `Ports are not available`

Something else on your machine already holds the host port. On this machine
`5432` is a native Postgres install and `5435` belongs to the Flutter prototype's
stack, which is why the defaults here are `5436` and `8010`.

Find the offender:

```bash
# Windows
netstat -ano | findstr ":5436"
tasklist /FI "PID eq <pid-from-above>"

# macOS / Linux
lsof -nP -iTCP:5436 -sTCP:LISTEN
```

Then change the **host** side only — never the container port — in `.env`:

```ini
DB_HOST_PORT=5437
API_HOST_PORT=8011
EMBEDDINGS_HOST_PORT=8092
```

```bash
docker compose up -d --force-recreate
```

Remember to update `DATABASE_URL` and `EXPO_PUBLIC_API_URL` in `.env` to match —
they are host-side values.

### Stale volume — schema changes or `01-extensions.sql` edits do nothing

`/docker-entrypoint-initdb.d/*` runs **exactly once**, on the very first start
against an empty data directory. If the volume already exists, your edit is
ignored and there is no error message. Symptoms: `ERROR: type "vector" does not
exist`, or a database whose collation or user is not what `.env` says.

```bash
docker compose down -v
docker compose up -d db
```

To confirm which volume is actually in use:

```bash
docker volume ls | grep atlas
docker inspect atlas-db --format "{{json .Mounts}}"
```

An old volume from an earlier experiment can also linger under a different
project name. `docker volume ls` shows everything; `atlas_bible_pgdata` is the
only one this stack should use.

### `Cannot connect to the Docker daemon`

Docker Desktop is not running. Start it, wait for the whale icon to stop
animating, then:

```bash
docker info --format "{{.ServerVersion}}"
```

### Hot reload does not fire

The API container sets `WATCHFILES_FORCE_POLLING=true` because inotify events do
not cross the Windows → WSL 2 bind-mount boundary; without polling the reloader
watches silently and never fires. If reload has stopped working:

1. Confirm the variable survived: `docker compose exec api env | grep WATCHFILES`.
2. Confirm the mount is live: `docker compose exec api ls -la /app` should show
   your files with current timestamps.
3. If you set `WATCHFILES_FORCE_POLLING=false` in `.env` on a Windows host, that
   is the cause. Set it back to `true`.

Keeping the repository on the Windows filesystem (`W:\`) rather than inside the
WSL 2 filesystem is what forces polling. Moving the repo into WSL 2 makes
event-driven reload work and is noticeably faster, but changes every path in the
fleet's documentation — not worth it today.

### The API container starts and immediately exits

Check the exit reason first:

```bash
docker compose ps -a
docker compose logs api
```

Common causes: `apps/api/app/main.py` has no `app` object; a dependency is
imported but missing from `requirements.txt` (rebuild after adding it); or the
database is refusing connections — but `depends_on: service_healthy` should have
prevented the last one, so check `docker compose ps` for `db` health too.

### Everything is wedged — full reset

Destroys containers, network, and **all local data**. It does not touch the
Flutter prototype's stack.

```bash
docker compose down -v --remove-orphans
docker image rm atlas-bible/api:dev
docker compose build --no-cache api
docker compose up -d
```

### Known limitations

- Scripture text is fetched from `raw.githubusercontent.com` at load time; no
  snapshot is vendored in the repository yet (`docs/ROADMAP.md`, M1).
- Only the reading half of the port map's 23 endpoints is implemented. See
  [section 2](#2-current-status--read-this-first).
- Migrations run automatically on `up`. On a large future migration that means
  `up` blocks until it finishes; that is intended, but it is not instant.
- `embeddings` has no healthcheck: the image ships no probe utility and the first
  start spends minutes downloading weights. Poll `http://localhost:8091/health`
  from the host instead.
- The database credentials in `.env.example` are deliberately trivial. They are
  local-only; a deployed environment must source them from a secret manager.
