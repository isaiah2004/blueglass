"""Grounding confidence: the one number that gates every Studio answer.

Purpose
    `design-language.md` non-negotiable 3: every AI claim carries a visible
    source chip, and the sheet's Grounding Confidence meter must say plainly
    when an answer is weakly grounded. This module is where that judgement is
    made -- from the retrieved chunks' own relevance scores, never from the
    model's own claimed certainty, which it cannot be trusted to grade itself.

The rule
    No sources at all is always `low`, regardless of anything else -- an
    answer built on nothing is exactly the shaky case the meter exists to
    flag. Otherwise, the *best* retrieved chunk's relevance score decides:
    one strongly relevant passage justifies an answer even if the rest of the
    field is weak. There is no published numeric standard for pgvector cosine
    relevance (`ai-model-strategy.md` recommends models but not a threshold),
    so these cuts are this codebase's own decision, documented here rather
    than buried in a call site, so a future re-tuning has one place to look.

Dependencies
    None. Pure.

Usage
    confidence = grounding_confidence(top_score=0.61, source_count=3)
"""

from __future__ import annotations

from typing import Literal

GroundingConfidence = Literal["low", "medium", "high"]

#: Below this, a retrieved chunk is treated as noise -- semantically closer to
#: unrelated than related. Chosen conservatively: text-embedding-3-small's
#: cosine similarities for genuinely related passages typically sit above
#: this even when the wording differs a great deal.
_LOW_THRESHOLD = 0.30

#: At or above this, the best chunk is a strong, specific match, not just a
#: same-topic passage.
_HIGH_THRESHOLD = 0.50


def grounding_confidence(*, top_score: float, source_count: int) -> GroundingConfidence:
    """How much to trust an answer built from these retrieved chunks.

    Args:
        top_score: the highest relevance score among the chunks retrieved
            (`RetrievedChunk.score`, already in [0, 1]).
        source_count: how many chunks were retrieved at all.
    """
    if source_count == 0:
        return "low"
    if top_score >= _HIGH_THRESHOLD:
        return "high"
    if top_score >= _LOW_THRESHOLD:
        return "medium"
    return "low"
