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

## Loading History and Structure enrichment

Two deterministic ingests, no model and no network. Run them in this order —
dating joins against the passages the structure ingest loads:

```bash
docker compose exec api python -m scripts.ingest_structure   # passages + chiasms
docker compose exec api python -m scripts.ingest_history     # rulers + dating
```

Measured on 2026-08-29, from the files in `data/raw/`:

|                                                           |                   Rows |
| --------------------------------------------------------- | ---------------------: |
| `passages` (scheme `murai`)                               |              **2,005** |
| `literary_structures` · `structure_nodes`                 | **1,830** · **10,085** |
| `rulers` (Roman Empire, Judaea, Achaia)                   |                 **43** |
| `historical_events` (203 events × the books they narrate) |                **329** |
| `passage_dating` (New Testament only)                     |                **510** |

Both loaders are idempotent, verify each source file's SHA-256 against
`data/raw/<dir>/PROVENANCE.md` before parsing, and prove the committed rows
inside the loading transaction — `scripts/structure_assertions.py` and
`scripts/history_assertions.py`. A count that moves fails the load.

Three rules are enforced by the schema rather than by convention:

- **`Q-016` — dating is New Testament only.** The only open per-passage dating
  descends from Ussher's chronology. A `book_number` CHECK on `passage_dating`
  and `historical_events` means an Old Testament year cannot be inserted at all.
- **`Q-015` — Murai's structure is one scholar's reading.** Every row carries
  `attributed_to`, `claim_label` (`Murai's reading`) and
  `claim_type = 'interpretive'`, all NOT NULL, so no UI can omit the framing.
- **`AI-05` — every claim carries a source anchor.** `source_id` is NOT NULL on
  every table here, so a row with no provenance cannot exist and no badge can
  render one.

**Licence carve-out.** Murai's spreadsheets quote the NAB, NRSV and NJB, which
are not his to license. `scripts/murai_copyright.py` drops any cell carrying a
verse reference or a quotation mark — 7,108 of 10,078 English cells — and the
Japanese column, which is contaminated the same way, is never read. An
integration test re-proves in SQL that nothing quoted survived.

## Loading People/Lineage and the Cultural dictionary

Two more deterministic ingests, no model and no network at load time. Either
order is fine — neither depends on the other:

```bash
docker compose exec api python -m scripts.ingest_people      # genealogy graph
docker compose exec api python -m scripts.ingest_dictionary  # citation table
```

Measured on 2026-08-29, from the acquired files in `data/raw/`:

|                                                                    |         Rows |
| ------------------------------------------------------------------ | ------------: |
| `people` (Theographic, every row loaded regardless of `status`)     |     **3,069** |
| `person_relations` — `parent-of`                                    |     **1,784** |
| `person_relations` — `spouse-of`                                    |       **104** |
| `person_mentions`                                                   |    **28,240** |
| `dictionary_entries` (Easton 3,962 + Smith 4,561)                   |     **8,523** |
| `dictionary_citations` (single-verse and same-chapter refs only)    |    **54,545** |

Both loaders are idempotent, verify their source files' SHA-256 against
`data/raw/<dir>/PROVENANCE.md` before parsing, and prove the committed rows
inside the loading transaction — `scripts/person_assertions.py` and
`scripts/dictionary_assertions.py`.

**Lineage is a graph, not prose.** `person_relations.kind` is only
`parent-of` or `spouse-of` — Theographic also publishes siblings, but
`LineageRelationKind` (`packages/shared`) has no sibling variant yet, so
Theographic's sibling columns are not loaded. Deriving that edge is a product
decision about what the badge draws, not something this loader should decide
by writing a row nothing downstream reads.

**Cultural is a citation table, not the badge.** `dictionary_entries`/
`dictionary_citations` give the Cultural badge's authored `explanation` prose
(M7, `Q-024`) something deterministic to quote and cite. The loader writes no
prose itself. NEUU's Easton + Smith was chosen over unfoldingWord's `en_tn`
per `docs/architecture/dataset-validation.md` §3.5 ("Option D"): `en_tn` is
officially NEEDS-DECISION and only 18.7% of its Acts notes are culturally
informative, where Easton/Smith are cleared USE and verse-indexed across the
whole canon. Of 56,155 raw scripture references in the two dictionaries,
54,545 (97.1%) resolve to one verse or a same-chapter range and become a
citation row; the rest — whole-chapter references, cross-chapter ranges, and
a small number of malformed sentinel values the source itself carries — are
counted and reported by the loader rather than guessed at.

**`Q-007` (share-alike) applies to people, not the dictionary.** Theographic
is CC BY-SA 4.0, so `people`/`person_relations`/`person_mentions` stay in
their own tables, reachable by `WHERE share_alike` on their `data_sources`
row, and must never be blended into a bundled or redistributed record. NEUU
is CC BY 4.0 (its two source dictionaries are themselves public domain), so
`dictionary_entries`/`dictionary_citations` carry no share-alike obligation —
only the same `AI-05` `source_id` every table here carries.
