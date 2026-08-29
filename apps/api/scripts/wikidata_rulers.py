"""Turn the acquired Wikidata SPARQL results into ruler rows.

Purpose
    The History badge's outer axis is "who was in power". Wikidata answers that
    for the whole New Testament era in two saved queries -- the emperors, and
    the Judaean offices the New Testament names by title -- and it is CC0, so
    there is no attribution obligation to weigh.

Key responsibilities
    - Read the two saved SPARQL result files.
    - Map each office to a display title, and to a timeline lane where the
      source names one -- see "The realm is the source's, or it is absent".
    - Convert Wikidata's XSD dates to years, and record how precise they are.

Two things worth knowing about these dates
    1. Wikidata serialises years astronomically -- year zero exists and is
       1 BC -- so ``-0003`` is **4 BC**, not 3 BC. The offset is not a
       theory: all four BC bounds in the acquired files check out against
       every reference work when it is applied and against none when it is
       not. Herod the Great's death (``-0003``) is 4 BC, Herod Archelaus's
       accession (``-0003``) is 4 BC, Philip the Tetrarch's accession
       (``-0003``) is 4 BC, and Augustus's principate (``-0026``) begins in
       27 BC. ``_parse_xsd_date`` converts once, at the boundary, so every
       row downstream carries the year a reader would look up and the badge
       needs no era arithmetic of its own. 10 of the 43 loaded rulers carry a
       BC bound.
    2. A date of 1 January is Wikidata's way of writing a year with no
       finer detail -- Nerva's real accession was in September. Such rows are
       marked ``date_precision = 'year'`` so the UI never renders a false day.

The realm is the source's, or it is absent
    An office label sometimes carries its territory ("prefect of Judea") and
    sometimes does not ("tetrarch"). Filling the blank in was a badge asserting
    what its own citation does not say: "Herod Antipas, Tetrarch of Judaea" ran
    on 188 history badges and "Philip the Tetrarch, Tetrarch of Judaea" on 181,
    and neither man ruled Judaea -- Antipas held Galilee and Peraea, Philip
    Iturea and Trachonitis, which is exactly the distinction Luke 3:1 draws by
    listing them apart from Pilate. ``realm`` is therefore ``None`` for a bare
    office, and the timeline groups those rulers under no lane rather than
    under a wrong one.

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
    """How one Wikidata office is presented on the timeline.

    ``realm`` is None when the office label names no territory. Nothing citing
    Wikidata may say more than Wikidata says.
    """

    title: str
    realm: str | None


#: Every office present in the two acquired files. A ``None`` value means the
#: office was retrieved but is deliberately not loaded. An office that is in
#: neither list stops the ingest: a new office appearing upstream is exactly
#: the kind of change that should be looked at, not absorbed.
OFFICES: dict[str, Office | None] = {
    "Roman emperor": Office(title="Emperor", realm="Roman Empire"),
    "King of Judea": Office(title="King", realm="Judaea"),
    "ethnarch": Office(title="Ethnarch", realm="Judaea"),
    # No territory. Wikidata gives these rows the bare office label, and the
    # three men who hold it in the acquired file ruled three different places.
    "tetrarch": Office(title="Tetrarch", realm=None),
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
    #: The territory the SOURCE names, or None when the office label carries
    #: none. Never inferred from the person.
    realm: str | None
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

    BC years are converted out of Wikidata's astronomical numbering here and
    nowhere else: ``-0003`` becomes ``-4``, which is the 4 BC every reference
    work prints. Converting at the boundary is what lets the ruler years and
    Theographic's event years -- which are plain BC already -- be compared as
    integers without either side knowing about the other's convention.
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
        return -(year + 1), None
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
            f"unknown office {office_label!r}. Add it to OFFICES with a title, "
            "and a realm only if the label names one; or map it to None to "
            "exclude the office deliberately."
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
