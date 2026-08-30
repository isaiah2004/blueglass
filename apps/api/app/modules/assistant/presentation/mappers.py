"""Maps the assistant domain's AssistantAnswer onto its wire schema."""

from __future__ import annotations

from ..domain import AssistantAnswer
from .schemas import AskOut, CitationOut


def to_ask_out(answer: AssistantAnswer) -> AskOut:
    """AssistantAnswer -> AskOut. The one place that shape is spelled."""
    return AskOut(
        answer=answer.text,
        citations=[
            CitationOut(
                label=citation.label, verse_key=citation.verse_key, score=citation.score
            )
            for citation in answer.citations
        ],
        confidence=answer.confidence,
    )
