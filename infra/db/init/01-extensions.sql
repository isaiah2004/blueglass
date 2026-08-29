-- ─────────────────────────────────────────────────────────────────────────────
-- Atlas Bible — first-boot database bootstrap.
--
-- Purpose
--   Install the Postgres extensions the Atlas Bible schema depends on, so that
--   a freshly created database is immediately usable by migrations and by
--   ad-hoc psql sessions.
--
-- Key responsibilities
--   - `vector`  : pgvector. Required by the retrieval store (docs/architecture/
--                 data-inventory.md §7 retires Chroma in favour of pgvector).
--   - `pg_trgm` : trigram index support. The prototype's scripture search used
--                 `ILIKE '%term%'`, which cannot use a B-tree index
--                 (data-inventory.md §2). Trigram GIN indexes fix that.
--
-- WHEN THIS RUNS
--   The official Postgres entrypoint executes `/docker-entrypoint-initdb.d/*`
--   in filename order EXACTLY ONCE — on the very first start against an empty
--   data directory. Editing this file afterwards has no effect on an existing
--   volume; see "Reset the database" in docs/DEVELOPMENT.md.
--
-- NOT SCHEMA
--   Table definitions belong in the backend's migrations (`apps/server/db/
--   migrations/`), applied by the `migrate` service. This file is deliberately
--   limited to cluster-level prerequisites that migrations should be able to
--   assume rather than each re-declare.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
