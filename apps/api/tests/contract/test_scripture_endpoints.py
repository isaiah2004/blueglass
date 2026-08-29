"""The M1 scripture read API: translations, books, chapters, search.

Every documented status code has a test. The response FIELD NAMES are asserted
explicitly, because they are the contract the ported reader consumes
(flutter-port-map.md section 5) -- a rename here is a silent break there.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.modules.scripture.domain import CANONICAL_BOOK_COUNT, CANONICAL_CHAPTER_COUNT


# ── GET /translations ────────────────────────────────────────────────────────
async def test_translations_lists_only_loaded_translations(
    client: AsyncClient,
) -> None:
    response = await client.get("/translations")

    assert response.status_code == 200
    codes = [item["code"] for item in response.json()["translations"]]
    assert codes == ["BSB", "ASV"]


async def test_translation_rows_carry_the_redistribution_flag(
    client: AsyncClient,
) -> None:
    """The switcher must be able to tell an open translation from a licensed
    one; ESV is in the mockups and must never ship."""
    first = response_first(await client.get("/translations"))

    assert set(first) == {"code", "name", "language", "can_redistribute"}


def response_first(response) -> dict:
    return response.json()["translations"][0]


# ── GET /books ───────────────────────────────────────────────────────────────
async def test_books_returns_the_whole_canon(client: AsyncClient) -> None:
    books = (await client.get("/books")).json()["books"]

    assert len(books) == CANONICAL_BOOK_COUNT
    assert books[0]["name"] == "Genesis"
    assert books[-1]["name"] == "Revelation"


async def test_book_rows_carry_what_the_reference_picker_needs(
    client: AsyncClient,
) -> None:
    books = (await client.get("/books")).json()["books"]

    assert set(books[0]) == {
        "book_number",
        "name",
        "osis",
        "chapter_count",
        "testament",
    }
    assert sum(book["chapter_count"] for book in books) == CANONICAL_CHAPTER_COUNT


async def test_books_answers_without_a_database(client: AsyncClient) -> None:
    """Served from the domain table. The container's DSN points at a dead port
    and this still has to work."""
    assert (await client.get("/books")).status_code == 200


# ── GET /chapters/{translation}/{book}/{chapter} ─────────────────────────────
async def test_chapter_returns_verses_in_the_prototype_shape(
    client: AsyncClient,
) -> None:
    response = await client.get("/chapters/BSB/Proverbs/1")

    assert response.status_code == 200
    body = response.json()
    assert body["reference"] == "Proverbs 1"
    assert body["book_number"] == 20
    assert set(body["verses"][0]) == {"verse", "text", "osis_id", "verse_key"}
    assert body["verses"][0]["verse_key"] == 20_001_001
    assert body["verses"][0]["osis_id"] == "Prov.1.1"


@pytest.mark.parametrize("token", ["Proverbs", "Prov", "prov", "PROVERBS", "20"])
async def test_the_book_token_is_tolerant(client: AsyncClient, token: str) -> None:
    """Ported verbatim from the prototype's alias table."""
    response = await client.get(f"/chapters/BSB/{token}/1")

    assert response.status_code == 200
    assert response.json()["book_number"] == 20


async def test_unknown_book_is_404_book_not_found(client: AsyncClient) -> None:
    response = await client.get("/chapters/BSB/Hezekiah/1")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "book_not_found"


async def test_unknown_translation_is_404_translation_not_found(
    client: AsyncClient,
) -> None:
    """Distinct from an empty chapter: a typo in the code is a different fix."""
    response = await client.get("/chapters/ESV/Proverbs/1")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "translation_not_found"


async def test_chapter_beyond_the_book_is_422_out_of_range(
    client: AsyncClient,
) -> None:
    """Proverbs has 31 chapters. Asking for 99 is a client bug, not a data gap,
    and it is caught before any query runs."""
    response = await client.get("/chapters/BSB/Proverbs/99")

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "chapter_out_of_range"
    assert error["details"]["chapter_count"] == 31


async def test_chapter_absent_from_this_translation_is_404_chapter_not_found(
    client: AsyncClient,
) -> None:
    """In range for the canon, but not loaded. A partial load, not a client bug."""
    response = await client.get("/chapters/BSB/Proverbs/2")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "chapter_not_found"


async def test_non_numeric_chapter_is_422(client: AsyncClient) -> None:
    response = await client.get("/chapters/BSB/Proverbs/one")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
