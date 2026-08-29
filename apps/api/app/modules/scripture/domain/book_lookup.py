"""Resolve any reasonable spelling of a book to its canonical number.

Purpose
    The client sends whatever the user typed or the route carried: a canonical
    name, an OSIS code, a slug, a common abbreviation. One tolerant resolver
    keeps that tolerance in exactly one place, ported verbatim in behaviour from
    the prototype at server/app/scripture/books.py lines 40-63.

Key responsibilities
    - Normalise a token (lowercase, drop everything non-alphanumeric).
    - Map OSIS codes, canonical names and a curated alias list to numbers.
    - Accept a bare book number as a string, because routes carry strings.

Dependencies
    Only the books table. Pure functions, no I/O.

Usage
    number = book_number_from_any("1cor")   # -> 46
    book = require_book("sos")              # -> Book(22, ...) or NotFoundError
"""

from __future__ import annotations

from ....shared.errors import NotFoundError
from .books import BOOKS, BY_NUMBER, Book

# Aliases the OSIS codes and canonical names do not already cover. Transcribed
# from the prototype so a reference that worked there still works here.
_EXTRA_ALIASES: dict[str, int] = {
    "psalm": 19,
    "pss": 19,
    "songofsongs": 22,
    "canticles": 22,
    "sos": 22,
    "sng": 22,
    "mt": 40,
    "mrk": 41,
    "mar": 41,
    "mk": 41,
    "luk": 42,
    "lk": 42,
    "jhn": 43,
    "apoc": 66,
    "revelationofjohn": 66,
    "phm": 57,
    "jms": 59,
    "1thes": 52,
    "2thes": 53,
    "phi": 50,
}


def normalise_token(token: str) -> str:
    """Lowercase and strip every non-alphanumeric character.

    "1 Cor.", "1cor" and "1 CORINTHIANS" all collapse toward the same key.
    """
    return "".join(character for character in token.lower() if character.isalnum())


#: Roman-numeral prefixes for the numbered books. Readers type "II Kings" and
#: "III John", and the scrollmapper source data spells them that way, so both
#: the API and the loader resolve them through this one table.
_ARABIC_TO_ROMAN = {"1": "i", "2": "ii", "3": "iii"}


def _roman_variant(name: str) -> str | None:
    """ "2 Kings" -> "iikings". None for a book with no numeric prefix."""
    prefix, _, rest = name.partition(" ")
    roman = _ARABIC_TO_ROMAN.get(prefix)
    return None if roman is None or not rest else roman + normalise_token(rest)


def _build_alias_table() -> dict[str, int]:
    """Every accepted spelling, mapped to a book number."""
    aliases: dict[str, int] = {}
    for book in BOOKS:
        aliases[normalise_token(book.osis)] = book.book_number
        aliases[normalise_token(book.name)] = book.book_number
        roman = _roman_variant(book.name)
        if roman is not None:
            aliases[roman] = book.book_number
    aliases.update(_EXTRA_ALIASES)
    return aliases


ALIASES: dict[str, int] = _build_alias_table()


def book_number_from_any(token: str) -> int | None:
    """Resolve an OSIS code, name, alias, or numeric string to a book number.

    Returns None when nothing matches; callers that need a failure use
    require_book instead.
    """
    stripped = token.strip()
    if stripped.isdigit():
        number = int(stripped)
        return number if number in BY_NUMBER else None
    return ALIASES.get(normalise_token(stripped))


def book_from_any(token: str) -> Book | None:
    """Resolve a token to a Book, or None."""
    number = book_number_from_any(token)
    return BY_NUMBER[number] if number is not None else None


def require_book(token: str) -> Book:
    """Resolve a token to a Book or raise NotFoundError.

    The error code is book_not_found rather than the generic not_found so the
    client can tell "you asked for a book that does not exist" apart from "that
    chapter has no verses in this translation".
    """
    book = book_from_any(token)
    if book is None:
        raise NotFoundError(
            f"Unknown book: {token!r}",
            code="book_not_found",
            details={"book": token},
        )
    return book
