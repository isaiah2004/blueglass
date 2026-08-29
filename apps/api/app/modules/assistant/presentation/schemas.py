"""Wire schemas for the Studio Assistant endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AskIn(BaseModel):
    """The body of an /assistant/ask request."""

    question: str = Field(min_length=1, max_length=1000, description="The reader's question.")


class CitationOut(BaseModel):
    """One citation grounding the answer, in the order it was placed in the prompt."""

    label: str = Field(description='Human-readable reference, e.g. "Acts 16:14".')
    verse_key: int | None
    score: float = Field(description="Relevance in [0, 1]; higher is more relevant.")


class AskOut(BaseModel):
    """A grounded answer: its text, the sources it cites, and how confident it is."""

    answer: str
    citations: list[CitationOut]
    confidence: str = Field(description='One of "high", "medium", "low".')
