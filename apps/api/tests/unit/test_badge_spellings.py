"""Which spellings a badge may claim, and where in the verse it may claim them.

Every case here is a defect that shipped. A badge tinted "the Jews" in Acts
28:17 and asserted it named Jerusalem; a pin carried Babylon's coordinate under
the label "Tyre", 865 km away; a map of "places named in this chapter" listed
"Hadadezer", a man. All three came out of one seam -- the resolver index being
read as if every row in it were a name of the place -- so they are tested
together, against the real strings the live gazetteer publishes.
"""

from __future__ import annotations

import pytest

from app.modules.badges.domain import PlaceSpelling, anchorable, name_anchor, names_a_people
from app.modules.badges.domain.spellings import MIN_ATTESTATION_SHARE
from tests.gazetteer_doubles import alias, primary, published, variant

VERSE = 44028017


def _names(spellings: tuple[PlaceSpelling, ...]) -> set[str]:
    """The published spellings a gate let through, by name."""
    return {spelling.name for spelling in spellings}


class TestTheSpellingsABadgeMayClaim:
    """`anchorable` -- the gate between the resolver index and the page."""

    def test_the_places_own_name_is_never_refused(self) -> None:
        """No gate here may overrule the gazetteer's answer to "what is this called"."""
        assert _names(anchorable([primary("Ai")])) == {"Ai"}

    def test_an_attested_variant_is_kept(self) -> None:
        """BSB prints "Negev" where the gazetteer files "Negeb". Both are the place."""
        kept = anchorable(published("Negeb", "Negev"))

        assert _names(kept) == {"Negeb", "Negev"}

    def test_a_one_use_alias_is_refused(self) -> None:
        """Jerusalem publishes "Jerusalem" 7,819 times and "Jews" once."""
        kept = anchorable((primary("Jerusalem"), alias("Jews")))

        assert _names(kept) == {"Jerusalem"}

    def test_the_share_is_measured_against_the_best_spelling(self) -> None:
        """A variant on the threshold is kept; one just under it is not."""
        best = 100
        floor = int(best * MIN_ATTESTATION_SHARE)
        kept = anchorable(
            (
                primary("Hebron"),
                variant("Kiriath-arba", attestation=floor),
                variant("Arbah", attestation=floor - 1),
            )
        )

        assert _names(kept) == {"Hebron", "Kiriath-arba"}

    def test_another_places_published_name_is_refused(self) -> None:
        """Ezekiel 26:7 pinned Babylon and labelled it Tyre, 865 km away."""
        kept = anchorable((primary("Babylon"), alias("Tyre", names_another_place=True)))

        assert _names(kept) == {"Babylon"}

    def test_a_people_word_is_refused(self) -> None:
        """1 Kings 16:34 tinted "the Bethelite", Hiel's demonym, and said [Site]."""
        kept = anchorable((primary("Bethel"), variant("Bethelite")))

        assert _names(kept) == {"Bethel"}

    def test_a_well_attested_people_word_is_still_refused(self) -> None:
        """OpenBible counts "Ammonites" 584 times against "Ammon"'s 360.

        Attestation cannot answer this one: the demonym is the MORE common
        string. Seven waypoints were labelled "Ammonites" on a map of places.
        """
        kept = anchorable((primary("Ammon"), variant("Ammonites", attestation=584)))

        assert _names(kept) == {"Ammon"}

    def test_a_bare_generic_term_is_refused(self) -> None:
        """The word "Sea" is a published spelling of Great Sea AND of Salt Sea."""
        kept = anchorable((primary("Great Sea"), variant("Sea")))

        assert _names(kept) == {"Great Sea"}

    @pytest.mark.parametrize(
        "spelling",
        [
            "ammonites",
            "chaldeans",
            "canaanite",
            "egyptians",
            "bethelite",
            "tishbite",
            "gerasenes",
            "samaritan",
            "philistines",
            "ammonitess",
        ],
    )
    def test_english_gentilics_read_as_a_people(self, spelling: str) -> None:
        assert names_a_people(spelling) is True

    @pytest.mark.parametrize(
        "spelling",
        ["jerusalem", "bethel", "negeb", "troas", "crete", "myra", "sidon", "cauda"],
    )
    def test_a_place_name_does_not(self, spelling: str) -> None:
        assert names_a_people(spelling) is False


class TestWhereInTheVerseTheBadgeLands:
    """`name_anchor` -- the ranking, and the two things the docstring promised."""

    def test_the_places_own_name_beats_an_alias_that_occurs_earlier(self) -> None:
        """The Acts 28:17 defect, exactly as it rendered.

        "the Jews" occurs eleven words before "Jerusalem" and the old rule took
        the earliest match, so the pill tinted a people-word and the sheet
        header read "ACTS 28:17 - THE JEWS".
        """
        text = (
            "Three days later, he called together the leaders of the Jews. "
            "When they had gathered, he said to them, 'Brothers, although I have "
            "done nothing against our people or the customs of our fathers, I was "
            "taken prisoner in Jerusalem.'"
        )
        anchor = name_anchor(VERSE, text, anchorable((primary("Jerusalem"), alias("Jews"))))

        assert anchor is not None
        assert anchor.text == "Jerusalem"

    def test_the_longest_name_wins_not_the_longest_span(self) -> None:
        """The docstring's own example was false.

        `_first_phrase` compared spans by word count and stripped the article
        afterwards, so the three-word span "the Most Holy" beat the three-word
        NAME "Most Holy Place" and seven pins were labelled "Most Holy".
        """
        text = "He prepared the inner sanctuary within, to set the Most Holy Place there."
        anchor = name_anchor(
            VERSE, text, (primary("Most Holy Place"), variant("Most Holy", attestation=90))
        )

        assert anchor is not None
        assert anchor.text == "Most Holy Place"

    def test_the_article_is_outside_the_span(self) -> None:
        """63 anchors tinted "the Jordan" while the pin beside them read "Jordan"."""
        text = "So the priests carried the ark to the Jordan and stopped."
        anchor = name_anchor(VERSE, text, published("Jordan"))

        assert anchor is not None
        assert anchor.text == "Jordan"
        assert text[anchor.start_offset : anchor.end_offset] == "Jordan"

    def test_a_lower_case_common_word_is_not_a_name(self) -> None:
        """Negeb publishes "South", weight 39, and "the south" is a direction."""
        text = "And Abram journeyed on toward the south."

        assert name_anchor(VERSE, text, published("Negeb", "South")) is None

    def test_a_verse_that_spells_no_admissible_name_gets_no_anchor(self) -> None:
        """1 Kings 16:34: the only place the verse names is Jericho."""
        text = "In his days, Hiel the Bethelite rebuilt Jericho at the cost of Abiram."
        spellings = anchorable((primary("Bethel"), variant("Bethelite")))

        assert name_anchor(VERSE, text, spellings) is None
