"""Load OpenBible's gazetteer: places, names, mentions and derived routes.

Purpose
    Powers the Route badge and the stylised site sheet the 3D City badge became
    (dataset-validation.md section 4.3: no open 3D reconstruction exists, so the
    sheet is drawn from gazetteer facts). It also builds the name index that
    makes the standing rule enforceable -- a model emits a place NAME, and code
    resolves the coordinate.

Licensing
    CC BY 4.0. The attribution string "Place data (c) OpenBible.info, CC BY 4.0"
    is written to data_sources and every places row carries source_id, so the
    UI reads its attribution from the database (AI-05). The repository's
    geometry/*.geojson slice is ODbL and was deliberately never acquired, so no
    share-alike byte is involved.

Usage
    docker compose run --rm api python -m scripts.ingest_places
    docker compose run --rm api python -m scripts.ingest_places --dry-run

Idempotence
    One transaction: upsert the source, delete this source's places and routes,
    COPY them back, assert the result, commit. Deleting places cascades to
    place_names, place_mentions and route_stops, so a re-run cannot leave an
    orphan behind. A failed assertion rolls the whole thing back.

Verification
    Both payloads are checked against the SHA-256 recorded at acquisition, the
    parsed counts are checked against the measured expectations, and every
    check in place_assertions runs against the real tables before commit.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import asyncpg

from app.config import get_settings
from scripts.openbible_sources import (
    ANCIENT_PLACES,
    GEOCODING,
    MODERN_PLACES,
    read_bytes,
    upsert_source,
)
from scripts.place_assertions import assert_places_are_sound
from scripts.place_parser import parse_places
from scripts.place_routes import RouteRow, derive_chapter_routes
from scripts.place_rows import PlaceDataset
from scripts.place_text_order import WithinVerseOrder, alphabetical_only
from scripts.place_writer import copy_places, copy_routes

#: Route order is read out of this translation's text. BSB is the reader's
#: default (ASSUMPTIONS.md, the four public-domain translations), so the order
#: a route draws is the order the default reader sees on the page.
ORDERING_TRANSLATION = "BSB"

_VERSE_TEXTS = """
    SELECT verse_key, text FROM verses
    WHERE translation = $1 AND verse_key = ANY($2::int[])
"""


def read_dataset() -> PlaceDataset:
    """Verify both payloads and parse them before any SQL runs."""
    return parse_places(read_bytes(ANCIENT_PLACES), read_bytes(MODERN_PLACES))


def build_routes(
    dataset: PlaceDataset, order: WithinVerseOrder | None = None
) -> tuple[RouteRow, ...]:
    """Derive the routes from the parsed mentions. Order is verse order."""
    located = frozenset(place.place_id for place in dataset.places if place.is_located)
    names = {place.place_id: place.name for place in dataset.places}
    return derive_chapter_routes(dataset.mentions, located, names, order)


def _spellings(dataset: PlaceDataset) -> dict[str, list[str]]:
    """Every published spelling of every place, keyed by place id."""
    spellings: dict[str, list[str]] = {}
    for row in dataset.names:
        spellings.setdefault(row.place_id, []).append(row.name)
    return spellings


async def verse_order(
    connection: asyncpg.Connection, dataset: PlaceDataset
) -> WithinVerseOrder:
    """Load the text of every mentioned verse, so routes can be ordered by it.

    Failing here is deliberate. Without the text, two places named in the same
    verse fall back to alphabetical order and Acts 16:11 renders as
    "Neapolis, Samothrace, Troas" -- the voyage in reverse. A silently worse
    route is harder to notice than a loud stop.
    """
    keys = sorted({mention.verse_key for mention in dataset.mentions})
    rows = await connection.fetch(_VERSE_TEXTS, ORDERING_TRANSLATION, keys)
    if not rows:
        raise RuntimeError(
            f"No {ORDERING_TRANSLATION} verses are loaded, so route order could "
            "only be alphabetical. Run: python -m scripts.load_scripture "
            f"{ORDERING_TRANSLATION}"
        )
    texts = {int(row["verse_key"]): str(row["text"]) for row in rows}
    print(
        f"[places] ordering routes from {len(texts)} of {len(keys)} "
        f"{ORDERING_TRANSLATION} verses",
        flush=True,
    )
    return WithinVerseOrder(texts, _spellings(dataset))


async def _write(
    connection: asyncpg.Connection, dataset: PlaceDataset, routes: tuple[RouteRow, ...]
) -> None:
    """Replace this source's gazetteer and prove the result, atomically."""
    async with connection.transaction():
        source_id = await upsert_source(connection, GEOCODING)
        await connection.execute("DELETE FROM routes WHERE source_id = $1", source_id)
        await connection.execute("DELETE FROM places WHERE source_id = $1", source_id)
        await copy_places(connection, dataset, source_id)
        await copy_routes(connection, routes, source_id)
        await assert_places_are_sound(connection, source_id)


async def load() -> PlaceDataset:
    """Load the gazetteer end to end. Returns the parsed dataset."""
    print("[places] verifying and parsing the acquired gazetteer", flush=True)
    dataset = read_dataset()
    connection = await asyncpg.connect(dsn=get_settings().dsn)
    try:
        order = await verse_order(connection, dataset)
        routes = build_routes(dataset, order)
        await _write(connection, dataset, routes)
    finally:
        await connection.close()
    _report(dataset, routes)
    return dataset


def _report(dataset: PlaceDataset, routes: tuple[RouteRow, ...]) -> None:
    """Print what was actually written, measured from the rows themselves."""
    stops = sum(route.stop_count for route in routes)
    print(
        f"[places] {len(dataset.places)} places, {len(dataset.names)} names, "
        f"{len(dataset.mentions)} mentions, {len(routes)} routes, {stops} stops",
        flush=True,
    )


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load OpenBible.info Bible Geocoding Data (CC BY 4.0)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="verify and parse the gazetteer without touching the database",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.dry_run:
        dataset = read_dataset()
        _report(dataset, build_routes(dataset, alphabetical_only()))
        print(
            "[places] database untouched; route order is ALPHABETICAL here, "
            "not textual, because no verses were read",
            flush=True,
        )
        return 0
    asyncio.run(load())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
