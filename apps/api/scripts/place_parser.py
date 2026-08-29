"""Turn OpenBible's two geocoding files into rows. The two-file join lives here.

Purpose
    The trap this module exists to absorb, recorded in
    docs/architecture/dataset-validation.md section 6.1: ancient.jsonl contains
    NO COORDINATES AT ALL. They live in modern.jsonl and require a two-file
    join, ancient.modern_associations[].modern_id -> modern.id ->
    modern.lonlat, where lonlat is a string and is LONGITUDE-first. The
    compensating gift is that verses[].sort is already the project's BBBCCCVVV
    verse key, so no book-map lookup is needed.

Key responsibilities
    - Parse both files into typed rows with no database involved.
    - Rank the candidate sites for a place instead of collapsing them.
    - Emit the gazetteer name links and the place-verse mentions.
    - Keep OpenBible's homonym ordinal out of the reader-facing name and in a
      column of its own (see place_disambiguation).

Dependencies
    place_rows for the shapes, place_gazetteer for the one normalisation rule,
    place_disambiguation for the name/ordinal split, osis_refs for the
    verse-key cross-check. No I/O beyond the bytes passed in.

Usage
    dataset = parse_places(read_bytes(ANCIENT_PLACES), read_bytes(MODERN_PLACES))
"""

from __future__ import annotations

import json
from collections.abc import Iterator, Mapping, Sequence
from typing import Any

from scripts.osis_refs import parse_osis_verse
from scripts.place_disambiguation import (
    homonym_counts,
    plain_text_note,
    split_display_name,
)
from scripts.place_gazetteer import normalise_place_name
from scripts.place_rows import (
    CERTAIN_SCORE,
    NAMED_MENTION_KIND,
    PRIMARY_NAME_WEIGHT,
    UNKNOWN_FEATURE_TYPE,
    UNKNOWN_MENTION_KIND,
    Candidate,
    ModernSite,
    PlaceDataError,
    PlaceDataset,
    PlaceMentionRow,
    PlaceNameRow,
    PlaceRow,
)


def iter_records(payload: bytes) -> Iterator[dict[str, Any]]:
    """Yield one parsed object per JSONL line."""
    for line in payload.decode("utf-8").splitlines():
        if line.strip():
            yield json.loads(line)


def clamp_confidence(score: int) -> float:
    """Fold a raw candidate score into the 0..1 the places column accepts."""
    return min(1.0, max(0.0, score / CERTAIN_SCORE))


def parse_lonlat(raw: object, modern_id: str) -> tuple[float, float]:
    """Split "24.284576,41.012072" into (lat, lng).

    Longitude comes FIRST in this file. Reading it the other way puts Philippi
    in the Indian Ocean and every row count downstream still passes, which is
    why the order is asserted here rather than assumed at the call site.
    """
    if not isinstance(raw, str) or raw.count(",") != 1:
        raise PlaceDataError(f"{modern_id} has an unusable lonlat: {raw!r}")
    longitude, latitude = (float(part) for part in raw.split(","))
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise PlaceDataError(
            f"{modern_id} lonlat {raw!r} is outside the world; the columns may "
            "have been swapped upstream."
        )
    return latitude, longitude


def parse_modern_sites(payload: bytes) -> dict[str, ModernSite]:
    """Index modern.jsonl by id. This is the half that holds the coordinates."""
    sites: dict[str, ModernSite] = {}
    for record in iter_records(payload):
        modern_id = str(record["id"])
        latitude, longitude = parse_lonlat(record.get("lonlat"), modern_id)
        precision = record.get("precision")
        precision = precision if isinstance(precision, dict) else {}
        meters = precision.get("meters")
        kind = precision.get("type")
        sites[modern_id] = ModernSite(
            modern_id=modern_id,
            name=str(record.get("friendly_id") or modern_id),
            lat=latitude,
            lng=longitude,
            precision_meters=int(meters) if isinstance(meters, int) else None,
            precision_type=str(kind) if kind else None,
        )
    return sites


def candidates_for(
    record: dict[str, Any], sites: dict[str, ModernSite]
) -> tuple[Candidate, ...]:
    """Every located identification of one ancient place, best first.

    Ties break on the modern id so two runs over the same bytes produce the
    same default pin -- a route that reordered itself between loads would look
    like a data change to everyone downstream.
    """
    associations = record.get("modern_associations")
    if not isinstance(associations, dict):
        return ()
    found: list[Candidate] = []
    for modern_id, association in associations.items():
        site = sites.get(modern_id)
        if site is None:
            continue
        found.append(
            Candidate(
                modern_id=modern_id,
                name=site.name,
                lat=site.lat,
                lng=site.lng,
                score=int(association.get("score") or 0),
            )
        )
    found.sort(key=lambda candidate: (-candidate.score, candidate.modern_id))
    return tuple(found)


def mention_kind(verse: dict[str, Any]) -> str:
    """The dominant way this verse refers to the place.

    OpenBible counts several kinds per verse -- name, people_group,
    common_noun. The most-counted one wins, ties by name, so a badge can tell
    "Philippi, the city" from "the Philippians, the people".
    """
    kinds = verse.get("instance_types")
    if not isinstance(kinds, dict) or not kinds:
        return UNKNOWN_MENTION_KIND
    return min(kinds.items(), key=lambda item: (-int(item[1]), item[0]))[0]


def mentions_for(record: dict[str, Any]) -> list[PlaceMentionRow]:
    """One row per verse this place is named in, with the key cross-checked.

    sort is already BBBCCCVVV, but it is checked against the OSIS id in the
    same row rather than trusted: the two agreeing on all 8,742 links is what
    makes the free verse key safe to use.
    """
    place_id = str(record["id"])
    rows: list[PlaceMentionRow] = []
    for verse in record.get("verses") or ():
        osis = str(verse["osis"])
        key = int(str(verse["sort"]))
        if parse_osis_verse(osis) != key:
            raise PlaceDataError(
                f"{place_id}: verse sort {key} disagrees with OSIS id {osis!r}."
            )
        rows.append(PlaceMentionRow(place_id, key, osis, mention_kind(verse)))
    return rows


def count_named(mentions: Sequence[PlaceMentionRow]) -> int:
    """How many verses SPELL this place, which is the only count a badge prints.

    OpenBible classifies every mention, and only `name` means the English text
    writes the place's name: the file also carries people_group (458 rows),
    no_translation (390), common_noun (321), helper (138), partial (101) and
    person (1). Counting the lot made the column a count of references rather
    than of namings, under a teaser reading "X - named in N verses of
    scripture". Jerusalem measured 955 against the 766 that spell it, and
    2 Samuel 11:22 -- which names no place at all -- was one of the difference.
    The same number scores the badge, so it also decided which badge showed.

    @param mentions: This place's mention rows.
    @returns How many of them the translation spells. Side effects: none.
    """
    return sum(1 for mention in mentions if mention.mention_kind == NAMED_MENTION_KIND)


def attestation(counts: object, display_name: str) -> int:
    """How many times translations spell this place by its display name.

    Homonyms all publish the same primary name, so PRIMARY_NAME_WEIGHT alone
    leaves nine Ramahs tied and the gazetteer falls back to place id order --
    an arbitrary pick dressed up as a ranking. Adding the attestation count
    breaks the tie on evidence instead, and stays far below the million that
    separates a primary from a variant.
    """
    if not isinstance(counts, dict):
        return 0
    wanted = normalise_place_name(display_name)
    return max(
        (int(c) for n, c in counts.items() if normalise_place_name(str(n)) == wanted),
        default=0,
    )


def name_links(
    record: dict[str, Any], best: Candidate | None, display_name: str
) -> list[PlaceNameRow]:
    """Every spelling that should resolve to this place, de-duplicated.

    A spelling arrives as the published name, as a translation's variant, or as
    the modern site's name. Only the highest-weighted arrival is kept per
    place, so resolve() can never return the same place twice.

    The primary row is keyed on the DISPLAY name, not on friendly_id. Indexing
    "Ramah 2" produced the key "ramah2", which no reader and no model will ever
    emit, so the primary row of 315 places pointed at a spelling that appears
    nowhere in scripture.
    """
    place_id = str(record["id"])
    counts = record.get("translation_name_counts")
    primary_weight = PRIMARY_NAME_WEIGHT + attestation(counts, display_name)
    proposals = [(display_name, "primary", primary_weight)]
    if isinstance(counts, dict):
        proposals += [(str(n), "translation", int(c)) for n, c in counts.items()]
    if best is not None:
        proposals.append((best.name, "modern", 0))
    kept: dict[str, PlaceNameRow] = {}
    for name, kind, weight in proposals:
        normalised = normalise_place_name(name)
        seen = kept.get(normalised)
        if normalised and (seen is None or weight > seen.weight):
            kept[normalised] = PlaceNameRow(normalised, name, place_id, kind, weight)
    return list(kept.values())


def place_row(
    record: dict[str, Any],
    candidates: tuple[Candidate, ...],
    sites: dict[str, ModernSite],
    named_verse_count: int,
    homonyms: Mapping[str, int],
) -> PlaceRow:
    """Assemble one places row from an ancient record and its candidates.

    ``homonyms`` maps a display name to how many places carry it, counted over
    the whole file. It cannot be derived from one record, which is why it is
    passed in rather than computed here.
    """
    best = candidates[0] if candidates else None
    site = None if best is None else sites[best.modern_id]
    types = tuple(str(kind) for kind in (record.get("types") or ()))
    display_name, index = split_display_name(str(record["friendly_id"]))
    return PlaceRow(
        place_id=str(record["id"]),
        name=display_name,
        slug=str(record.get("url_slug") or record["id"]),
        modern_name=None if site is None else site.name,
        lng=None if site is None else site.lng,
        lat=None if site is None else site.lat,
        feature_type=types[0] if types else UNKNOWN_FEATURE_TYPE,
        feature_types=types,
        confidence=None if best is None else clamp_confidence(best.score),
        precision_meters=None if site is None else site.precision_meters,
        precision_type=None if site is None else site.precision_type,
        candidates=candidates,
        named_verse_count=named_verse_count,
        disambiguation_index=index,
        homonym_count=homonyms.get(display_name, 1),
        disambiguation=plain_text_note(record.get("comment")),
    )


def parse_places(ancient_payload: bytes, modern_payload: bytes) -> PlaceDataset:
    """Parse both files and join them. The one entry point of this module.

    The ancient records are materialised rather than streamed because
    homonym_count is a property of the whole file, not of one record: whether
    "Ramah" needs disambiguating cannot be known until every place has been
    read. 1,342 records is a few megabytes, so the cost is nothing.
    """
    sites = parse_modern_sites(modern_payload)
    records = list(iter_records(ancient_payload))
    homonyms = homonym_counts(
        split_display_name(str(record["friendly_id"]))[0] for record in records
    )
    places: list[PlaceRow] = []
    names: list[PlaceNameRow] = []
    mentions: list[PlaceMentionRow] = []
    for record in records:
        candidates = candidates_for(record, sites)
        place_mentions = mentions_for(record)
        row = place_row(record, candidates, sites, count_named(place_mentions), homonyms)
        places.append(row)
        names.extend(name_links(record, candidates[0] if candidates else None, row.name))
        mentions.extend(place_mentions)
    return PlaceDataset(tuple(places), tuple(names), tuple(mentions))
