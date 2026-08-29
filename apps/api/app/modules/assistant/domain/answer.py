"""The assistant's answer: text, its citations, and how much to trust it."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from .citation import Citation
from .grounding import GroundingConfidence


@dataclass(frozen=True, slots=True)
class AssistantAnswer:
    """One grounded-chat turn's result."""

    text: str
    citations: Sequence[Citation]
    confidence: GroundingConfidence
