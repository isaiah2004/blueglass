"""Ports the Studio Assistant use case depends on."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from ..domain import ChatMessage


@dataclass(frozen=True, slots=True)
class ChatCompletionResult:
    """One chat-completion response, with the token counts the spend guard
    and pricing table need -- never estimated, always the vendor's own
    count."""

    text: str
    model: str
    input_tokens: int
    output_tokens: int


class ChatCompletionClient(Protocol):
    """A grounded-chat call. The one seam to the OpenRouter vendor."""

    async def complete(
        self, messages: Sequence[ChatMessage], *, max_tokens: int
    ) -> ChatCompletionResult:
        """Complete a chat, given its messages and a completion token cap."""
        ...


class SpendGuard(Protocol):
    """The backstop that keeps an automated loop from draining the key."""

    async def remaining_budget_usd(self) -> float:
        """How much of the configured ceiling is left, in USD.

        Zero or negative means: refuse the next call."""
        ...

    async def record(
        self, *, model: str, input_tokens: int, output_tokens: int, cost_usd: float
    ) -> None:
        """Log a completed call's real cost against the ledger."""
        ...
