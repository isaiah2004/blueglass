"""Use case: the 66-book table.

Purpose
    The reference picker needs the canon before any chapter is fetched, and it
    must be identical on every client. Serving it from the domain constant means
    this endpoint answers correctly even when the database is empty, which makes
    it a useful first call for a client checking the API is real.

Dependencies
    The domain books table. No repository -- the canon is not data we store.

Usage
    books = ListBooks()()
"""

from __future__ import annotations

from collections.abc import Sequence

from ..domain import BOOKS, Book


class ListBooks:
    """Return the canon in order."""

    def __call__(self) -> Sequence[Book]:
        return BOOKS
