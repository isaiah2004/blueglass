"""The migrated schema is what the code assumes it is.

A migration file is a claim. These tests read the live catalog and check it.
"""

from __future__ import annotations

import re
from pathlib import Path

import asyncpg
import pytest

pytestmark = pytest.mark.integration

_EXPECTED_TABLES = {
    "alembic_version",
    "chapter_studies",
    "cross_references",
    "data_sources",
    "embeddings",
    "identities",
    "identity_preferences",
    "place_mentions",
    "place_names",
    "places",
    "passages",
    "route_stops",
    "routes",
    "translations",
    "verses",
}

_VERSIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "versions"
_REVISION = re.compile(r'^revision = "([^"]+)"', re.MULTILINE)
#: down_revision is a string, None, or -- for a merge revision -- a tuple of
#: strings. Every quoted id on the line is a parent.
_DOWN_REVISION = re.compile(r"^down_revision = (.+)$", re.MULTILINE)
_QUOTED = re.compile(r'"([^"]+)"')


def _migration_head() -> str:
    """The one revision nothing else builds on.

    Computed rather than hardcoded: several agents author migrations in this
    repository at once, and a literal "0003" here would have to be edited by
    whoever happened to land last. Two heads are a genuine defect -- alembic
    upgrade head cannot choose between them -- so this fails on that too.
    """
    revisions: set[str] = set()
    parents: set[str] = set()
    for path in _VERSIONS_DIR.glob("*.py"):
        source = path.read_text(encoding="utf-8")
        found = _REVISION.search(source)
        assert found is not None, f"{path.name} declares no revision id"
        revisions.add(found.group(1))
        declared = _DOWN_REVISION.search(source)
        if declared is not None:
            parents.update(_QUOTED.findall(declared.group(1)))
    heads = revisions - parents
    assert len(heads) == 1, f"Expected exactly one migration head, found {heads}"
    return heads.pop()


async def test_every_expected_table_exists(connection: asyncpg.Connection) -> None:
    rows = await connection.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )
    present = {row["tablename"] for row in rows}

    assert _EXPECTED_TABLES <= present


async def test_migrations_are_at_head(connection: asyncpg.Connection) -> None:
    version = await connection.fetchval("SELECT version_num FROM alembic_version")

    assert version == _migration_head()


async def test_both_q009_shapes_exist(connection: asyncpg.Connection) -> None:
    """Decision Q-009: BOTH verse rows and passage rows, denormalised."""
    rows = await connection.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )
    present = {row["tablename"] for row in rows}

    assert {"verses", "passages"} <= present


async def test_the_search_indexes_exist(connection: asyncpg.Connection) -> None:
    """The prototype's leading-wildcard ILIKE could not use an index at all."""
    rows = await connection.fetch(
        "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'verses'"
    )
    definitions = {row["indexname"]: row["indexdef"] for row in rows}

    assert "gin" in definitions["verses_tsv_idx"].lower()
    assert "gin_trgm_ops" in definitions["verses_trgm_idx"]


async def test_the_verse_tsvector_is_generated_not_stored_by_hand(
    connection: asyncpg.Connection,
) -> None:
    """A generated column cannot drift from the text it indexes."""
    generated = await connection.fetchval(
        "SELECT is_generated FROM information_schema.columns "
        "WHERE table_name = 'verses' AND column_name = 'text_tsv'"
    )

    assert generated == "ALWAYS"


async def test_a_verse_row_cannot_name_a_book_outside_the_canon(
    connection: asyncpg.Connection,
) -> None:
    """Port-map risk 10 produced book_number 0 rows. The database refuses them."""
    await connection.execute(
        "INSERT INTO translations (code, name) VALUES ('TEST', 'Test') ON CONFLICT DO NOTHING"
    )
    with pytest.raises(asyncpg.CheckViolationError):
        await connection.execute(
            "INSERT INTO verses (verse_key, translation, book_number, chapter, "
            "verse, osis_id, text) VALUES (1, 'TEST', 0, 1, 1, 'X.1.1', 'x')"
        )


async def test_a_study_row_must_name_its_author(
    connection: asyncpg.Connection,
) -> None:
    """Defect 2 at the schema level: an unattributable claim cannot be stored."""
    with pytest.raises(asyncpg.NotNullViolationError):
        await connection.execute(
            "INSERT INTO chapter_studies (book_number, chapter, content) "
            "VALUES (20, 1, '{}'::jsonb)"
        )


async def test_the_badge_sql_and_the_loader_agree_on_the_primary_name_offset(
    connection: asyncpg.Connection,
) -> None:
    """One constant, written down twice, and the failure would be silent.

    The loader adds `PRIMARY_NAME_WEIGHT` to a primary spelling's weight so a
    place's own name outranks a variant; `CHAPTER_PLACES` subtracts it back out
    to recover the raw translation count the admissibility gates divide by. If
    the two drift, every primary spelling's attestation becomes a nine-figure
    number, every variant falls under the share threshold, and the Route badge
    quietly loses its variants without erroring.
    """
    from app.modules.badges.infrastructure.badge_sql import PRIMARY_NAME_WEIGHT
    from scripts.place_rows import PRIMARY_NAME_WEIGHT as LOADER_WEIGHT

    assert PRIMARY_NAME_WEIGHT == LOADER_WEIGHT

    highest = await connection.fetchval(
        "SELECT max(weight) FROM place_names WHERE kind = 'translation'"
    )
    if highest is None:
        pytest.skip("The gazetteer is not loaded; run scripts.ingest_places.")
    # And the offset really is an offset, not a value a variant could reach.
    assert highest < PRIMARY_NAME_WEIGHT
