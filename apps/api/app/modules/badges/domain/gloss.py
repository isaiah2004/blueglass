"""Choosing which of a lexicon entry's two senses a reader is shown.

Purpose
    The `[Root]` badge prints `short_gloss` as the word's headline sense, and
    prints it as a sourced claim. TBESG's own file carries a small number of
    corrupted glosses -- `G1874` reads "to listen ro" where it means "to listen
    to" -- and they were ingested faithfully, which is right for the archive and
    wrong for the reader. A garbled gloss under scripture reads as the app
    being broken, and it is served with a licence line under it saying STEPBible
    said so.

The rule, and why it is this narrow
    A gloss is REJECTED when its last whitespace token reduces to one or two
    letters that English does not use as a word. Measured against all 11,035
    TBESG entries this matches exactly two rows, both genuinely corrupt
    ("to listen ro", "inerudite et"), and no correct gloss -- including the many
    that legitimately end in a short preposition ("to sit on", "to go out"),
    which is what a wider "short trailing word" rule would have swallowed by the
    hundred.

    Nothing is invented in the rejection. The fallback is the SAME lexicon row's
    longer definition -- `G1874` carries "I listen to, hear, hearken to." -- so
    the claim keeps its source, its licence and its meaning, and only loses the
    typo. When there is no definition to fall back to, the entry has no usable
    sense at all and the badge is not built, which is `AI-05`'s own answer.

Dependencies
    Standard library only. Rule 5.1.2: the domain imports no infrastructure.
"""

from __future__ import annotations

#: One- and two-letter tokens English really does end a phrase with. Anything
#: else that short at the end of a gloss is a stub, not a word.
_REAL_SHORT_WORDS = frozenset(
    {
        "a",
        "i",
        "o",
        "ah",
        "am",
        "an",
        "as",
        "at",
        "ax",
        "be",
        "by",
        "do",
        "eh",
        "ex",
        "go",
        "ha",
        "he",
        "hi",
        "id",
        "if",
        "in",
        "is",
        "it",
        "la",
        "lo",
        "me",
        "my",
        "no",
        "of",
        "oh",
        "on",
        "or",
        "ox",
        "so",
        "to",
        "up",
        "us",
        "we",
        "ye",
    }
)

#: How much of a definition may stand in for a gloss. A headline sense is a
#: phrase; past this the sheet's own lexicon section is the right place to read.
_MAX_FALLBACK_CHARS = 80


def _final_token_letters(text: str) -> str:
    """The letters of a phrase's last whitespace-separated token.

    Whitespace tokens, not a letter regex: "thus(-ly)" is one token and one
    word, and splitting it on its punctuation would leave a two-letter "ly"
    that looks exactly like the defect this module exists to catch.
    """
    tokens = text.split()
    if not tokens:
        return ""
    return "".join(character for character in tokens[-1] if character.isalpha())


def is_malformed_gloss(gloss: str) -> bool:
    """True when a gloss ends in a stub that no English phrase ends with.

    @param gloss: The lexicon's `short_gloss`, as ingested.
    @returns True when the gloss should not be shown to a reader.
        Side effects: none.

    Examples:
        is_malformed_gloss("to listen ro")  -> True
        is_malformed_gloss("to listen to")  -> False
        is_malformed_gloss("to sit on")     -> False
    """
    stripped = gloss.strip()
    if len(stripped.split()) < 2:
        # A one-word gloss has no dangling tail to detect, and plenty of real
        # ones are short ("air", "sin", "net"). Never reject on length alone.
        return False
    letters = _final_token_letters(stripped)
    return bool(letters) and len(letters) <= 2 and letters.lower() not in _REAL_SHORT_WORDS


def _first_sentence(definition: str) -> str:
    """The definition's opening sense, without its full stop."""
    head = definition.strip().split(". ")[0].strip()
    return head[:-1].strip() if head.endswith(".") else head


def usable_gloss(short_gloss: str | None, definition: str | None) -> str | None:
    """The sense the badge may print, or None when the entry has none.

    @param short_gloss: The lexicon's headline sense, as ingested.
    @param definition: The same row's longer definition.
    @returns A printable sense, or None when neither field yields one -- in
        which case the caller must not build the badge. Side effects: none.
    """
    gloss = (short_gloss or "").strip()
    if gloss and not is_malformed_gloss(gloss):
        return gloss

    fallback = _first_sentence(definition or "")
    if not fallback or len(fallback) > _MAX_FALLBACK_CHARS:
        return None
    return fallback
