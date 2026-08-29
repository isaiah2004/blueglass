"""The one-line claims a badge prints, and the two ways they used to lie.

Both defects were found by reading the shipped reader rather than by a failing
test, which is why they are pinned here: a teaser is the only sentence most
readers will ever see about a badge, and it is served with a licence line
underneath it saying a dataset said so.

  1. `3d-city` printed "Jerusalem - today Jerusalem" wherever the ancient and
     modern names match -- a sentence that says nothing, shown both in the
     chapter summary and as the sheet's headline claim.
  2. `root` printed TBESG's corrupted gloss "to listen ro" verbatim.
"""

from __future__ import annotations

from app.modules.badges.domain.builders.spatial import _city_teaser
from app.modules.badges.domain.gloss import is_malformed_gloss, usable_gloss
from app.modules.badges.domain.records import PlaceRecord


def _place(
    name: str,
    modern_name: str | None,
    *,
    named_verse_count: int = 12,
    candidate_count: int = 1,
) -> PlaceRecord:
    """A located settlement, with only the fields the teaser reads varying."""
    return PlaceRecord(
        place_id="p1",
        name=name,
        modern_name=modern_name,
        lat=31.77,
        lng=35.23,
        feature_type="settlement",
        named_verse_count=named_verse_count,
        candidate_count=candidate_count,
        precision_type="site",
        source_key="openbible_geocoding",
    )


class TestCityTeaser:
    """`_city_teaser` must never spend its one line saying nothing."""

    def test_a_real_rename_is_the_fact_worth_printing(self) -> None:
        assert _city_teaser(_place("Lystra", "Tel Lystra")) == "Lystra - today Tel Lystra"

    def test_an_unchanged_name_falls_back_to_how_much_of_the_canon_names_it(self) -> None:
        # 766 is Jerusalem's real figure: the verses whose English spells the name.
        # The gazetteer records 955 mentions of it, and the sentence says "named in".
        teaser = _city_teaser(_place("Jerusalem", "Jerusalem", named_verse_count=766))

        assert "today Jerusalem" not in teaser
        assert teaser == "Jerusalem - named in 766 verses of scripture"

    def test_case_and_padding_are_not_a_rename(self) -> None:
        assert "today" not in _city_teaser(_place("Jerusalem", " jerusalem "))

    def test_a_missing_modern_name_still_falls_back(self) -> None:
        assert _city_teaser(_place("Derbe", None, named_verse_count=4)) == (
            "Derbe - named in 4 verses of scripture"
        )

    def test_one_verse_is_singular(self) -> None:
        assert _city_teaser(_place("Adramyttium", None, named_verse_count=1)).endswith(
            "1 verse of scripture"
        )

    def test_scholarly_disagreement_still_leads(self) -> None:
        teaser = _city_teaser(_place("Lystra", "Lystra", candidate_count=3))

        assert teaser == "Lystra - 3 proposed sites for this city"


class TestMalformedGloss:
    """The rule is narrow on purpose: it must reject two rows, not two hundred."""

    def test_rejects_the_corrupted_glosses_tbesg_actually_ships(self) -> None:
        assert is_malformed_gloss("to listen ro") is True
        assert is_malformed_gloss("inerudite et") is True

    def test_keeps_every_gloss_that_legitimately_ends_in_a_short_word(self) -> None:
        for gloss in ("to listen to", "to sit on", "to go out", "of us", "you are"):
            assert is_malformed_gloss(gloss) is False, gloss

    def test_a_single_word_gloss_is_never_a_stub(self) -> None:
        for gloss in ("air", "sin", "net", "ox"):
            assert is_malformed_gloss(gloss) is False, gloss

    def test_punctuation_inside_a_word_is_not_a_token_boundary(self) -> None:
        # "thus(-ly)" is one word. A letters-only tokeniser splits it and sees
        # a two-letter "ly", which is exactly the false positive to avoid.
        assert is_malformed_gloss("thus(-ly)") is False


class TestUsableGloss:
    """What the badge prints when the headline sense cannot be shown."""

    def test_a_good_gloss_is_used_verbatim(self) -> None:
        assert usable_gloss("dealer in purple", "A seller of purple cloth.") == (
            "dealer in purple"
        )

    def test_a_corrupted_gloss_falls_back_to_the_same_row_s_definition(self) -> None:
        assert usable_gloss("to listen ro", "I listen to, hear, hearken to.") == (
            "I listen to, hear, hearken to"
        )

    def test_only_the_definition_s_first_sense_stands_in_for_a_gloss(self) -> None:
        assert usable_gloss("to listen ro", "I listen. Then I answer.") == "I listen"

    def test_no_usable_sense_returns_none_rather_than_a_typo(self) -> None:
        assert usable_gloss("to listen ro", None) is None
        assert usable_gloss("", "") is None

    def test_a_definition_too_long_to_be_a_headline_is_not_forced_into_one(self) -> None:
        assert usable_gloss("to listen ro", "x" * 200) is None
