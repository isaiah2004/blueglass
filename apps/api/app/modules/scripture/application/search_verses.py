"""Use case: full-text scripture search.

Purpose
    The reader searches without losing their place, so this call must be fast
    and predictable. The prototype matched with a leading-wildcard ILIKE, which
    cannot use an index (data-inventory.md section 2); the repository behind this
    use case uses a tsvector match with a trigram fallback instead.

Scope
    The wire parameter scope is either the literal all or a book token, which is
    exactly the two pills the reader UI offers. An unrecognised token is a 404
    book_not_found rather than a silent whole-Bible search, because silently
    widening a scoped search is a lie the user cannot see.

Dependencies
    The ScriptureRepository port and the scripture domain.

Usage
    result = await SearchVerses(repo, default_limit=40, max_limit=200)(
        query="lamp unto my feet", translation="BSB", scope="all", limit=None
    )
"""

from __future__ import annotations

from dataclasses import dataclass

from ....shared.errors import NotFoundError, ValidationError
from ..domain import SearchHit, SearchScope, require_book
from .ports import ScriptureRepository

#: Below this length a query matches most of the canon and the response is
#: noise. The Flutter overlay already debounced to two characters.
MINIMUM_QUERY_LENGTH = 2

_SCOPE_ALL = "all"


@dataclass(frozen=True, slots=True)
class SearchResult:
    """What the search endpoint renders."""

    query: str
    translation: str
    scope: SearchScope
    hits: tuple[SearchHit, ...]


class SearchVerses:
    """Find verses whose text matches a query."""

    def __init__(
        self,
        repository: ScriptureRepository,
        *,
        default_limit: int,
        max_limit: int,
    ) -> None:
        self._repository = repository
        self._default_limit = default_limit
        self._max_limit = max_limit

    async def __call__(
        self,
        *,
        query: str,
        translation: str,
        scope: str,
        limit: int | None,
    ) -> SearchResult:
        term = query.strip()
        self._check_query(term)
        await self._check_translation(translation)
        parsed = self._parse_scope(scope)
        book_number = None if parsed.book is None else parsed.book.book_number

        hits = await self._repository.search_verses(
            query=term,
            translation=translation,
            book_number=book_number,
            limit=self._clamp_limit(limit),
        )
        return SearchResult(
            query=term, translation=translation, scope=parsed, hits=tuple(hits)
        )

    @staticmethod
    def _check_query(term: str) -> None:
        if len(term) < MINIMUM_QUERY_LENGTH:
            raise ValidationError(
                f"Search needs at least {MINIMUM_QUERY_LENGTH} characters.",
                code="query_too_short",
                details={"minimum_length": MINIMUM_QUERY_LENGTH},
            )

    @staticmethod
    def _parse_scope(scope: str) -> SearchScope:
        """Turn the wire scope into a domain scope."""
        token = scope.strip()
        if not token or token.lower() == _SCOPE_ALL:
            return SearchScope(book=None)
        return SearchScope(book=require_book(token))

    def _clamp_limit(self, limit: int | None) -> int:
        """Apply the default, then the ceiling. A caller asking for a million
        rows gets the ceiling, not an error: the ceiling protects the server,
        and refusing would just make the client retry."""
        return min(self._default_limit if limit is None else limit, self._max_limit)

    async def _check_translation(self, translation: str) -> None:
        if not await self._repository.translation_exists(translation):
            raise NotFoundError(
                f"Unknown or unloaded translation: {translation!r}",
                code="translation_not_found",
                details={"translation": translation},
            )
