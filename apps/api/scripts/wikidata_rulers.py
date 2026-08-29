"""Turn the acquired Wikidata SPARQL results into ruler rows.

Purpose
    The History badge's outer axis is "who was in power". Wikidata answers that
    for the whole New Testament era in two saved queries -- the emperors, and
    the Judaean offices the New Testament names by title -- and it is CC0, so
    there is no attribution obligation to weigh.

Key responsibilities
    - Read the two saved SPARQL result files.
    - Map each office to a display title and a timeline lane (its realm).
    - Convert Wikidata's XSD dates to years, and record how precise they are.

Two things worth knowing about these dates
    1. Wikidata numbers years astronomically, so ``-0026`` is 26 BC by the
       convention the acquisition note used and 27 BC by strict ISO 8601 where
       year zero exists. The badge shows a reign band on a timeline, so a
       possible one-year offset on the BC end is recorded here rather than
       silently "fixed" by arithmetic no source supports.
    2. A date of 1 January is Wikidata's way of writing a year with no
       finer detail -- Nerva's real accession was in September. Such rows are
       marked ``date_precision = 'year'`` so the UI never renders a false day.

Dependencies
    Standard library and ``raw_datasets``. No network.

Usage
    rulers = read_rulers()
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date

from scripts.raw_datasets import WIKIDATA_RULERS, verify_digest

EMPERORS_FILE = "nt-era-rulers.json"
OFFICIALS_FILE = "nt-era-officials.json"


class RulerDataError(ValueError):
    """A ruler row could not be interpreted, and guessing is not allowed."""


@dataclass(frozen=True, slots=True)
class Office:
    """How one Wikidata office is presented on the timeline."""

    title: str
    realm: str


#: Every office present in the two acquired files. A ``None`` value means the
#: office was retrieved but is deliberately not loaded. An office that is in
#: neither list stops the ingest: a new office appearing upstream is exactly
#: the kind of change that should be looked at, not absorbed.
OFFICES: dict[str, Office | None] = {
    "Roman emperor": Office(title="Emperor", realm="Roman Empire"),
    "King of Judea": Office(title="King", realm="Judaea"),
    "ethnarch": Office(title="Ethnarch", realm="Judaea"),
    "tetrarch": Office(title="Tetrarch", realm="Judaea"),
    "prefect of Judea": Office(title="Prefect", realm="Judaea"),
    "procurator of Judea": Office(title="Procurator", realm="Judaea"),
    # Wikidata carries no English label for this item; the Latin is
    # "proconsul prouinciae Achaiae". This is Gallio's office in Acts 18:12.
    "Q132064792": Office(title="Proconsul", realm="Achaia"),
    # Gallio's later suffect consulship at Rome. Retrieved because it hangs off
    # the same person, but it says nothing about any passage.
    "consul suffectus": None,
}


@dataclass(frozen=True, slots=True)
class RulerRow:
    """One person holding one office for one span of time."""

    external_id: str
    name: str
    realm: str
    title: str
    start_year: int | None
    end_year: int | None
    start_date: date | None
    end_date: date | None
    date_precision: str


def _binding(row: dict[str, dict[str, str]], key: str) -> str | None:
    """One SPARQL binding's value, or None when the variable was unbound."""
    cell = row.get(key)
    return None if cell is None else cell.get("value")


def _parse_xsd_date(value: str | None) -> tuple[int, date | None] | None:
    """Split an XSD dateTime into (year, calendar date or None).

    A negative year has no ``datetime`` representation, and neither does the
    day-of-year detail we would need to build one, so BC rows keep the year and
    drop the date. That is a real limit of the type, recorded rather than
    worked around with a fake positive year.
    """
    if not value:
        return None
    negative = value.startswith("-")
    body = value[1:] if negative else value
    try:
        year, month, day = (int(part) for part in body[:10].split("-"))
    except ValueError as error:
        raise RulerDataError(f"unreadable Wikidata date: {value!r}") from error
    if negative:
        return -year, None
    return year, date(year, month, day)


def _precision_of(start: date | None, end: date | None) -> str:
    """'year' when both bounds sit on 1 January, which is Wikidata's shrug."""
    bounds = [bound for bound in (start, end) if bound is not None]
    if bounds and all(bound.month == 1 and bound.day == 1 for bound in bounds):
        return "year"
    return "day" if bounds else "year"


def _row_from(binding: dict[str, dict[str, str]]) -> RulerRow | None:
    """One SPARQL binding into a ruler row, or None if the office is excluded."""
    office_label = _binding(binding, "officeLabel")
    if office_label is None:
        raise RulerDataError("a SPARQL row carried no office label")
    if office_label not in OFFICES:
        raise RulerDataError(
            f"unknown office {office_label!r}. Add it to OFFICES with a title and "
            "realm, or map it to None to exclude it deliberately."
        )
    office = OFFICES[office_label]
    if office is None:
        return None
    start = _parse_xsd_date(_binding(binding, "startTime") or _binding(binding, "start"))
    end = _parse_xsd_date(_binding(binding, "endTime") or _binding(binding, "end"))
    if start is None and end is None:
        return None
    entity = _binding(binding, "ruler") or _binding(binding, "person") or ""
    name = _binding(binding, "rulerLabel") or _binding(binding, "personLabel")
    if not name:
        raise RulerDataError(f"no label for {entity!r}")
    start_date = start[1] if start else None
    end_date = end[1] if end else None
    return RulerRow(
        external_id=entity.rsplit("/", 1)[-1],
        name=name,
        realm=office.realm,
        title=office.title,
        start_year=start[0] if start else None,
        end_year=end[0] if end else None,
        start_date=start_date,
        end_date=end_date,
        date_precision=_precision_of(start_date, end_date),
    )


def _read_file(name: str) -> list[RulerRow]:
    """Every usable ruler row in one saved SPARQL result."""
    path = verify_digest(WIKIDATA_RULERS, name)
    document = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for binding in document["results"]["bindings"]:
        row = _row_from(binding)
        if row is not None:
            rows.append(row)
    return rows


def read_rulers() -> list[RulerRow]:
    """Every dated New Testament era ruler, emperors and Judaean offices alike.

    Rows with neither a start nor an end year are dropped: the acquisition note
    warns that the unfiltered Wikidata result is led by usurpers with no dates
    at all, and a reign with no bounds cannot be drawn on a timeline.
    """
    return _read_file(EMPERORS_FILE) + _read_file(OFFICIALS_FILE)
