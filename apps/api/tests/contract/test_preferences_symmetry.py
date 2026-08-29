"""GET and PUT /me/prefs must be SYMMETRIC.

The prototype was not (flutter-port-map.md section 5, endpoints 15 and 16):
GET returned the bare preference object, PUT demanded it wrapped in a prefs key.
A client could not send back what it had just received, so every caller had to
know the asymmetry and re-wrap by hand. These tests hold the fix.
"""

from __future__ import annotations

from httpx import AsyncClient

PREFS = {"rag": True, "web": False, "verseSize": 19}


async def test_a_read_response_can_be_written_back_unchanged(
    client: AsyncClient, identified: dict[str, str]
) -> None:
    """THE round-trip. This is what the prototype made impossible."""
    await client.put("/me/prefs", headers=identified, json={"prefs": PREFS})

    read_back = await client.get("/me/prefs", headers=identified)
    rewritten = await client.put("/me/prefs", headers=identified, json=read_back.json())

    assert rewritten.status_code == 200
    assert rewritten.json() == read_back.json()


async def test_both_directions_are_wrapped(
    client: AsyncClient, identified: dict[str, str]
) -> None:
    written = await client.put("/me/prefs", headers=identified, json={"prefs": PREFS})
    read = await client.get("/me/prefs", headers=identified)

    assert written.json() == {"prefs": PREFS}
    assert read.json() == {"prefs": PREFS}


async def test_unset_preferences_read_as_an_empty_object(
    client: AsyncClient, identified: dict[str, str]
) -> None:
    """Not a 404. A reader with no stored preferences has defaults, not an error."""
    response = await client.get("/me/prefs", headers=identified)

    assert response.status_code == 200
    assert response.json() == {"prefs": {}}


async def test_an_unwrapped_body_does_not_silently_store_nothing(
    client: AsyncClient, identified: dict[str, str]
) -> None:
    """Extra keys are ignored by Pydantic, so an unwrapped body would store an
    empty object and look like success. It must be visible in the response."""
    response = await client.put("/me/prefs", headers=identified, json=PREFS)

    assert response.json() == {"prefs": {}}


async def test_preferences_require_an_identity(client: AsyncClient) -> None:
    assert (await client.put("/me/prefs", json={"prefs": PREFS})).status_code == 401
