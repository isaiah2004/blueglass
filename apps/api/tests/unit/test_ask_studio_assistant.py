"""Unit tests for AskStudioAssistant: the use case wiring, with fakes.

No network, no database -- these exercise the orchestration (spend-guard
check before the vendor call, citations built from what was retrieved, not
from the model's text, confidence from the retrieval) against small,
in-file fakes of the four ports it depends on.
"""

from __future__ import annotations

from collections.abc import Sequence

import pytest

from app.modules.assistant.application import AskStudioAssistant, ChatCompletionResult
from app.modules.retrieval.application import RetrievedChunk
from app.shared.errors import DependencyUnavailableError

_MODEL = "qwen/qwen3-235b-a22b-2507"


class _FakeEmbeddingClient:
    """Returns a fixed vector for any text, one per input."""

    async def embed(self, texts: Sequence[str]) -> Sequence[list[float]]:
        return [[0.1, 0.2, 0.3] for _ in texts]


class _FakeEmbeddingRepository:
    """Serves a canned set of chunks regardless of the query vector."""

    def __init__(self, chunks: Sequence[RetrievedChunk]) -> None:
        self._chunks = chunks

    async def nearest(
        self, *, embedding: list[float], limit: int, kinds: Sequence[str] | None = None
    ) -> Sequence[RetrievedChunk]:
        return list(self._chunks[:limit])


class _FakeChatClient:
    """Echoes back a canned answer and records the messages it was given."""

    def __init__(self, *, text: str = "Lydia was a seller of purple.") -> None:
        self.text = text
        self.received_messages = None

    async def complete(self, messages, *, max_tokens: int) -> ChatCompletionResult:
        self.received_messages = messages
        return ChatCompletionResult(
            text=self.text, model=_MODEL, input_tokens=100, output_tokens=40
        )


class _FakeSpendGuard:
    """An in-memory ledger: starts with a budget, records every call."""

    def __init__(self, *, remaining_usd: float = 4.50) -> None:
        self.remaining_usd = remaining_usd
        self.recorded: list[tuple[str, int, int, float]] = []

    async def remaining_budget_usd(self) -> float:
        return self.remaining_usd

    async def record(
        self, *, model: str, input_tokens: int, output_tokens: int, cost_usd: float
    ) -> None:
        self.recorded.append((model, input_tokens, output_tokens, cost_usd))
        self.remaining_usd -= cost_usd


def _chunk(score: float, verse_key: int = 44016014) -> RetrievedChunk:
    return RetrievedChunk(
        kind="passage",
        ref_key="acts-16-11-15",
        chunk_index=0,
        content="Lydia, a seller of purple, was baptised with her household.",
        verse_key=verse_key,
        score=score,
    )


def _assistant(
    chunks: Sequence[RetrievedChunk], *, chat_client=None, spend_guard=None
) -> tuple[AskStudioAssistant, _FakeChatClient, _FakeSpendGuard]:
    chat = chat_client or _FakeChatClient()
    guard = spend_guard or _FakeSpendGuard()
    assistant = AskStudioAssistant(
        embedding_client=_FakeEmbeddingClient(),
        embedding_repository=_FakeEmbeddingRepository(chunks),
        chat_client=chat,
        spend_guard=guard,
        model=_MODEL,
        max_tokens=1200,
    )
    return assistant, chat, guard


@pytest.mark.asyncio
async def test_answers_with_citations_from_the_retrieved_chunks() -> None:
    assistant, _, _ = _assistant([_chunk(0.61)])
    answer = await assistant.ask(question="Who is Lydia?")
    assert answer.text == "Lydia was a seller of purple."
    assert len(answer.citations) == 1
    assert answer.citations[0].label == "Acts 16:14"
    assert answer.confidence == "high"


@pytest.mark.asyncio
async def test_no_retrieved_chunks_is_low_confidence_but_still_answers() -> None:
    assistant, _, _ = _assistant([])
    answer = await assistant.ask(question="Who is Lydia?")
    assert answer.citations == []
    assert answer.confidence == "low"


@pytest.mark.asyncio
async def test_the_prompt_carries_the_retrieved_chunks_labelled() -> None:
    assistant, chat, _ = _assistant([_chunk(0.61)])
    await assistant.ask(question="Who is Lydia?")
    user_message = chat.received_messages[1]
    assert "[Acts 16:14]" in user_message.content
    assert "Who is Lydia?" in user_message.content


@pytest.mark.asyncio
async def test_a_successful_call_is_recorded_against_the_spend_guard() -> None:
    assistant, _, guard = _assistant([_chunk(0.61)])
    await assistant.ask(question="Who is Lydia?")
    assert len(guard.recorded) == 1
    model, input_tokens, output_tokens, cost_usd = guard.recorded[0]
    assert model == _MODEL
    assert input_tokens == 100
    assert output_tokens == 40
    assert cost_usd > 0


@pytest.mark.asyncio
async def test_an_exhausted_spend_guard_refuses_before_calling_the_model() -> None:
    chat = _FakeChatClient()
    assistant, _, _ = _assistant(
        [_chunk(0.61)], chat_client=chat, spend_guard=_FakeSpendGuard(remaining_usd=0.0)
    )
    with pytest.raises(DependencyUnavailableError) as excinfo:
        await assistant.ask(question="Who is Lydia?")
    assert excinfo.value.code == "assistant_spend_ceiling_reached"
    assert chat.received_messages is None  # the vendor was never called


class _BrokenEmbeddingClient:
    """Simulates a real adapter's own error -- e.g. a missing API key."""

    async def embed(self, texts: Sequence[str]) -> Sequence[list[float]]:
        raise RuntimeError("No OPENAI_API_KEY is configured.")


@pytest.mark.asyncio
async def test_an_embedding_failure_becomes_a_dependency_unavailable_error() -> None:
    assistant = AskStudioAssistant(
        embedding_client=_BrokenEmbeddingClient(),
        embedding_repository=_FakeEmbeddingRepository([]),
        chat_client=_FakeChatClient(),
        spend_guard=_FakeSpendGuard(),
        model=_MODEL,
        max_tokens=1200,
    )
    with pytest.raises(DependencyUnavailableError) as excinfo:
        await assistant.ask(question="Who is Lydia?")
    assert excinfo.value.code == "assistant_retrieval_unavailable"


class _BrokenChatClient:
    """Simulates a real chat adapter's own error -- e.g. an unreachable vendor."""

    async def complete(self, messages, *, max_tokens: int) -> ChatCompletionResult:
        raise RuntimeError("OpenRouter chat request failed: 503")


@pytest.mark.asyncio
async def test_a_chat_failure_becomes_a_dependency_unavailable_error() -> None:
    assistant, _, guard = _assistant([_chunk(0.61)], chat_client=_BrokenChatClient())
    with pytest.raises(DependencyUnavailableError) as excinfo:
        await assistant.ask(question="Who is Lydia?")
    assert excinfo.value.code == "assistant_chat_unavailable"
    assert guard.recorded == []  # a failed call is never billed
