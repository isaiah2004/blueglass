"""One command: put every catalogued translation in the database and prove it.

Purpose
    A fresh clone should reach a working reader in one step. `pnpm db:seed`
    brings up Postgres, applies the migrations and runs this, which loads all
    four public-domain translations from the committed cache in
    data/scripture/ -- no network, no manual ordering, no half-done state.

Usage
    pnpm db:seed                                        # from the repo root
    docker compose run --rm api python -m scripts.seed  # directly

Behaviour
    Idempotent. Every translation is replaced inside its own transaction, so
    re-seeding a populated database is safe and re-seeding after a partial
    failure resumes cleanly. The final step is verify_scripture, whose exit code
    becomes this script's -- a seed that "succeeded" with a translation missing
    is a seed that failed.
"""

from __future__ import annotations

import asyncio

from scripts.load_scripture import load_all
from scripts.translation_catalogue import CATALOGUE
from scripts.verify_scripture import verify


async def seed() -> int:
    """Load everything, then verify everything. Returns an exit code."""
    codes = list(CATALOGUE)
    print(f"[seed] loading {len(codes)} translations: {', '.join(codes)}", flush=True)
    await load_all(codes)
    return await verify()


def main() -> int:
    """CLI entry point."""
    return asyncio.run(seed())


if __name__ == "__main__":
    raise SystemExit(main())
