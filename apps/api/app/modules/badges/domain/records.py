"""The rows the badge repository returns, as domain types.

Purpose
    The builders in `builders/` turn data into badges. They must be pure and
    testable without Postgres, which means they cannot take `asyncpg.Record`.
    These frozen dataclasses are the shape the port promises instead -- one per
    table the five M2 badges read, named for the badge that needs it.

Naming
    Every record carries `source_key`, the `data_sources.key` string, never a
    numeric id. AI-05 is enforced by resolving that key against the attribution
    map and dropping the badge when it does not resolve, and a stable string is
    what makes that check readable in a test.

Dependencies
    Standard library only. Rule 5.1.2: the domain imports no infrastructure.
"""

from __future__ import annotations

from dataclasses import dataclass

from .place_spelling import PlaceSpelling


@dataclass(frozen=True, slots=True)
class VerseText:
    """One verse of the chapter being badged, in the requested translation."""

    verse_key: int
    verse: int
    osis_id: str
    text: str


@dataclass(frozen=True, slots=True)
class PlaceRecord:
    """One ancient place, with every spelling that should resolve to it.

    `spellings` holds the `place_names` rows restricted to the kinds that can
    occur in an English Bible -- the published name and the translations'
    variants. Modern names are excluded deliberately: "Athens" is a modern name
    for the place filed as Greece, and anchoring a badge on it would put a pin
    on a word scripture did not write. They arrive as records rather than as
    bare folded keys because a badge has to weigh them: see `spellings.py`.

    `homonym_count` is how many gazetteer rows carry this exact name. Above 1
    the sheet must say the name is shared rather than present one of them as
    THE Ramah (DECISIONS #10); nine places are called Ramah, four Gilgal, three
    Babylon.
    """

    place_id: str
    name: str
    modern_name: str | None
    lat: float | None
    lng: float | None
    feature_type: str
    named_verse_count: int
    candidate_count: int
    precision_type: str | None
    source_key: str
    spellings: tuple[PlaceSpelling, ...] = ()
    homonym_count: int = 1

    @property
    def is_located(self) -> bool:
        """True when the place has a pin. A route cannot use one without."""
        return self.lat is not None and self.lng is not None


@dataclass(frozen=True, slots=True)
class PlaceMentionRecord:
    """A place named in a verse. `mention_kind` says how it was referred to."""

    verse_key: int
    place_id: str
    mention_kind: str


@dataclass(frozen=True, slots=True)
class RouteStopRecord:
    """One stop of a route, in travel order."""

    position: int
    verse_key: int
    place_id: str


@dataclass(frozen=True, slots=True)
class RouteRecord:
    """An ordered sequence of located places across a span of verses."""

    route_id: str
    scheme: str
    start_key: int
    end_key: int
    source_key: str
    stops: tuple[RouteStopRecord, ...]


@dataclass(frozen=True, slots=True)
class InterpretiveClaim:
    """A named scholar's reading, which must never render as settled fact.

    Decision Q-015: Murai's literary structure ships attributed inline as
    "Murai's reading". `claim_type` carries that distinction to the wire so the
    sheet can style an interpretation differently from an attested datum.
    """

    attributed_to: str
    claim_label: str
    claim_type: str
    source_key: str


@dataclass(frozen=True, slots=True)
class DatedPassageRecord:
    """A passage with a sourced date -- the History badge's subject.

    `title` is Murai's pericope heading and is therefore his reading, not a
    neutral fact, which is why it travels with `claim`. When `claim` is None
    the title has no attributable source and the builder drops it.
    """

    passage_id: str
    start_key: int
    end_key: int
    title: str | None
    year_approx: int
    year_label: str
    rationale: str
    confidence: float | None
    origin: str
    source_key: str
    claim: InterpretiveClaim | None = None


@dataclass(frozen=True, slots=True)
class EventRecord:
    """A dated biblical event, for the timeline's upper axis."""

    event_id: int
    title: str
    year_approx: int
    date_label: str
    start_key: int
    end_key: int
    part_of: str | None
    source_key: str


@dataclass(frozen=True, slots=True)
class RulerRecord:
    """Who held power, for the timeline's lower axis."""

    ruler_id: int
    name: str
    #: The territory the SOURCE names, or None when the office label carries
    #: none: Wikidata gives Herod Antipas and Philip the bare label "tetrarch"
    #: and no territory, and neither ruled the Judaea that used to be filled in
    #: for them. A lane with no name is honest; a lane with the wrong one is not.
    realm: str | None
    title: str
    start_year: int | None
    end_year: int | None
    source_key: str

    def covers(self, year: int) -> bool:
        """True when this reign is open at `year`.

        A missing bound is treated as open on that side: Wikidata genuinely does
        not record a start for Herod the Great, and inventing one would be the
        badge asserting something no source supports.
        """
        if self.start_year is not None and year < self.start_year:
            return False
        return not (self.end_year is not None and year > self.end_year)


@dataclass(frozen=True, slots=True)
class LexemeRecord:
    """One original-language lemma, with its canon-wide usage counts."""

    strongs: str
    simple_strongs: str
    lang: str
    lemma: str
    translit: str | None
    pos: str | None
    short_gloss: str | None
    definition: str | None
    occurrence_count: int
    verse_count: int
    book_count: int
    source_key: str
    definition_source_key: str | None


@dataclass(frozen=True, slots=True)
class AlignedWordRecord:
    """An English token tied to the original-language word it renders."""

    verse_key: int
    token_index: int
    token: str
    char_start: int
    char_end: int
    method: str
    confidence: float
    surface: str
    lexeme: LexemeRecord
    #: Who computed the English-to-Greek mapping. Atlas, not a published source.
    source_key: str
    #: Who published the original-language word itself.
    word_source_key: str


@dataclass(frozen=True, slots=True)
class CrossRefRecord:
    """One outbound cross-reference, with its community vote count."""

    from_key: int
    to_start_key: int
    to_end_key: int
    votes: int
    display_reference: str
    text: str | None
    source_key: str
