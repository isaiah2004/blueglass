"""Unit tests for the assistant domain's pure logic: grounding, prompt,
pricing and citations. No network, no database.
"""

from __future__ import annotations

import pytest

from app.modules.assistant.domain import (
    Citation,
    UnknownModelPricingError,
    build_messages,
    estimate_cost_usd,
    grounding_confidence,
)
from app.modules.assistant.domain.prompt import NO_SOURCES_NOTE
from app.modules.retrieval.application import RetrievedChunk

# ── grounding_confidence ────────────────────────────────────────────────


def test_no_sources_is_always_low() -> None:
    assert grounding_confidence(top_score=0.99, source_count=0) == "low"


def test_a_strong_top_score_is_high() -> None:
    assert grounding_confidence(top_score=0.5, source_count=1) == "high"
    assert grounding_confidence(top_score=0.8, source_count=3) == "high"


def test_a_middling_top_score_is_medium() -> None:
    assert grounding_confidence(top_score=0.3, source_count=1) == "medium"
    assert grounding_confidence(top_score=0.49, source_count=1) == "medium"


def test_a_weak_top_score_is_low() -> None:
    assert grounding_confidence(top_score=0.29, source_count=2) == "low"
    assert grounding_confidence(top_score=0.0, source_count=1) == "low"


# ── build_messages ──────────────────────────────────────────────────────


def test_no_sources_says_so_in_the_prompt() -> None:
    messages = build_messages("What happened here?", [])
    assert messages[0].role == "system"
    assert messages[1].role == "user"
    assert NO_SOURCES_NOTE in messages[1].content
    assert "What happened here?" in messages[1].content


def test_sources_are_numbered_and_labelled() -> None:
    messages = build_messages(
        "Who is Lydia?",
        [("Acts 16:14", "A seller of purple."), ("Acts 16:15", "She was baptised.")],
    )
    user = messages[1].content
    assert "1. [Acts 16:14] A seller of purple." in user
    assert "2. [Acts 16:15] She was baptised." in user


def test_system_prompt_instructs_citation_and_refusal() -> None:
    messages = build_messages("Q", [])
    system = messages[0].content
    assert "ONLY the numbered sources" in system
    assert "say so plainly" in system


# ── estimate_cost_usd ───────────────────────────────────────────────────


def test_known_model_prices_correctly() -> None:
    cost = estimate_cost_usd(
        "qwen/qwen3-235b-a22b-2507", input_tokens=1_000_000, output_tokens=1_000_000
    )
    assert cost == pytest.approx(0.0875 + 0.3500)


def test_zero_tokens_cost_nothing() -> None:
    assert (
        estimate_cost_usd("qwen/qwen3-235b-a22b-2507", input_tokens=0, output_tokens=0) == 0.0
    )


def test_unknown_model_raises_rather_than_assuming_free() -> None:
    with pytest.raises(UnknownModelPricingError):
        estimate_cost_usd("made-up/model", input_tokens=10, output_tokens=10)


# ── Citation.from_chunk ─────────────────────────────────────────────────


def test_citation_labels_a_verse_reference() -> None:
    chunk = RetrievedChunk(
        kind="passage",
        ref_key="acts-16-11-15",
        chunk_index=0,
        content="Lydia's household.",
        verse_key=44016014,
        score=0.61,
    )
    citation = Citation.from_chunk(chunk)
    assert citation.label == "Acts 16:14"
    assert citation.ref_key == "acts-16-11-15"
    assert citation.score == 0.61


def test_citation_falls_back_to_ref_key_without_a_verse() -> None:
    chunk = RetrievedChunk(
        kind="passage",
        ref_key="acts-16-11-15",
        chunk_index=0,
        content="x",
        verse_key=None,
        score=0.2,
    )
    citation = Citation.from_chunk(chunk)
    assert citation.label == "acts-16-11-15"
