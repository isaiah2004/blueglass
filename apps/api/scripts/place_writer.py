"""The COPY statements that put the parsed gazetteer into Postgres.

Purpose
    Separating the writing from the orchestration keeps the column lists beside
    the tuples that fill them, which is where a mismatch is visible. It also
    keeps ingest_places.py short enough to read in one screen.

Key responsibilities
    Serialise each row type into the tuple asyncpg's binary COPY expects, in
    the column order the table declares, and nothing else.

Dependencies
    asyncpg and the row shapes. No verification logic -- that is
    place_assertions, which runs after these have written.

Usage
    await copy_places(connection, dataset, source_id)
    await copy_routes(connection, routes, source_id)
"""

from __future__ import annotations

import json

import asyncpg

from scripts.place_routes import RouteRow
from scripts.place_rows import PlaceDataset

PLACE_COLUMNS = (
    "place_id",
    "name",
    "slug",
    "modern_name",
    "lng",
    "lat",
    "feature_type",
    "feature_types",
    "confidence",
    "precision_meters",
    "precision_type",
    "candidates",
    "verse_count",
    "source_id",
)
NAME_COLUMNS = ("normalised", "name", "place_id", "kind", "weight")
MENTION_COLUMNS = ("place_id", "verse_key", "osis_id", "mention_kind")
ROUTE_COLUMNS = (
    "route_id",
    "scheme",
    "book_number",
    "chapter",
    "start_key",
    "end_key",
    "stop_count",
    "source_id",
)
STOP_COLUMNS = ("route_id", "position", "place_id", "verse_key")


def place_records(dataset: PlaceDataset, source_id: int) -> list[tuple[object, ...]]:
    """places rows. candidates is serialised here because asyncpg's jsonb
    codec takes text, and the column is GENERATED from it downstream."""
    return [
        (
            place.place_id,
            place.name,
            place.slug,
            place.modern_name,
            place.lng,
            place.lat,
            place.feature_type,
            list(place.feature_types),
            place.confidence,
            place.precision_meters,
            place.precision_type,
            json.dumps([candidate.as_json() for candidate in place.candidates]),
            place.verse_count,
            source_id,
        )
        for place in dataset.places
    ]


async def copy_places(
    connection: asyncpg.Connection, dataset: PlaceDataset, source_id: int
) -> None:
    """Write the three place tables in dependency order."""
    await connection.copy_records_to_table(
        "places",
        records=place_records(dataset, source_id),
        columns=list(PLACE_COLUMNS),
    )
    await connection.copy_records_to_table(
        "place_names",
        records=[
            (row.normalised, row.name, row.place_id, row.kind, row.weight)
            for row in dataset.names
        ],
        columns=list(NAME_COLUMNS),
    )
    await connection.copy_records_to_table(
        "place_mentions",
        records=[
            (row.place_id, row.verse_key, row.osis_id, row.mention_kind)
            for row in dataset.mentions
        ],
        columns=list(MENTION_COLUMNS),
    )


async def copy_routes(
    connection: asyncpg.Connection, routes: tuple[RouteRow, ...], source_id: int
) -> None:
    """Write the derived routes and their ordered stops."""
    await connection.copy_records_to_table(
        "routes",
        records=[
            (
                route.route_id,
                route.scheme,
                route.book_number,
                route.chapter,
                route.start_key,
                route.end_key,
                route.stop_count,
                source_id,
            )
            for route in routes
        ],
        columns=list(ROUTE_COLUMNS),
    )
    await connection.copy_records_to_table(
        "route_stops",
        records=[
            (route.route_id, stop.position, stop.place_id, stop.verse_key)
            for route in routes
            for stop in route.stops
        ],
        columns=list(STOP_COLUMNS),
    )
