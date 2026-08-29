"""The Root badge: one original-language word, under the English that renders it.

Purpose
    The Word Root sheet shows a lemma, its Strong's number, a gloss and its
    usage across the canon. `verse_word_alignments` already knows which English
    characters render which Greek word, so this builder does no tokenising of
    its own -- it validates the stored offsets against the text being rendered
    and refuses the badge if they disagree.

Which words earn a badge: RARITY, not importance
    Acts 16:14 has thirteen aligned words. Badging all thirteen would bury the
    verse. The signal that separates a word worth stopping on from a word the
    reader already understands is how often it occurs: `theos` appears 1,346
    times and its gloss is "God", which the English already said.
    `porphyropolis` appears ONCE in the New Testament and means "dealer in
    purple" -- that is a word the reader cannot look up by reading on.

    So the rule is: at most one Root badge per verse, on the rarest aligned
    word with a usable gloss, and only when that word occurs at most twelve
    times in the corpus. Twelve is where the distribution turns: 4,501 of the
    5,580 attested lemmas occur ten times or fewer, so a higher bar would badge
    most of the vocabulary and a much lower one would badge almost nothing.

Scope: NEW TESTAMENT ONLY, and deliberately so
    `verse_words` and `verse_word_alignments` hold book numbers 40-66 and nothing
    else, so Genesis, Ruth, Psalms, Jonah and Obadiah return zero Root badges and
    the 8,021 Hebrew lexicon rows that ARE loaded are unreachable from the reader.
    That is a scope boundary, not an oversight, and it is recorded the way `Q-016`
    records New-Testament-only dating:

      - The word layer comes from STEPBible TAGNT, which is the Greek New
        Testament. The Hebrew equivalent is TAHOT, and it is not in `data/raw/`;
        acquiring it is a download, a second parser, and a Hebrew-to-English
        alignment pass that the Greek gloss-stem matcher does not generalise to.
      - `P-01` scopes full multimodal depth to **Acts**. Every other badge is in
        the same position, so a Hebrew Root badge would be depth in a book that
        has none of the other four.
      - The consequence to know: right-to-left rendering is exercised only by the
        synthetic `HEBREW_ROOT_PROBE` fixture at `/spike/textual-sheets`. It is
        tested; it is not reachable from scripture.

    See `docs/decisions/ASSUMPTIONS.md`, `L-06`.

Dependencies
    The badge domain only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

from ..anchor import span_anchor
from ..badge import BadgeId, InlineBadge
from ..badge_kind import BadgeKind
from ..chapter_data import ChapterBadgeData
from ..gloss import usable_gloss
from ..payloads import RootPayload
from ..provenance import source_citation
from ..records import AlignedWordRecord
from ..surface import bare_surface

#: A lemma occurring more often than this is common vocabulary, not a find.
MAX_OCCURRENCES = 12

#: Below this the alignment is a guess about which English word to tint, and a
#: badge on the wrong word is worse than no badge. `gloss-stem` matches land at
#: 0.8 and are kept: the PRD's own worked example, `sebomai` in Acts 16:14, is
#: one of them.
MIN_ALIGNMENT_CONFIDENCE = 0.8

_ROOT_FLOOR = 0.30
_ROOT_RANGE = 0.55


def build_root_badges(data: ChapterBadgeData) -> list[InlineBadge]:
    """At most one Root badge per verse, on that verse's rarest usable word."""
    built = [_root_badge(data, word) for word in _rarest_per_verse(data)]
    return [badge for badge in built if badge is not None]


def _rarest_per_verse(data: ChapterBadgeData) -> list[AlignedWordRecord]:
    """The one candidate word per verse, chosen by a total order.

    Ties break on token index then Strong's number, so a verse containing two
    equally rare words resolves the same way on every call rather than
    depending on row order.
    """
    best: dict[int, AlignedWordRecord] = {}
    for word in data.words:
        if not _is_candidate(word):
            continue
        current = best.get(word.verse_key)
        if current is None or _rarity_key(word) < _rarity_key(current):
            best[word.verse_key] = word
    return [best[key] for key in sorted(best)]


def _is_candidate(word: AlignedWordRecord) -> bool:
    """True when this word is rare enough, aligned well enough, and glossed.

    "Glossed" means a sense a reader can be shown, not merely a non-empty
    column: `domain/gloss.py` rejects TBESG's two corrupted glosses and falls
    back to the same row's definition, and a word with neither earns no badge.
    """
    return (
        word.confidence >= MIN_ALIGNMENT_CONFIDENCE
        and 0 < word.lexeme.occurrence_count <= MAX_OCCURRENCES
        and _gloss_of(word) is not None
    )


def _gloss_of(word: AlignedWordRecord) -> str | None:
    """The sense this word's badge may print, or None when it has none."""
    return usable_gloss(word.lexeme.short_gloss, word.lexeme.definition)


def _rarity_key(word: AlignedWordRecord) -> tuple[int, int, str]:
    """Rarest first, then earliest in the verse, then Strong's number."""
    return (word.lexeme.occurrence_count, word.token_index, word.lexeme.strongs)


def _root_badge(data: ChapterBadgeData, word: AlignedWordRecord) -> InlineBadge | None:
    """Build one Root badge, or None when the stored offsets do not verify."""
    verse = data.verse_text(word.verse_key)
    if verse is None:
        return None
    anchor = span_anchor(word.verse_key, verse.text, word.char_start, word.char_end)
    if anchor is None:
        return None
    lexeme = word.lexeme
    gloss = _gloss_of(word)
    if gloss is None:
        return None
    # A token that is nothing but a clause mark has no "as written here" form to
    # show, so it earns no badge rather than an empty line under the label.
    surface = bare_surface(word.surface)
    if not surface:
        return None
    sources = data.sources_for(
        lexeme.source_key,
        word.word_source_key,
        word.source_key,
        lexeme.definition_source_key if lexeme.definition else None,
    )
    return InlineBadge(
        id=BadgeId(BadgeKind.ROOT, anchor.verse_key, str(word.token_index)),
        kind=BadgeKind.ROOT,
        anchor=anchor,
        teaser=_teaser(word, gloss),
        payload=RootPayload(
            lemma=lexeme.lemma,
            language=lexeme.lang,
            transliteration=lexeme.translit,
            strongs_number=lexeme.simple_strongs,
            gloss=gloss,
            surface=surface,
            occurrence_count=lexeme.occurrence_count,
            verse_count=lexeme.verse_count,
            book_count=lexeme.book_count,
            definition=lexeme.definition,
            morphology=None,
        ),
        sources=sources,
        citations=tuple(
            source_citation(f"root-{index}", "reference-work", source)
            for index, source in enumerate(sources)
        ),
        rank_score=_root_score(lexeme.occurrence_count),
    )


def _teaser(word: AlignedWordRecord, gloss: str) -> str:
    """One line for the chapter summary list."""
    count = word.lexeme.occurrence_count
    times = "once" if count == 1 else f"{count} times"
    return f'{word.lexeme.lemma} - "{gloss}", used {times} in the corpus'


def _root_score(occurrences: int) -> float:
    """Rarer is more valuable, on a straight line from once to twelve times."""
    rarity = (MAX_OCCURRENCES + 1 - occurrences) / MAX_OCCURRENCES
    return round(_ROOT_FLOOR + _ROOT_RANGE * rarity, 4)
