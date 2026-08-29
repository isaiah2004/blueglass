"""What must be true of the loaded gazetteer, checked against Postgres.

Purpose
    Counting the parsed rows proves the two files were whole. It does not prove
    the join worked: a coordinate read longitude-first, a mention keyed off the
    wrong verse, or a route ordered alphabetically would all pass a count and
    put a pin in the sea. These run against the real tables INSIDE the loading
    transaction, so a failure rolls the load back instead of publishing it.

Key responsibilities
    Count every table, prove the coordinates land in the world the Bible
    happens in, prove one known place and one known route are exactly right,
    and prove the provenance row a badge must cite exists.

Dependencies
    asyncpg only. No application code.

Usage
    await assert_places_are_sound(connection, source_id)
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

#: Every figure below was measured from the acquired bytes on 2026-08-29 and
#: matches data/raw/openbible-geocoding/PROVENANCE.md, which recorded them
#: beside the SHA-256 of the files they came from.
EXPECTED_PLACES = 1_342
EXPECTED_LOCATED = 1_335
EXPECTED_DISPUTED = 777
EXPECTED_NAMES = 4_346
EXPECTED_MENTIONS = 8_742
EXPECTED_MENTIONED_VERSES = 5_616

#: Derived, not sourced: one route per chapter that names two or more located
#: places, ordered by verse and then by position in the BSB text.
EXPECTED_ROUTES = 682
EXPECTED_ROUTE_STOPS = 7_070

#: The lands of the Bible, generously bounded. Measured extent of the acquired
#: data is lat 11.60..44.94, lng -6.94..67.43. A longitude/latitude swap on
#: even one row lands outside this box, which no row count would ever notice.
MIN_LAT, MAX_LAT = 5.0, 55.0
MIN_LNG, MAX_LNG = -15.0, 75.0

_PLACES = "SELECT count(*) FROM places"
_LOCATED = "SELECT count(*) FROM places WHERE lat IS NOT NULL"
_DISPUTED = "SELECT count(*) FROM places WHERE candidate_count > 1"
_NAMES = "SELECT count(*) FROM place_names"
_MENTIONS = "SELECT count(*) FROM place_mentions"
_MENTIONED_VERSES = "SELECT count(DISTINCT verse_key) FROM place_mentions"
_ROUTES = "SELECT count(*) FROM routes"
_ROUTE_STOPS = "SELECT count(*) FROM route_stops"
_OUTSIDE_THE_WORLD = """
    SELECT count(*) FROM places
    WHERE lat IS NOT NULL
      AND (lat NOT BETWEEN $1 AND $2 OR lng NOT BETWEEN $3 AND $4)
"""
_UNLOCATED_STOPS = """
    SELECT count(*) FROM route_stops s
    JOIN places p ON p.place_id = s.place_id
    WHERE p.lat IS NULL
"""
_MENTIONS_OUTSIDE_CANON = """
    SELECT count(*) FROM place_mentions
    WHERE verse_key / 1000000 NOT BETWEEN 1 AND 66
"""
_STOP_COUNT_DISAGREES = """
    SELECT count(*) FROM routes r
    WHERE r.stop_count <> (SELECT count(*) FROM route_stops s
                           WHERE s.route_id = r.route_id)
"""
_ORPHAN_NAMES = """
    SELECT count(*) FROM place_names n
    LEFT JOIN places p ON p.place_id = n.place_id
    WHERE p.place_id IS NULL
"""

_CHECKS_SQL: tuple[tuple[str, str, int], ...] = (
    ("places", _PLACES, EXPECTED_PLACES),
    ("places with a coordinate", _LOCATED, EXPECTED_LOCATED),
    ("places with rival candidate sites", _DISPUTED, EXPECTED_DISPUTED),
    ("gazetteer name rows", _NAMES, EXPECTED_NAMES),
    ("place-verse mentions", _MENTIONS, EXPECTED_MENTIONS),
    ("verses naming a place", _MENTIONED_VERSES, EXPECTED_MENTIONED_VERSES),
    ("derived routes", _ROUTES, EXPECTED_ROUTES),
    ("derived route stops", _ROUTE_STOPS, EXPECTED_ROUTE_STOPS),
    ("route stops with no coordinate", _UNLOCATED_STOPS, 0),
    ("mentions outside books 1-66", _MENTIONS_OUTSIDE_CANON, 0),
    ("routes whose stop_count is a lie", _STOP_COUNT_DISAGREES, 0),
    ("gazetteer names with no place", _ORPHAN_NAMES, 0),
)

#: Philippi, transcribed from the retrieved bytes in PROVENANCE.md:
#: modern id mec5201, lonlat "24.284576,41.012072", precision 5 m.
_PHILIPPI_ID = "a49e1d0"
_PHILIPPI_LAT, _PHILIPPI_LNG = 41.012072, 24.284576
_COORDINATE_TOLERANCE = 1e-5

_PHILIPPI = "SELECT lat, lng, name FROM places WHERE place_id = $1"
_ATTRIBUTED = """
    SELECT count(*) FROM data_sources
    WHERE id = $1 AND btrim(attribution) <> '' AND btrim(license) <> ''
      AND retrieved_at IS NOT NULL AND share_alike = false
"""

#: The journey of Acts 16:11-12, which is the example the milestone brief names
#: and the reason route order is read out of the verse text rather than sorted.
_ACTS_16_ROUTE = "chapter:Acts.16"
_ACTS_16_LEG = ("Troas", "Samothrace", "Neapolis", "Philippi")
_ROUTE_NAMES = """
    SELECT p.name FROM route_stops s
    JOIN places p ON p.place_id = s.place_id
    WHERE s.route_id = $1
    ORDER BY s.position
"""


class PlaceIntegrityError(RuntimeError):
    """The loaded gazetteer failed one or more post-load checks."""


@dataclass(frozen=True, slots=True)
class Check:
    """One assertion: the sentence a human reads when it fails."""

    label: str
    sql: str
    expected: int


_CHECKS = tuple(Check(*row) for row in _CHECKS_SQL)


def _contains_run(names: list[str], run: tuple[str, ...]) -> bool:
    """True when `run` appears as consecutive entries of `names`."""
    width = len(run)
    return any(
        tuple(names[start : start + width]) == run for start in range(len(names) - width + 1)
    )


async def _spot_check_failures(connection: asyncpg.Connection, source_id: int) -> list[str]:
    """The four checks a row count can never make."""
    problems: list[str] = []
    stranded = await connection.fetchval(
        _OUTSIDE_THE_WORLD, MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG
    )
    if stranded:
        problems.append(
            f"{stranded} places sit outside lat {MIN_LAT}..{MAX_LAT} / lng "
            f"{MIN_LNG}..{MAX_LNG}; the lonlat columns may have been swapped"
        )
    philippi = await connection.fetchrow(_PHILIPPI, _PHILIPPI_ID)
    if philippi is None:
        problems.append(f"Philippi ({_PHILIPPI_ID}) is missing entirely")
    elif (
        abs(philippi["lat"] - _PHILIPPI_LAT) > _COORDINATE_TOLERANCE
        or abs(philippi["lng"] - _PHILIPPI_LNG) > _COORDINATE_TOLERANCE
    ):
        problems.append(
            f"Philippi is at {philippi['lat']}, {philippi['lng']}; the source "
            f"says {_PHILIPPI_LAT}, {_PHILIPPI_LNG}. Check the lonlat order."
        )
    stops = [row["name"] for row in await connection.fetch(_ROUTE_NAMES, _ACTS_16_ROUTE)]
    if not _contains_run(stops, _ACTS_16_LEG):
        problems.append(
            f"{_ACTS_16_ROUTE} does not read {' -> '.join(_ACTS_16_LEG)}; it "
            f"reads {stops}. Route order must come from the verse text."
        )
    if await connection.fetchval(_ATTRIBUTED, source_id) != 1:
        problems.append(
            "the provenance row is missing a licence, an attribution or a "
            "retrieval date, so no badge built on it may render (AI-05)"
        )
    return problems


async def _failures(connection: asyncpg.Connection, source_id: int) -> list[str]:
    """Run every check and collect the ones that did not hold."""
    problems = [
        f"{check.label}: expected {check.expected}, got {actual}"
        for check in _CHECKS
        if (actual := await connection.fetchval(check.sql)) != check.expected
    ]
    orphans = await connection.fetchval(
        "SELECT count(*) FROM places WHERE source_id <> $1", source_id
    )
    if orphans:
        problems.append(f"places not attributed to source {source_id}: {orphans}")
    return problems + await _spot_check_failures(connection, source_id)


async def assert_places_are_sound(connection: asyncpg.Connection, source_id: int) -> None:
    """Raise PlaceIntegrityError listing everything wrong, or return silently."""
    problems = await _failures(connection, source_id)
    if problems:
        joined = "\n  - ".join(problems)
        raise PlaceIntegrityError(f"places failed post-load checks:\n  - {joined}")
