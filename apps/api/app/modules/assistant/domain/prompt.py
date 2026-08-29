"""Build the grounded-chat prompt. Pure text assembly, no I/O.

Purpose
    One place decides how retrieved chunks become a prompt, so the "answer
    only from these sources" contract is worded once and cannot drift between
    call sites. Kept pure and separate from the OpenRouter client so it is
    unit-testable without a network double.

Dependencies
    The Citation dataclass, for labels. No retrieval or infrastructure
    imports.

Usage
    messages = build_messages(question, [(citation.label, chunk_text), ...])
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

Role = Literal["system", "user"]

SYSTEM_PROMPT = (
    "You are the Studio Assistant, a study companion inside a Bible reading "
    "app. Answer the reader's question using ONLY the numbered sources "
    "below, which are excerpts of the passage they are reading. Cite sources "
    "by their bracketed label inline, e.g. [Acts 16:14]. If the sources do "
    "not contain enough to answer, say so plainly rather than guessing -- a "
    "wrong confident answer is worse than admitting the passage doesn't say. "
    "Keep the answer to a few sentences; this renders in a mobile sheet, not "
    "a page."
)

NO_SOURCES_NOTE = "(no sources were retrieved for this passage)"


@dataclass(frozen=True, slots=True)
class ChatMessage:
    """One turn in a chat-completion request."""

    role: Role
    content: str


def build_messages(question: str, sources: Sequence[tuple[str, str]]) -> list[ChatMessage]:
    """The system + user turns for one grounded-chat call.

    Args:
        question: the reader's verbatim question.
        sources: ``(label, content)`` pairs, in the order they were
            retrieved (most relevant first) -- e.g.
            ``[(citation.label, chunk.content) for citation, chunk in ...]``.
    """
    if sources:
        listing = "\n".join(
            f"{index + 1}. [{label}] {content}"
            for index, (label, content) in enumerate(sources)
        )
    else:
        listing = NO_SOURCES_NOTE
    user = f"Sources:\n{listing}\n\nQuestion: {question}"
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user),
    ]
