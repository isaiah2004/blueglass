"""No loaded place name prints OpenBible's homonym index, and none lost it.

Against real Postgres, in a rolled-back transaction.

The bug these exist for: `places.name` was OpenBible's `friendly_id`, which
disambiguates same-named places with a trailing ordinal. Measured on the live
database before the fix, 315 of 1,342 places carried one, reaching the reader
through 2,305 mentions across 1,983 verses and 1,827 stops on 485 routes. A
badge printing "Ramah 2" beside scripture asserts a name no manuscript uses,
which pillar 3 forbids.

The other half is asserted just as hard: the ordinal is retained, not deleted.
Nine towns sharing one indistinguishable label would be the worse bug.
"""

from __future__ import annotations

import asyncpg
import pytest

from scripts.place_assertions import (
    EXPECTED_INDEXED,
    EXPECTED_NAMES,
    EXPECTED_SHARED_NAME_PLACES,
)
from scripts.place_disambiguation import NAME_INDEX_SQL_PATTERN, split_display_name
from scripts.place_gazetteer import (
    GazetteerEntry,
    NameLink,
    PlaceGazetteer,
    normalise_place_name,
)

pytestmark = pytest.mark.integration

#: The two Antiochs, by OpenBible id. Syria is "Antioch 1", Pisidia "Antioch 2".
ANTIOCH_SYRIA_ID = "ae41ab4"
ANTIOCH_PISIDIA_ID = "a6c704a"

#: A genuine modern site name that ends in a number. It proves the fix is a
#: rule about one column, not a blanket strip of digits.
MODERN_SITE_WITH_A_NUMBER = "Feldstein et al Site 43"

_SOURCE_ID = "SELECT id FROM data_sources WHERE key = 'openbible_geocoding'"


async def _require_loaded(connection: asyncpg.Connection) -> int:
    source_id = await connection.fetchval(_SOURCE_ID)
    if source_id is None:
        pytest.skip("The gazetteer is not loaded; run scripts.ingest_places.")
    return int(source_id)


async def test_not_one_place_name_prints_a_homonym_index(
    connection: asyncpg.Connection,
) -> None:
    """The measured count was 315 of 1,342. It must be zero."""
    await _require_loaded(connection)
    offending = await connection.fetch(
        "SELECT place_id, name FROM places WHERE name ~ $1 ORDER BY name LIMIT 10",
        NAME_INDEX_SQL_PATTERN,
    )

    assert offending == [], f"names still carrying an index: {offending}"


async def test_the_database_itself_refuses_a_name_carrying_an_index(
    connection: asyncpg.Connection,
) -> None:
    """The regression guard. The loader COPYs inside one transaction, so this
    constraint aborts a bad load instead of publishing it."""
    source_id = await _require_loaded(connection)

    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        await connection.execute(
            "INSERT INTO places (place_id, name, slug, feature_type, source_id) "
            "VALUES ('atest', 'Ramah 2', 'ramah-2', 'settlement', $1)",
            source_id,
        )


async def test_a_name_that_merely_contains_a_digit_is_still_accepted(
    connection: asyncpg.Connection,
) -> None:
    """The constraint rejects the artefact -- a trailing ordinal -- not every
    name with a number in it."""
    source_id = await _require_loaded(connection)
    await connection.execute(
        "INSERT INTO places (place_id, name, slug, feature_type, source_id) "
        "VALUES ('atest', '2 Rivers Ford', 'two-rivers-ford', 'settlement', $1)",
        source_id,
    )

    assert (
        await connection.fetchval("SELECT name FROM places WHERE place_id = 'atest'")
        == "2 Rivers Ford"
    )


async def test_the_constraint_is_scoped_to_the_column_a_reader_reads(
    connection: asyncpg.Connection,
) -> None:
    """ "Feldstein et al Site 43" is a real archaeological site. It is a MODERN
    site name, so it belongs in modern_name and place_names -- columns the
    constraint deliberately leaves alone. A blanket strip would have renamed it,
    and a blanket constraint would have refused to store it."""
    source_id = await _require_loaded(connection)
    await connection.execute(
        "INSERT INTO places (place_id, name, slug, modern_name, feature_type, "
        "source_id) VALUES ('atest', 'Rekem', 'rekem-test', $1, 'settlement', $2)",
        MODERN_SITE_WITH_A_NUMBER,
        source_id,
    )

    assert (
        await connection.fetchval("SELECT modern_name FROM places WHERE place_id = 'atest'")
        == MODERN_SITE_WITH_A_NUMBER
    )


async def test_the_ordinal_was_moved_not_deleted(
    connection: asyncpg.Connection,
) -> None:
    """Every one of the 315 is still recoverable, so name + index round-trips
    back to the published friendly_id."""
    await _require_loaded(connection)
    retained = await connection.fetchval(
        "SELECT count(*) FROM places WHERE disambiguation_index IS NOT NULL"
    )
    row = await connection.fetchrow(
        "SELECT name, disambiguation_index, slug FROM places WHERE place_id = $1",
        ANTIOCH_PISIDIA_ID,
    )

    assert retained == EXPECTED_INDEXED
    assert row is not None
    assert f"{row['name']} {row['disambiguation_index']}" == "Antioch 2"
    assert row["slug"] == "antioch-2"


async def test_a_shared_name_admits_that_it_is_shared(
    connection: asyncpg.Connection,
) -> None:
    """DECISIONS #10: surface the uncertainty rather than silently picking one.
    homonym_count is what lets a sheet say "one of nine places called Ramah"."""
    await _require_loaded(connection)
    shared = await connection.fetchval("SELECT count(*) FROM places WHERE homonym_count > 1")
    ramah = await connection.fetchval(
        "SELECT homonym_count FROM places WHERE name = 'Ramah' LIMIT 1"
    )
    lying = await connection.fetchval(
        "SELECT count(*) FROM places p WHERE p.homonym_count <> "
        "(SELECT count(*) FROM places o WHERE o.name = p.name)"
    )

    assert shared == EXPECTED_SHARED_NAME_PLACES
    assert ramah == 9
    assert lying == 0


async def test_the_source_note_is_stored_as_text_a_sheet_can_render(
    connection: asyncpg.Connection,
) -> None:
    """OpenBible's own words distinguish the two Antiochs, and it publishes
    them as HTML. Markup reaching a badge is the same failure one layer along."""
    await _require_loaded(connection)
    notes = dict(
        await connection.fetch(
            "SELECT place_id, disambiguation FROM places WHERE place_id = ANY($1)",
            [ANTIOCH_SYRIA_ID, ANTIOCH_PISIDIA_ID],
        )
    )
    markup = await connection.fetchval(
        "SELECT count(*) FROM places WHERE disambiguation LIKE '%<%'"
    )

    assert notes[ANTIOCH_PISIDIA_ID] == "in Pisidia"
    assert notes[ANTIOCH_SYRIA_ID].startswith("in Syria;")
    assert markup == 0


async def test_a_real_site_name_ending_in_a_number_was_not_renamed(
    connection: asyncpg.Connection,
) -> None:
    """The one place_names row that ends in digits is a real archaeological
    site. Stripping characters everywhere would have invented a name."""
    await _require_loaded(connection)
    kept = await connection.fetch(
        "SELECT name, kind FROM place_names WHERE name ~ $1", NAME_INDEX_SQL_PATTERN
    )

    assert [(row["name"], row["kind"]) for row in kept] == [
        (MODERN_SITE_WITH_A_NUMBER, "modern")
    ]
    assert split_display_name(MODERN_SITE_WITH_A_NUMBER)[0] != MODERN_SITE_WITH_A_NUMBER


async def test_the_gazetteer_is_keyed_on_the_name_a_reader_types(
    connection: asyncpg.Connection,
) -> None:
    """ "ramah2" resolved nothing a reader or a model would ever emit. All nine
    Ramahs now answer to "Ramah", and the hit says so instead of hiding eight."""
    await _require_loaded(connection)
    rows = await connection.fetch(
        """
        SELECT n.place_id, n.weight, p.name, p.lat, p.lng, p.confidence,
               p.candidate_count, p.feature_type
        FROM place_names n JOIN places p ON p.place_id = n.place_id
        WHERE n.normalised = $1 AND p.lat IS NOT NULL
        ORDER BY n.weight DESC, n.place_id
        """,
        normalise_place_name("Ramah"),
    )
    gazetteer = PlaceGazetteer.from_rows(
        [
            GazetteerEntry(
                place_id=row["place_id"],
                name=row["name"],
                lat=row["lat"],
                lng=row["lng"],
                confidence=row["confidence"],
                candidate_count=row["candidate_count"],
                feature_type=row["feature_type"],
            )
            for row in rows
        ],
        [NameLink("ramah", row["place_id"], row["weight"]) for row in rows],
    )
    hit = gazetteer.resolve("Ramah")

    assert hit is not None
    assert hit.is_ambiguous is True
    assert len(hit.alternatives) + 1 == len(rows) > 1
    assert (
        await connection.fetchval(
            "SELECT count(*) FROM place_names WHERE normalised = 'ramah2'"
        )
        == 0
    )


async def test_the_gazetteer_row_count_moved_by_exactly_the_merged_keys(
    connection: asyncpg.Connection,
) -> None:
    """4,346 -> 4,035. Every row that went away was an index-shaped key that
    merged into the plain spelling the translation counts already supplied."""
    await _require_loaded(connection)

    assert await connection.fetchval("SELECT count(*) FROM place_names") == EXPECTED_NAMES
