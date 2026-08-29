"""What is actually in Postgres after a seed.

These are measurements, not restatements of the loader. They run against the
committed rows from a fresh connection, which is the only way to answer the
question data-inventory.md section 8 could not: did every translation really
load, all the way through?

Skipped unless ATLAS_TEST_DATABASE_URL is set, and skipped per-translation when
the database has not been seeded, so the suite stays runnable on an empty one.
"""

from __future__ import annotations

import asyncpg
import pytest

from scripts.scripture_assertions import (
    SPOT_CHECK_KEYS,
    IntegrityFailure,
    assert_translation_is_sound,
)
from scripts.translation_catalogue import CATALOGUE

pytestmark = pytest.mark.integration

_CODES = sorted(CATALOGUE)


async def _skip_unless_loaded(connection: asyncpg.Connection, code: str) -> None:
    """Skip rather than fail when nobody has seeded this database."""
    loaded = await connection.fetchval(
        "SELECT EXISTS (SELECT 1 FROM verses WHERE translation = $1)", code
    )
    if not loaded:
        pytest.skip(f"{code} is not loaded; run `pnpm db:seed`")


@pytest.mark.parametrize("code", _CODES)
async def test_each_translation_passes_every_post_load_check(
    connection: asyncpg.Connection, code: str
) -> None:
    await _skip_unless_loaded(connection, code)

    try:
        await assert_translation_is_sound(connection, CATALOGUE[code])
    except IntegrityFailure as failure:
        pytest.fail(str(failure))


@pytest.mark.parametrize("code", _CODES)
async def test_each_translation_carries_a_displayable_attribution(
    connection: asyncpg.Connection, code: str
) -> None:
    """S-01 ships a switcher, and a switcher that cannot name its licence is
    the thing that turns a licence question into a licence problem."""
    await _skip_unless_loaded(connection, code)

    row = await connection.fetchrow(
        """
        SELECT s.license, s.attribution, s.url, s.share_alike, t.can_redistribute
        FROM translations t JOIN data_sources s ON s.id = t.source_id
        WHERE t.code = $1
        """,
        code,
    )

    assert row is not None
    assert row["license"] == "public-domain"
    assert row["attribution"].strip()
    assert row["url"].startswith("https://")
    assert row["share_alike"] is False
    assert row["can_redistribute"] is True


async def test_the_switcher_can_only_offer_catalogued_translations(
    connection: asyncpg.Connection,
) -> None:
    """A translation with verses but no catalogue entry is text nobody checked
    the licence of, reachable from the reader."""
    rows = await connection.fetch("SELECT DISTINCT translation FROM verses")
    present = {row["translation"] for row in rows}
    if not present:
        pytest.skip("database is not seeded")

    assert present <= set(CATALOGUE)
    assert "ESV" not in present


@pytest.mark.parametrize(("key", "reference"), SPOT_CHECK_KEYS)
async def test_the_same_verse_exists_in_every_loaded_translation(
    connection: asyncpg.Connection, key: int, reference: str
) -> None:
    """The switcher swaps translations without moving the reader, so a verse
    present in one and missing from another would drop them somewhere else."""
    rows = await connection.fetch("SELECT translation FROM verses WHERE verse_key = $1", key)
    loaded = await connection.fetchval("SELECT count(DISTINCT translation) FROM verses")
    if not loaded:
        pytest.skip("database is not seeded")

    assert len(rows) == loaded, f"{reference} is missing from at least one translation"
