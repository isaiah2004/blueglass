"""Contract tests for the badge endpoints. Every documented status code.

These run against `InMemoryBadgeRepository`, so they exercise routing,
validation, the error envelope, the wire schema and the selection rules with no
database and in milliseconds. The SQL behind the real adapter is covered by
`tests/integration/test_badges_live.py`.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.modules.badges.domain import MAX_BADGES_PER_CHAPTER, MAX_BADGES_PER_VERSE
from tests.contract.badge_doubles import InMemoryBadgeRepository
from tests.contract.badge_fixture import (
    BARE_CHAPTER,
    PURPLE_END,
    PURPLE_START,
    TEXT_1,
    TEXT_8,
    TEXT_14,
    VERSE_1,
    VERSE_14,
)

CHAPTER_URL = "/badges/chapters/BSB/Acts/16"

pytestmark = pytest.mark.anyio


async def test_chapter_returns_badges_of_every_kind(badge_client: AsyncClient) -> None:
    """The fixture chapter justifies all five M2 kinds, and returns all five."""
    response = await badge_client.get(CHAPTER_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["reference"] == "Acts 16"
    assert body["book_number"] == 44
    kinds = {badge["kind"] for badge in body["badges"]}
    assert kinds == {"route", "3d-city", "history", "root", "cross-ref"}


async def test_every_badge_carries_a_licensed_source(badge_client: AsyncClient) -> None:
    """AI-05 on the wire: name the source and the licence, or do not render."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    assert body["badges"]
    for badge in body["badges"]:
        assert badge["sources"], f"{badge['id']} has no source"
        assert badge["citations"], f"{badge['id']} has no citation"
        for source in badge["sources"]:
            assert source["license"].strip()
            assert source["attribution"].strip()


async def test_chapter_repeats_the_union_of_sources(badge_client: AsyncClient) -> None:
    """The attribution strip can be drawn without walking every badge."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    top_level = {source["key"] for source in body["sources"]}
    per_badge = {source["key"] for badge in body["badges"] for source in badge["sources"]}
    assert top_level == per_badge
    assert "theographic_events" in top_level


async def test_anchors_point_at_the_words_they_claim(badge_client: AsyncClient) -> None:
    """An anchor's offsets must select its own text out of the verse.

    This is the invariant that stops a pill tinting the wrong word: the client
    slices the verse with these offsets, and if the slice is not `text` the
    reader sees a highlight in the wrong place.
    """
    verses = {44016001: TEXT_1, 44016008: TEXT_8, VERSE_14: TEXT_14}
    body = (await badge_client.get(CHAPTER_URL)).json()

    for badge in body["badges"]:
        anchor = badge["anchor"]
        assert anchor["verse_key"] in verses
        assert anchor["end_offset"] > anchor["start_offset"]
        text = verses[anchor["verse_key"]]
        if text is not None:
            assert text[anchor["start_offset"] : anchor["end_offset"]] == anchor["text"]


async def test_anchors_are_stable_across_calls(badge_client: AsyncClient) -> None:
    """The same chapter must produce the same anchors, in the same order.

    The reading experience shifting under the reader is the failure this guards
    against: a pill that moves between two reads of the same chapter is worse
    than no pill.
    """
    first = (await badge_client.get(CHAPTER_URL)).json()["badges"]
    second = (await badge_client.get(CHAPTER_URL)).json()["badges"]

    assert [badge["id"] for badge in first] == [badge["id"] for badge in second]
    assert [badge["anchor"] for badge in first] == [badge["anchor"] for badge in second]
    assert first == second


async def test_per_verse_cap_holds(badge_client: AsyncClient) -> None:
    """No verse may carry more than two pills, whatever the data justifies.

    Verse 14 of the fixture justifies a City badge, a Root badge and a
    Cross-Ref badge; only two may survive.
    """
    body = (await badge_client.get(CHAPTER_URL)).json()

    per_verse: dict[int, int] = {}
    for badge in body["badges"]:
        key = badge["anchor"]["verse_key"]
        per_verse[key] = per_verse.get(key, 0) + 1
    assert per_verse, "expected badges to assert against"
    assert max(per_verse.values()) <= MAX_BADGES_PER_VERSE
    assert per_verse[VERSE_14] == MAX_BADGES_PER_VERSE


async def test_chapter_cap_holds(badge_client: AsyncClient) -> None:
    """A chapter never returns more than twelve badges."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    assert len(body["badges"]) <= MAX_BADGES_PER_CHAPTER


async def test_no_two_badges_share_a_run_of_characters(
    badge_client: AsyncClient,
) -> None:
    """Overlapping anchors are a rendering fault, so they cannot be returned."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    spans: dict[int, list[tuple[int, int]]] = {}
    for badge in body["badges"]:
        anchor = badge["anchor"]
        taken = spans.setdefault(anchor["verse_key"], [])
        for start, end in taken:
            assert not (anchor["start_offset"] < end and start < anchor["end_offset"])
        taken.append((anchor["start_offset"], anchor["end_offset"]))


async def test_murai_structure_is_attributed(badge_client: AsyncClient) -> None:
    """Q-015: one scholar's reading, never presented as settled fact."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    history = next(b for b in body["badges"] if b["kind"] == "history")
    payload = history["payload"]
    assert payload["passage_title"] == "Timothy joins Paul and Silas"
    assert payload["interpretive_claim"] == "Murai's reading"
    assert payload["attributed_to"] == "Hajime Murai"
    assert any(s["key"] == "murai_literary_structure" for s in history["sources"])


async def test_root_badge_anchors_on_the_aligned_word(
    badge_client: AsyncClient,
) -> None:
    """The Root badge uses the alignment's own offsets, verified against text."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    root = next(b for b in body["badges"] if b["kind"] == "root")
    assert root["anchor"]["start_offset"] == PURPLE_START
    assert root["anchor"]["end_offset"] == PURPLE_END
    assert root["payload"]["strongs_number"] == "G4211"
    assert root["payload"]["occurrence_count"] == 1


async def test_city_badge_ships_no_invented_reconstruction(
    badge_client: AsyncClient,
) -> None:
    """No open 3D reconstruction exists, so none is claimed."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    cities = [b for b in body["badges"] if b["kind"] == "3d-city"]
    assert cities
    for city in cities:
        payload = city["payload"]
        assert payload["has_reconstruction"] is False
        assert payload["location"]["coordinates"] != [0.0, 0.0]
        assert set(payload) >= {"modern_name", "identification_count", "mentioned_at"}
        assert "reconstruction_id" not in payload
        assert "era_label" not in payload


async def test_route_outranks_a_city_on_the_same_word(
    badge_client: AsyncClient,
) -> None:
    """Rule 1: one badge per run of characters, decided by P-04's order.

    Derbe is both the route's departure and a settlement in its own right.
    Both want the same five characters of verse 1; the route wins, and the
    city badge for Derbe is not returned at all.
    """
    body = (await badge_client.get(CHAPTER_URL)).json()

    route = next(b for b in body["badges"] if b["kind"] == "route")
    assert route["anchor"]["verse_key"] == VERSE_1
    assert route["anchor"]["text"] == "Derbe"
    city_places = {
        b["payload"]["location"]["place_id"] for b in body["badges"] if b["kind"] == "3d-city"
    }
    assert "derbe" not in city_places


async def test_weakly_voted_cross_references_are_dropped(
    badge_client: AsyncClient,
) -> None:
    """A link nobody much agreed with is not worth interrupting reading for."""
    body = (await badge_client.get(CHAPTER_URL)).json()

    for badge in body["badges"]:
        if badge["kind"] != "cross-ref":
            continue
        for target in badge["payload"]["targets"]:
            assert target["votes"] >= 10
            assert target["display_reference"] != "2 Timothy 1:5"


async def test_chapter_with_no_badge_data_returns_empty_not_error(
    badge_client: AsyncClient,
) -> None:
    """Most of the canon is unenriched. That is a 200, not a 404."""
    response = await badge_client.get(f"/badges/chapters/BSB/Acts/{BARE_CHAPTER}")

    assert response.status_code == 200
    body = response.json()
    assert body["badges"] == []
    assert body["sources"] == []


async def test_unknown_book_is_404(badge_client: AsyncClient) -> None:
    response = await badge_client.get("/badges/chapters/BSB/Hezekiah/1")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "book_not_found"


async def test_chapter_without_verses_is_404(badge_client: AsyncClient) -> None:
    response = await badge_client.get("/badges/chapters/BSB/Acts/99")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "chapter_not_found"


async def test_chapter_zero_is_422(badge_client: AsyncClient) -> None:
    response = await badge_client.get("/badges/chapters/BSB/Acts/0")

    assert response.status_code == 422


async def test_one_repository_load_per_request(
    badge_client: AsyncClient, badge_repository: InMemoryBadgeRepository
) -> None:
    """No waterfall: a whole chapter of badges costs exactly one load."""
    await badge_client.get(CHAPTER_URL)

    assert badge_repository.calls == [("BSB", 44, 16)]


async def test_badge_by_id_round_trips(badge_client: AsyncClient) -> None:
    """Every id the chapter returns can be reopened on its own."""
    badges = (await badge_client.get(CHAPTER_URL)).json()["badges"]

    for badge in badges:
        response = await badge_client.get(f"/badges/{badge['id']}")
        assert response.status_code == 200, badge["id"]
        assert response.json() == badge


async def test_malformed_badge_id_is_422(badge_client: AsyncClient) -> None:
    response = await badge_client.get("/badges/not-a-badge-id")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "badge_id_malformed"


async def test_unknown_badge_id_is_404(badge_client: AsyncClient) -> None:
    response = await badge_client.get("/badges/route~44016001~no-such-route")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "badge_not_found"
