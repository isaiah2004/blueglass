"""Chapter study content: the generated notes attached to a chapter.

Purpose
    Ports endpoints 7 and the PUT the port map lists as never called by the
    Flutter client. The shape of the content object is the prototype's, so the
    reader UI can consume it unchanged.

Key responsibilities
    - Model a stored study record.
    - Record who wrote it. The prototype stored no author because it had no
      identities; origin and author_subject are what let the UI honour pillar 3
      and say whether a human or a model produced a claim.

Dependencies
    Standard library only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

StudyOrigin = Literal["sourced", "generated", "authored"]


@dataclass(frozen=True, slots=True)
class ChapterStudy:
    """One chapter of study content."""

    book_number: int
    chapter: int
    content: dict[str, Any] = field(default_factory=dict)
    model: str | None = None
    origin: StudyOrigin = "generated"
    author_subject: str | None = None
    updated_at: datetime | None = None
