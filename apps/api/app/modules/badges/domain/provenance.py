"""Source attribution and citations -- decision AI-05, as a type.

Purpose
    AI-05: every claim carries a source anchor or it is not shown. For M2 that
    means every badge payload names its source and licence, and a badge whose
    provenance is incomplete must never reach the wire. Making attribution a
    required, self-validating field is the only version of that rule a reviewer
    cannot forget to apply.

Key responsibilities
    - Carry one data source's name, licence, attribution line and retrieval
      date -- the four things the UI's attribution strip prints.
    - Decide, in one place, whether a source is complete enough to render.
    - Type the citation chips the design language requires beside a claim.

Dependencies
    Standard library only. Rule 5.1.2: the domain imports no infrastructure.

Usage
    if not attribution.is_renderable:
        continue   # AI-05: no provenance, no render
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

#: What kind of source a citation chip points at. Mirrors `CitationKind` in
#: `packages/shared/src/citation.ts`.
CitationKind = Literal["scripture", "reference-work", "manuscript", "gazetteer", "external"]


@dataclass(frozen=True, slots=True)
class SourceAttribution:
    """One row of `data_sources`, as the badge layer needs it.

    `licence` is spelled the British way here and `license` on the wire, because
    the column is `license` and renaming a published field is a breaking change
    the spelling preference does not justify.
    """

    key: str
    name: str
    licence: str
    attribution: str
    share_alike: bool
    url: str | None = None
    version: str | None = None
    retrieved_at: date | None = None

    @property
    def is_renderable(self) -> bool:
        """True when this source can lawfully and honestly appear under a badge.

        Four fields must be present: the key (so the row can be traced), the
        name and licence (so the reader is told what they are looking at and
        under what terms), and the attribution line (which several of our
        licences require verbatim). A source missing any of them is not a weak
        citation, it is an unusable one.
        """
        return bool(
            self.key.strip()
            and self.name.strip()
            and self.licence.strip()
            and self.attribution.strip()
        )


@dataclass(frozen=True, slots=True)
class Citation:
    """One piece of evidence, renderable as the chip beside a claim.

    Mirrors `Citation` in `packages/shared/src/citation.ts`. `url` is optional
    because gazetteer and lexicon sources frequently have no per-entry link;
    `label` is not, because a chip with no label cannot be drawn.
    """

    id: str
    kind: CitationKind
    label: str
    osis: str | None = None
    source_name: str | None = None
    url: str | None = None


def source_citation(
    citation_id: str, kind: CitationKind, source: SourceAttribution
) -> Citation:
    """Build the citation chip that names a dataset.

    @param citation_id: Unique within the badge that carries it.
    @param kind: Which chip style the source deserves.
    @param source: The dataset. Assumed already checked with `is_renderable`.
    @returns A citation labelled with the source's attribution line, which is
        the string its licence asks us to print. Side effects: none.
    """
    return Citation(
        id=citation_id,
        kind=kind,
        label=source.attribution,
        source_name=source.name,
        url=source.url,
    )


def all_renderable(sources: tuple[SourceAttribution, ...]) -> bool:
    """True when every source is complete AND there is at least one.

    The empty case is False on purpose: a badge with no sources at all is the
    exact thing AI-05 forbids, and returning True for it would make `all()`
    quietly wave it through.
    """
    return bool(sources) and all(source.is_renderable for source in sources)
