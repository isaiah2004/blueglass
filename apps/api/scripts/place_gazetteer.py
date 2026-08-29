"""Resolve a place NAME to a coordinate. The reason a model never emits one.

Purpose
    CLAUDE.md states the rule outright: "Never let a model emit coordinates.
    Measured mean error was 41 km even for the best extractor". Models emit
    place names; this resolves them. It is a pure lookup over the OpenBible
    gazetteer with no network, no model and no guessing -- a name it does not
    know returns None, which becomes a review item rather than a pin in the
    wrong hemisphere.

    The same normalisation builds the ``place_names`` table, so a resolution
    done here in Python and one done in SQL by the API cannot disagree.

Key responsibilities
    - Normalise a spelling the way the index is keyed.
    - Return the best-attested located place for a name, or nothing.
    - Report ambiguity instead of hiding it: two places really are called
      Antioch, and 777 of 1,342 places have more than one candidate site.

Dependencies
    Standard library only. No I/O, no database.

Usage
    gazetteer = PlaceGazetteer.from_rows(places, names)
    hit = gazetteer.resolve("Neapolis")
"""

from __future__ import annotations

import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

#: Names in this dataset are filed without their article ("Great Sea", not
#: "the Great Sea"), and OpenBible carries the article in its own column. A
#: model or a reader will type it anyway.
_LEADING_ARTICLES = ("the ", "a ", "an ")

#: Matches place_names.normalised in migration 0005.
MAX_NORMALISED_LENGTH = 64


def normalise_place_name(name: str) -> str:
    """Fold a spelling to its index key.

    Accents are stripped because the same place is published as "Beth-shan"
    here and "Bethshān" elsewhere, and punctuation is dropped because hyphen
    placement in transliterated Semitic names is a house style, not a fact.
    """
    stripped = name.strip().lower()
    for article in _LEADING_ARTICLES:
        if stripped.startswith(article):
            stripped = stripped[len(article) :]
            break
    decomposed = unicodedata.normalize("NFKD", stripped)
    folded = "".join(
        character
        for character in decomposed
        if character.isalnum() and not unicodedata.combining(character)
    )
    return folded[:MAX_NORMALISED_LENGTH]


@dataclass(frozen=True, slots=True)
class GazetteerEntry:
    """One located place, as the gazetteer holds it."""

    place_id: str
    name: str
    lat: float
    lng: float
    confidence: float
    candidate_count: int
    feature_type: str


@dataclass(frozen=True, slots=True)
class GazetteerHit:
    """A resolved name: the coordinate, and how sure the dataset is.

    ``alternatives`` is the other places that answer to the same spelling. It
    is never dropped: silently picking one Antioch and hiding the other is
    exactly the collapse DECISIONS #10 forbids.
    """

    entry: GazetteerEntry
    matched: str
    alternatives: tuple[GazetteerEntry, ...]

    @property
    def is_ambiguous(self) -> bool:
        """True when more than one place answers to this spelling."""
        return bool(self.alternatives)


@dataclass(frozen=True, slots=True)
class NameLink:
    """One spelling pointing at one place, with the weight that ranks it."""

    normalised: str
    place_id: str
    weight: int


class PlaceGazetteer:
    """An immutable name index over located places."""

    __slots__ = ("_by_id", "_by_name")

    def __init__(self, entries: Iterable[GazetteerEntry], links: Iterable[NameLink]) -> None:
        self._by_id = {entry.place_id: entry for entry in entries}
        self._by_name: dict[str, list[NameLink]] = {}
        for link in links:
            if link.place_id in self._by_id:
                self._by_name.setdefault(link.normalised, []).append(link)
        for bucket in self._by_name.values():
            bucket.sort(key=lambda link: (-link.weight, link.place_id))

    @property
    def place_count(self) -> int:
        """How many located places the index holds."""
        return len(self._by_id)

    @property
    def name_count(self) -> int:
        """How many distinct normalised spellings resolve to something."""
        return len(self._by_name)

    def entry(self, place_id: str) -> GazetteerEntry | None:
        """Look a place up by its OpenBible id."""
        return self._by_id.get(place_id)

    def resolve(self, name: str) -> GazetteerHit | None:
        """Resolve a spelling, or return None.

        None is a real answer and the caller must treat it as one. There is no
        fuzzy fallback here on purpose: a near-miss on a transliterated name is
        how "Ramah" becomes "Ramoth", 60 km away, and the badge would render
        the mistake as confidently as the truth.
        """
        bucket = self._by_name.get(normalise_place_name(name))
        if not bucket:
            return None
        ranked = [self._by_id[link.place_id] for link in bucket]
        return GazetteerHit(
            entry=ranked[0], matched=name.strip(), alternatives=tuple(ranked[1:])
        )

    def coordinates(self, name: str) -> tuple[float, float] | None:
        """The ``(lat, lng)`` for a name, or None. The whole point of the file."""
        hit = self.resolve(name)
        return None if hit is None else (hit.entry.lat, hit.entry.lng)

    @classmethod
    def from_rows(
        cls, entries: Sequence[GazetteerEntry], links: Sequence[NameLink]
    ) -> PlaceGazetteer:
        """Build from the rows an ingest produced or a query returned."""
        return cls(entries, links)
