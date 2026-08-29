# `apps/api` — the Atlas Bible API

FastAPI, Python 3.12, Postgres 16 + pgvector. Serves the M1 scripture read API:
translations, the 66-book canon, chapters, indexed verse search, chapter study
content, and reader preferences.

It is a **rewrite** of the prototype at `A:/Work/spark/spark-app/server`
(read-only), not a port of its code. The response bodies keep the prototype's
field names so the ported reader consumes them unchanged; the structure,
the failure modes and the three defects below are all new.

Run it: `docker compose up -d` from the repository root. Full operator guide:
[`../../docs/DEVELOPMENT.md`](../../docs/DEVELOPMENT.md).

---

## Layering

Dependencies flow **inward only** (`.claude/rules/project-structure.md` §5.1).

```
presentation  ──▶  application  ──▶  domain
      │                 │              ▲
      │                 └── ports ─────┤
      ▼                                │
  config/container ──▶ infrastructure ─┘   (implements the ports)
```

| Layer                | Where                           | Rule                                                                                                                   |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Domain**           | `app/modules/*/domain/`         | Pure. Zero infrastructure imports — asserted by `tests/unit/test_error_vocabulary.py`, which parses each module's AST. |
| **Application**      | `app/modules/*/application/`    | Use cases and the `Protocol` ports they need. Owns every business rule and every error code.                           |
| **Infrastructure**   | `app/modules/*/infrastructure/` | Adapters. Turn rows into domain objects; decide nothing.                                                               |
| **Presentation**     | `app/modules/*/presentation/`   | Routes and wire models. Call a use case, map the result.                                                               |
| **Composition root** | `app/config/container.py`       | The **only** place a concrete class is chosen.                                                                         |

`app/shared/` holds the cross-cutting concerns — the error vocabulary, the JSON
logger, the correlation-id middleware, the error envelope. They are middleware
and decorators, never calls scattered through business logic (§5.1.3).

## Modules

| Module      | Serves                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `health`    | `GET /health` (liveness, touches nothing), `GET /ready` (readiness, pings the database).          |
| `scripture` | `GET /translations`, `GET /books`, `GET /chapters/{translation}/{book}/{chapter}`, `GET /search`. |
| `identity`  | `GET /me`, `GET /me/prefs`, `PUT /me/prefs`. Owns the identity seam.                              |
| `study`     | `GET /study/{book}/{chapter}` (public), `PUT /study/{book}/{chapter}` (identified).               |
| `retrieval` | No routes yet. Owns the pgvector distance/score arithmetic and its adapter.                       |

## The three defects this service does not have

Recorded in [`../../docs/decisions/DECISIONS.md`](../../docs/decisions/DECISIONS.md) §4.
Each has a test named after it that fails if it comes back.

1. **Auth was fake.** Every `/me/*` route in the prototype resolved to the string
   `dev-user` (`server/app/routers/user.py:15`). Here there is one seam —
   `current_identity` in `app/presentation_dependencies.py` — delegating to an
   `IdentityResolver` the container chooses. Today that resolver reads an
   anonymous device-id header (decision `A-01`); swapping it for token validation
   is a one-line change in the container. **There is no fallback subject.**

2. **`PUT /study/{book}/{chapter}` was an unauthenticated write** that also
   injected its body into the RAG index — anyone reachable could rewrite what the
   grounded-chat surface cites. Here the write requires an identity, records the
   author on the row, and touches no index: indexing is a build step over stored
   rows, not a side effect of an HTTP request.

3. **RAG relevance scores were wrong.** Chroma was persisted with the `l2` space
   while `rag/store.py:71` computed `1.0 - distance` as if it were cosine. The
   operator and the arithmetic are one decision, so they now live in one module:
   `app/modules/retrieval/domain/similarity.py` names the operator as a constant
   and the SQL is built from it. The HNSW index uses `vector_cosine_ops`, and a
   test reads that from the live catalog rather than trusting the migration file.

## Error envelope

Every non-2xx response, from any source, has one shape:

```json
{
  "error": {
    "code": "chapter_out_of_range",
    "message": "Proverbs has 31 chapters; 99 is out of range.",
    "details": { "book": "Proverbs", "chapter": 99, "chapter_count": 31 },
    "request_id": "8f2c1e4a..."
  }
}
```

`code` is the contract; `message` is safe to show a reader; `request_id` matches
the `X-Request-Id` response header and appears on every log line for that
request. An unhandled exception yields `internal_error` with **no** internals —
an exception message can carry a DSN or a row of user data.

## Migrations

Alembic, in `db/versions/`, applied by the `migrate` compose service. No ORM
models and no `--autogenerate`: the schema uses generated columns, GiST range
indexes and pgvector opclasses that SQLAlchemy cannot express, and a
half-autogenerated migration is worse than none.

## Tests

```bash
docker compose exec api pytest        # 148 passed, 17 integration skipped
docker compose exec api ruff check .
```

Contract tests build the real app and swap the container's repositories for
in-memory doubles — every endpoint and every documented error code, with no
database. Integration tests need `ATLAS_TEST_DATABASE_URL` and cover what a
double cannot: that the SQL parses, the indexes exist, and pgvector ranks the way
the score arithmetic assumes.

## Loading scripture

One command, from the repository root, takes a fresh clone to a working reader:

```bash
pnpm db:seed      # up -d db, alembic upgrade head, then scripts.seed
pnpm db:verify    # measured row counts, from a fresh connection
```

It loads four translations — **BSB, KJV, WEB, ASV**, 124,372 verses — from the
committed cache in `data/scripture/`, so it works with the network unplugged.
Individual pieces:

```bash
docker compose run --rm --no-deps api python -m scripts.load_scripture BSB
docker compose run --rm --no-deps api python -m scripts.verify_scripture
```

Every translation in the catalogue is **public domain**, verified against the
publisher's own licence statement and recorded in `data/scripture/PROVENANCE.md`.
Licence, attribution and source URL go into `data_sources`, linked from
`translations.source_id`, so the reader can render an attribution from the
database. **ESV appears in the product mockups and is licensed — it must never
be added.**

Three gates run before any load commits: the cached payload's SHA-256 must match
`data/scripture/manifest.json`, the parsed row count must match the catalogue's
measured verse count, and the committed table must pass every check in
`scripts/scripture_assertions.py`. All three run inside one transaction, so a
failure rolls back rather than publishing a half-Bible.
