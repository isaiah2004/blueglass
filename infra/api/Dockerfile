# syntax=docker/dockerfile:1.10
# ─────────────────────────────────────────────────────────────────────────────
# Atlas Bible — API image (FastAPI + uvicorn, Python 3.12).
#
# Purpose
#   Build the runtime for the Atlas Bible backend (`apps/api/`) so that a single
#   `docker compose up` yields a working API against Postgres/pgvector.
#
# Key responsibilities
#   - Install Python dependencies in an isolated venv, in their own cache layer,
#     so editing application code never re-resolves pip.
#   - Ship a non-root runtime (uid/gid 10001) — nothing in this service needs
#     root, and a compromised dependency should not get it.
#   - Offer two final stages:
#       `dev`  — no source baked in; `apps/api/` arrives via a bind mount so
#                `uvicorn --reload` sees host edits instantly. Dev dependencies
#                (pytest, ruff) are installed, because the test suite runs here.
#       `prod` — source copied in, immutable, no reloader, no test tooling.
#
# Build context
#   The REPOSITORY ROOT, not `apps/api/`. The dependency manifests live at the
#   root (rule 5.0.3 — one Python manifest) and `packages/shared` must stay
#   reachable for the cross-language book-table contract test. Exclusions live
#   in `infra/api/Dockerfile.dockerignore` — BuildKit reads a
#   `<dockerfile>.dockerignore` sibling, so the repo root stays clean.
#
# Usage
#   docker compose build api                      # dev stage (compose default)
#   docker build -f infra/api/Dockerfile --target prod -t atlas-api:local .
# ─────────────────────────────────────────────────────────────────────────────

ARG PYTHON_VERSION=3.12

# ── Stage: base ──────────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

# ── Stage: deps ──────────────────────────────────────────────────────────────
# Compilers and headers live ONLY here. asyncpg and pydantic-core publish
# manylinux wheels, but a transitive dependency without one must still be able
# to build rather than failing the image.
FROM base AS deps

RUN apt-get update \
    && apt-get install --no-install-recommends --yes \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv "${VIRTUAL_ENV}"

# Manifests are copied ALONE, before any source, so a code edit does not
# invalidate this layer.
COPY requirements.txt /tmp/requirements.txt

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --requirement /tmp/requirements.txt

# ── Stage: deps-dev ──────────────────────────────────────────────────────────
# Adds the test runner and linter on top of the runtime venv. Separate stage so
# `prod` can branch off `deps` and never carry them.
FROM deps AS deps-dev

COPY requirements-dev.txt /tmp/requirements-dev.txt

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --requirement /tmp/requirements-dev.txt

# ── Stage: runtime-base ──────────────────────────────────────────────────────
FROM base AS runtime-base

# Fixed uid/gid: bind-mounted files must map to a predictable owner, and a fixed
# id keeps `docker compose exec` predictable across machines.
RUN groupadd --gid 10001 atlas \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin atlas

EXPOSE 8000

# ── Stage: dev (compose default) ─────────────────────────────────────────────
# No source COPY. `docker-compose.yml` bind-mounts ./apps/api onto /app, so
# every save on the host is picked up by the reloader. See the compose file for
# WATCHFILES_FORCE_POLLING, which Windows hosts require.
FROM runtime-base AS dev

COPY --from=deps-dev --chown=10001:10001 /opt/venv /opt/venv

USER 10001:10001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app"]

# ── Stage: prod ──────────────────────────────────────────────────────────────
# Immutable image for deployment. Not used by the local stack.
FROM runtime-base AS prod

COPY --from=deps --chown=10001:10001 /opt/venv /opt/venv
COPY --chown=10001:10001 apps/api /app

USER 10001:10001

# Worker count is intentionally low: each uvicorn worker holds its own asyncpg
# pool (max_size 10), so this must stay well under Postgres's default
# max_connections of 100.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
