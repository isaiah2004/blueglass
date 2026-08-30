"""AskStudioAssistant: the M6 use case -- one grounded question, one answer.

Purpose
    Compose the seams the presentation layer needs into one call: embed the
    question, retrieve the passage's nearest chunks, ask the chat model to
    answer ONLY from them, price and log what that cost, and grade the
    result's confidence from the retrieval itself. Nothing here talks HTTP or
    SQL; those live in presentation/ and infrastructure/.

Key responsibilities
    - Refuse before spending: check the spend guard first, so a request that
      would blow the ceiling never reaches the vendor at all.
    - Build citations from the exact chunks placed in the prompt -- never
      from the model's own text -- so a citation cannot misdescribe what
      grounded it.

Dependencies
    The retrieval module's EmbeddingClient/EmbeddingRepository ports (reused,
    not reimplemented) and this module's own ChatCompletionClient/SpendGuard
    ports.

Usage
    answer = await ask_studio_assistant.ask(question="Who is Lydia?")
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from ....shared.errors import DependencyUnavailableError
from ...retrieval.application import EmbeddingClient, EmbeddingRepository
from ..domain import (
    AssistantAnswer,
    Citation,
    build_messages,
    estimate_cost_usd,
    grounding_confidence,
)
from .ports import ChatCompletionClient, SpendGuard

#: Retrieval is scoped to the ingested kind: scripture passages, per M3's
#: ingest_embeddings.py. A future kind (e.g. dictionary entries) widens this
#: tuple, not this use case's shape.
DEFAULT_KINDS: tuple[str, ...] = ("passage",)

#: How many retrieved chunks to place in the prompt. Small on purpose: more
#: sources means more input tokens billed per question for chunks unlikely to
#: rank above the top few in an Acts-scoped index.
DEFAULT_SOURCE_LIMIT = 5


@dataclass
class AskStudioAssistant:
    """The Studio Assistant's one use case: ask, and get a cited answer."""

    embedding_client: EmbeddingClient
    embedding_repository: EmbeddingRepository
    chat_client: ChatCompletionClient
    spend_guard: SpendGuard
    model: str
    max_tokens: int
    source_limit: int = DEFAULT_SOURCE_LIMIT
    kinds: Sequence[str] = DEFAULT_KINDS

    async def ask(self, *, question: str) -> AssistantAnswer:
        """Answer one question, grounded in the passage's nearest chunks."""
        remaining = await self.spend_guard.remaining_budget_usd()
        if remaining <= 0:
            raise DependencyUnavailableError(
                "The Studio Assistant's spend ceiling has been reached. A "
                "product owner must raise openrouter_spend_ceiling_usd "
                "before it can answer again.",
                code="assistant_spend_ceiling_reached",
            )

        try:
            [query_vector] = await self.embedding_client.embed([question])
            chunks = await self.embedding_repository.nearest(
                embedding=list(query_vector), limit=self.source_limit, kinds=self.kinds
            )
        except Exception as error:
            # Both concrete adapters (OpenAiEmbeddingClient, PgVectorEmbeddingRepository)
            # raise their own module-specific errors -- an unconfigured key, an
            # unreachable vendor, a database that dropped its connection. This
            # use case does not import those infrastructure classes (that would
            # cross the application/infrastructure boundary the wrong way); it
            # treats any failure retrieving context as the one thing the client
            # actually needs to know: retrieval is not usable right now.
            raise DependencyUnavailableError(
                f"Could not retrieve grounding context: {error}",
                code="assistant_retrieval_unavailable",
            ) from error

        citations = [Citation.from_chunk(chunk) for chunk in chunks]
        messages = build_messages(
            question,
            [
                (citation.label, chunk.content)
                for citation, chunk in zip(citations, chunks, strict=True)
            ],
        )

        try:
            result = await self.chat_client.complete(messages, max_tokens=self.max_tokens)
        except Exception as error:
            raise DependencyUnavailableError(
                f"Could not reach the grounded-chat vendor: {error}",
                code="assistant_chat_unavailable",
            ) from error
        cost_usd = estimate_cost_usd(
            result.model, input_tokens=result.input_tokens, output_tokens=result.output_tokens
        )
        await self.spend_guard.record(
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=cost_usd,
        )

        top_score = max((citation.score for citation in citations), default=0.0)
        confidence = grounding_confidence(top_score=top_score, source_count=len(citations))
        return AssistantAnswer(text=result.text, citations=citations, confidence=confidence)
