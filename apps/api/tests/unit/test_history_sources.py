"""The history parsers' rules, exercised on rows copied from the real files.

Decision Q-016 lives in ``theographic_events``: dating is New Testament only.
These tests are what stops that filter from being quietly widened later.
"""

from __future__ import annotations

from datetime import date

import pytest

from scripts.raw_datasets import (
    MURAI_STRUCTURE,
    THEOGRAPHIC_EVENTS,
    WIKIDATA_RULERS,
    RawDataset,
)
from scripts.theographic_events import (
    EventDataError,
    _is_new_testament,
    _keys_by_book,
    _parse_year,
    _rows_from,
    year_label_for,
)
from scripts.wikidata_rulers import OFFICES, RulerDataError, _parse_xsd_date, _row_from


def _binding(**values: str) -> dict[str, dict[str, str]]:
    """A SPARQL binding in the shape the query service returns."""
    return {key: {"value": value} for key, value in values.items()}


class TestWikidataRulers:
    def test_an_ad_reign_keeps_its_calendar_dates(self) -> None:
        row = _row_from(
            _binding(
                person="http://www.wikidata.org/entity/Q17131",
                personLabel="Pontius Pilatus",
                officeLabel="prefect of Judea",
                start="0026-01-01T00:00:00Z",
                end="0036-01-01T00:00:00Z",
            )
        )

        assert row is not None
        assert (row.realm, row.title) == ("Judaea", "Prefect")
        assert (row.start_year, row.end_year) == (26, 36)
        assert row.start_date == date(26, 1, 1)

    def test_a_bc_reign_keeps_the_year_and_drops_the_date(self) -> None:
        """datetime cannot represent a negative year; NULL says so honestly."""
        row = _row_from(
            _binding(
                ruler="http://www.wikidata.org/entity/Q1405",
                rulerLabel="Augustus",
                officeLabel="Roman emperor",
                startTime="-0026-01-01T00:00:00Z",
                endTime="0014-08-17T00:00:00Z",
            )
        )

        assert row is not None
        assert row.start_year == -26
        assert row.start_date is None
        assert row.date_precision == "day"

    def test_january_the_first_is_wikidatas_shrug_not_a_real_day(self) -> None:
        row = _row_from(
            _binding(
                person="http://www.wikidata.org/entity/Q298636",
                personLabel="Agrippa I",
                officeLabel="King of Judea",
                start="0041-01-01T00:00:00Z",
                end="0044-01-01T00:00:00Z",
            )
        )

        assert row is not None
        assert row.date_precision == "year"

    def test_an_undated_claimant_is_dropped(self) -> None:
        """The unfiltered Wikidata result is led by usurpers with no dates."""
        assert _row_from(_binding(personLabel="Pheroras", officeLabel="tetrarch")) is None

    def test_an_office_mapped_to_none_is_excluded_deliberately(self) -> None:
        assert OFFICES["consul suffectus"] is None
        assert (
            _row_from(
                _binding(
                    person="http://www.wikidata.org/entity/Q452194",
                    personLabel="Lucius Junius Gallio Annaeanus",
                    officeLabel="consul suffectus",
                    start="0056-07-01T00:00:00Z",
                )
            )
            is None
        )

    def test_an_unknown_office_stops_the_load(self) -> None:
        with pytest.raises(RulerDataError):
            _row_from(_binding(personLabel="Someone", officeLabel="satrap of Nowhere"))

    def test_an_unreadable_date_is_an_error(self) -> None:
        with pytest.raises(RulerDataError):
            _parse_xsd_date("sometime in the spring")


class TestTheographicEvents:
    @pytest.mark.parametrize(
        ("raw", "expected"), [("0030", 30), ("0030-05-01", 30), ("-4003", -4003)]
    )
    def test_only_the_leading_signed_integer_is_read(self, raw: str, expected: int) -> None:
        assert _parse_year(raw) == expected

    @pytest.mark.parametrize(("year", "label"), [(30, "AD 30"), (-4, "4 BC"), (0, "1 BC")])
    def test_years_render_the_way_a_reader_expects(self, year: int, label: str) -> None:
        assert year_label_for(year) == label

    def test_verses_are_grouped_by_the_book_they_sit_in(self) -> None:
        grouped = _keys_by_book("Acts.16.14,Acts.16.40,Matt.1.1")

        assert grouped[44] == [44_016_014, 44_016_040]
        assert grouped[40] == [40_001_001]

    def test_an_event_touching_the_old_testament_is_not_new_testament(self) -> None:
        """Q-016: Ussher's chronology must not reach a passage through a gospel."""
        assert _is_new_testament({44: [44_001_001]})
        assert not _is_new_testament({1: [1_001_001], 44: [44_001_001]})
        assert not _is_new_testament({})

    def test_one_event_becomes_one_row_per_book(self) -> None:
        rows = _rows_from(
            {
                "eventID": "1",
                "title": "The Transfiguration",
                "startDate": "0032",
                "verses": "Matt.17.1,Matt.17.2,Mark.9.2,Luke.9.28",
                "partOf": "",
            }
        )

        assert [row.book_number for row in rows] == [40, 41, 42]
        assert all(row.year_approx == 32 for row in rows)
        assert all(row.date_label == "AD 32" for row in rows)

    def test_an_old_testament_event_yields_nothing(self) -> None:
        rows = _rows_from(
            {
                "eventID": "1",
                "title": "Creation of all things",
                "startDate": "-4003",
                "verses": "Gen.1.1,Gen.1.2",
                "partOf": "",
            }
        )

        assert rows == []

    def test_an_untitled_event_is_an_error(self) -> None:
        with pytest.raises(EventDataError):
            _rows_from(
                {
                    "eventID": "9",
                    "title": "   ",
                    "startDate": "0030",
                    "verses": "Acts.1.1",
                    "partOf": "",
                }
            )


class TestProvenanceRecords:
    """AI-05: a badge with no provenance must not render, so the licence facts
    have to be present and correct before a single row is written."""

    @pytest.mark.parametrize("dataset", [WIKIDATA_RULERS, THEOGRAPHIC_EVENTS, MURAI_STRUCTURE])
    def test_every_dataset_names_a_licence_and_an_attribution(
        self, dataset: RawDataset
    ) -> None:
        assert dataset.licence.identifier
        assert dataset.licence.attribution.strip()
        assert dataset.licence.url.startswith("https://")
        assert dataset.digests

    def test_the_one_share_alike_source_is_flagged_as_such(self) -> None:
        """Q-007 is enforced with a WHERE clause, which needs this flag right."""
        assert THEOGRAPHIC_EVENTS.licence.share_alike
        assert not WIKIDATA_RULERS.licence.share_alike
        assert not MURAI_STRUCTURE.licence.share_alike

    def test_murais_attribution_is_the_string_the_site_asks_for(self) -> None:
        assert MURAI_STRUCTURE.licence.attribution == (
            "Literary structure analysis by Hajime Murai, CC BY 4.0 — "
            "bible.literarystructure.info"
        )
