"""GET /search — the reader searches without losing their place."""

from __future__ import annotations

from httpx import AsyncClient


async def test_search_returns_hits_in_the_prototype_shape(
    client: AsyncClient,
) -> None:
    response = await client.get("/search", params={"q": "wisdom"})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "wisdom"
    assert body["translation"] == "BSB"
    assert body["scope"] == "all"
    assert body["count"] == 1
    assert set(body["results"][0]) == {
        "ref",
        "book_number",
        "chapter",
        "verse",
        "text",
        "osis_id",
        "verse_key",
    }
    assert body["results"][0]["ref"] == "Proverbs 1:2"


async def test_scope_narrows_the_search_to_one_book(client: AsyncClient) -> None:
    """The reader UI's two pills: All and This book."""
    everywhere = await client.get("/search", params={"q": "the"})
    just_john = await client.get("/search", params={"q": "the", "scope": "John"})

    assert everywhere.json()["count"] > just_john.json()["count"]
    assert just_john.json()["scope"] == "John"


async def test_an_unknown_scope_is_404_not_a_silent_whole_bible_search(
    client: AsyncClient,
) -> None:
    """Widening a scoped search without saying so is a lie the user cannot see."""
    response = await client.get("/search", params={"q": "wisdom", "scope": "Hezekiah"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "book_not_found"


async def test_a_one_character_query_is_422(client: AsyncClient) -> None:
    response = await client.get("/search", params={"q": "a"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "query_too_short"
    assert error["details"]["minimum_length"] == 2


async def test_a_whitespace_only_query_is_422(client: AsyncClient) -> None:
    response = await client.get("/search", params={"q": "   "})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "query_too_short"


async def test_a_missing_query_is_422(client: AsyncClient) -> None:
    response = await client.get("/search")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_an_unknown_translation_is_404(client: AsyncClient) -> None:
    response = await client.get("/search", params={"q": "wisdom", "translation": "ESV"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "translation_not_found"


async def test_limit_is_clamped_rather_than_rejected(client: AsyncClient) -> None:
    """A ceiling protects the server; refusing would just make the client retry
    with a smaller number and cost a round trip."""
    response = await client.get("/search", params={"q": "the", "limit": 100000})

    assert response.status_code == 200


async def test_a_zero_limit_is_422(client: AsyncClient) -> None:
    response = await client.get("/search", params={"q": "the", "limit": 0})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
