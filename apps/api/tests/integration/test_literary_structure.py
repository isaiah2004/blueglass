"""What is actually in Postgres after the literary-structure ingest.

Measurements against committed rows, not restatements of the loader. The
licence checks here are the ones that matter most: if a NAB, NRSV or NJB
quotation reached the database, this is where it shows up.

Skipped unless ATLAS_TEST_DATABASE_URL is set, and skipped when nobody has run
the ingest, so the suite stays runnable against an empty database.
"""

from __future__ import annotations

import asyncpg
import pytest

from scripts.murai_records import SCHEME
from scripts.structure_assertions import (
    EXPECTED_ACTS_NODES,
    EXPECTED_ACTS_STRUCTURES,
    EXPECTED_NODES,
    EXPECTED_NODES_OUTSIDE_THEIR_PASSAGE,
    EXPECTED_PASSAGES,
    EXPECTED_STRUCTURES,
)

pytestmark = pytest.mark.integration

ACTS = 44
ASCENSION_PASSAGE = "murai:044001001-044001011"


async def _skip_unless_loaded(connection: asyncpg.Connection) -> None:
    """Skip rather than fail when nobody has run the ingest."""
    loaded = await connection.fetchval("SELECT EXISTS (SELECT 1 FROM literary_structures)")
    if not loaded:
        pytest.skip("literary structure is not loaded; run scripts.ingest_structure")


async def test_the_whole_corpus_is_present(connection: asyncpg.Connection) -> None:
    await _skip_unless_loaded(connection)

    counts = await connection.fetchrow(
        """
        SELECT (SELECT count(*) FROM passages WHERE scheme = $1) AS passages,
               (SELECT count(*) FROM literary_structures)        AS structures,
               (SELECT count(*) FROM structure_nodes)            AS nodes
        """,
        SCHEME,
    )

    assert counts["passages"] == EXPECTED_PASSAGES
    assert counts["structures"] == EXPECTED_STRUCTURES
    assert counts["nodes"] == EXPECTED_NODES


async def test_no_stored_text_quotes_a_translation_we_cannot_redistribute(
    connection: asyncpg.Connection,
) -> None:
    """The carve-out in the source's own words, proven in SQL.

    Murai's site says the copyright of the cited Bible verses belongs to each
    translator and publisher. Every cell carrying a verse reference or a
    quotation mark is one of those citations.
    """
    await _skip_unless_loaded(connection)

    leaked = await connection.fetchval(
        """
        SELECT count(*) FROM (
            SELECT summary AS text FROM structure_nodes
            UNION ALL
            SELECT legend FROM literary_structures
        ) AS stored
        WHERE text ~ '[0-9]+[[:space:]]*:[[:space:]]*[0-9]+' OR text LIKE '%"%'
        """
    )

    assert leaked == 0


async def test_every_structure_is_attributed_and_never_stated_as_fact(
    connection: asyncpg.Connection,
) -> None:
    """Q-015 as data. The UI cannot forget what the row will not let it omit."""
    await _skip_unless_loaded(connection)

    unattributed = await connection.fetchval(
        """
        SELECT count(*) FROM literary_structures s
        LEFT JOIN data_sources d ON d.id = s.source_id
        WHERE d.id IS NULL
           OR btrim(d.attribution) = ''
           OR btrim(s.attributed_to) = ''
           OR btrim(s.claim_label) = ''
           OR s.claim_type <> 'interpretive'
        """
    )

    assert unattributed == 0


async def test_acts_is_covered_end_to_end(connection: asyncpg.Connection) -> None:
    """Acts is the MVP scope, so its coverage is asserted rather than assumed."""
    await _skip_unless_loaded(connection)

    counts = await connection.fetchrow(
        """
        SELECT count(DISTINCT s.id) AS structures, count(n.id) AS nodes
        FROM literary_structures s
        JOIN passages p ON p.passage_id = s.passage_id
        JOIN structure_nodes n ON n.structure_id = s.id
        WHERE p.book_number = $1
        """,
        ACTS,
    )

    assert counts["structures"] == EXPECTED_ACTS_STRUCTURES
    assert counts["nodes"] == EXPECTED_ACTS_NODES


async def test_the_ascension_chiasm_reads_as_the_source_prints_it(
    connection: asyncpg.Connection,
) -> None:
    """One end-to-end spot check against the row quoted in the provenance note."""
    await _skip_unless_loaded(connection)

    structure = await connection.fetchrow(
        """
        SELECT s.pattern, s.centre_label, s.claim_label, s.legend
        FROM literary_structures s WHERE s.passage_id = $1
        """,
        ASCENSION_PASSAGE,
    )
    labels = await connection.fetch(
        """
        SELECT n.label, n.is_centre FROM structure_nodes n
        JOIN literary_structures s ON s.id = n.structure_id
        WHERE s.passage_id = $1 ORDER BY n.node_index
        """,
        ASCENSION_PASSAGE,
    )

    assert structure is not None
    assert structure["pattern"] == "chiasm"
    assert structure["centre_label"] == "D"
    assert structure["claim_label"] == "Murai's reading"
    assert [row["label"] for row in labels] == ["A", "B", "C", "D", "C'", "B'", "A'"]
    assert [row["label"] for row in labels if row["is_centre"]] == ["D"]


async def test_the_verse_a_reader_taps_finds_its_limb_in_one_lookup(
    connection: asyncpg.Connection,
) -> None:
    """The query the inline badge makes, against the range index."""
    await _skip_unless_loaded(connection)

    limb = await connection.fetchrow(
        """
        SELECT n.label, n.pair_label FROM structure_nodes n
        JOIN literary_structures s ON s.id = n.structure_id
        WHERE s.passage_id = $1
          AND int4range(n.start_key, n.end_key, '[]') @> $2::int
        """,
        ASCENSION_PASSAGE,
        44_001_009,
    )

    assert limb is not None
    assert (limb["label"], limb["pair_label"]) == ("B'", "B")


async def test_nodes_stay_inside_their_passage_except_where_the_source_does_not(
    connection: asyncpg.Connection,
) -> None:
    """Fifteen Old Testament units disagree with their own header, upstream.

    Pinned rather than repaired: inventing a boundary Murai did not write would
    be worse than recording that two of his cells disagree. A sixteenth would
    mean the span parser mis-resolved a book, so the number is exact -- and it
    must stay zero across the New Testament, where the MVP lives.
    """
    await _skip_unless_loaded(connection)

    escaped = await connection.fetchrow(
        """
        SELECT count(*)                                        AS total,
               count(*) FILTER (WHERE p.book_number >= 40)     AS new_testament
        FROM structure_nodes n
        JOIN literary_structures s ON s.id = n.structure_id
        JOIN passages p ON p.passage_id = s.passage_id
        WHERE n.start_key < p.start_key OR n.end_key > p.end_key
        """
    )

    assert escaped["total"] == EXPECTED_NODES_OUTSIDE_THEIR_PASSAGE
    assert escaped["new_testament"] == 0
