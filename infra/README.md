# `infra/` — local development infrastructure

Everything needed to run Atlas Bible's backing services in Docker. Nothing here
is application code, and nothing here is deployment automation for a hosted
environment — this directory exists so that one `docker compose up` gives a
developer a working stack.

The stack itself is defined in `../docker-compose.yml`. The full operator guide,
including first run, resets and troubleshooting, is `../docs/DEVELOPMENT.md`.

| Path                          | Purpose                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/Dockerfile`              | The API image. Multi-stage (`base` → `deps` → `deps-dev` → `runtime-base` → `dev` \| `prod`), non-root uid 10001, dependencies in their own cache layer. `dev` carries pytest and ruff because the test suite runs in that container; `prod` branches off `deps` and never sees them. Build context is the **repository root**. |
| `api/Dockerfile.dockerignore` | Build-context exclusions. BuildKit prefers a `<dockerfile>.dockerignore` sibling over a root `.dockerignore`, which keeps the repository root free of an infra-only file. Denies everything, then re-includes `apps/api`, `packages/shared` and the two root `requirements*.txt`.                                               |
| `db/init/01-extensions.sql`   | Installs `vector` and `pg_trgm`. Mounted at `/docker-entrypoint-initdb.d/`, so it runs **once**, only against an empty data directory. Cluster prerequisites only — table definitions belong in migrations.                                                                                                                     |

## Conventions

- **Migrations are Alembic, not a script here.** They live in
  `../apps/api/db/versions/` and are applied by the `migrate` compose
  service, which runs `alembic upgrade head` in the API image. The bespoke
  SQL runner that used to live at `db/migrate.sh` was retired when the
  backend adopted Alembic — its own header named that as the end state.
- **Host ports are configurable, container ports are not.** Change
  `DB_HOST_PORT` / `API_HOST_PORT` in `.env`, never the right-hand side of a
  port mapping.
- **Secrets never live here.** `.env.example` documents every variable; real
  values go in the gitignored `.env`.
- **`db/init/` is not a migration directory.** Anything added there silently
  does nothing on an existing volume, which is a trap. Write an Alembic
  revision instead. `01-extensions.sql` stays because migration `0001` cannot
  assume `CREATE EXTENSION` privileges on every future database, and re-runs
  it defensively.

## Not here yet

There is no deployment infrastructure (no Terraform, Helm, or CI runner
definitions). The `prod` stage of `api/Dockerfile` is the only production-facing
artifact, and it is unused until there is somewhere to deploy it.
