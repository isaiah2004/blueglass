"""Call OpenRouter's chat completions endpoint. The Studio Assistant's one
paid, per-question vendor call.

Purpose
    docs/architecture/ai-model-strategy.md's Job 1 (`grounded_chat`): primary
    model `qwen/qwen3-235b-a22b-2507`, fallback `deepseek/deepseek-v4-flash`,
    both via OpenRouter's OpenAI-compatible `/chat/completions` endpoint. This
    is the one seam where that vendor is actually called, behind the
    `ChatCompletionClient` protocol every use case depends on.

Why a fallback model, tried in-process
    A single vendor outage or a primary model's rate limit should not surface
    as "the assistant is down" if a fallback can answer the same grounded
    prompt. The fallback is only tried if the primary call raises -- never
    used to second-guess a primary answer that came back fine.

Dependencies
    httpx, already pinned (see OpenAiEmbeddingClient). Reads keys/models from
    Settings, never os.environ directly.

Usage
    client = OpenRouterChatClient(
        api_key=settings.openrouter_api_key,
        model=settings.grounded_chat_model,
        fallback_model=settings.grounded_chat_fallback_model,
    )
    result = await client.complete(messages, max_tokens=500)
"""

from __future__ import annotations

from collections.abc import Sequence

import httpx

from ..application.ports import ChatCompletionResult
from ..domain import ChatMessage

_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


class ChatCompletionClientError(RuntimeError):
    """OpenRouter could not be reached, or its response had no usable shape."""


class OpenRouterChatClient:
    """`ChatCompletionClient`, implemented against OpenRouter's REST API.

    The key is checked in :meth:`complete`, not here -- mirroring
    `OpenAiEmbeddingClient`: this class is constructed unconditionally by the
    container at startup, and a missing key must not crash the process. It
    only becomes a real failure the moment a request actually tries to use it.
    """

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        fallback_model: str,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._fallback_model = fallback_model
        self._client = httpx.AsyncClient(
            base_url=_ENDPOINT,
            headers={"Authorization": "Bearer " + api_key} if api_key else {},
            timeout=timeout_seconds,
        )

    async def complete(
        self, messages: Sequence[ChatMessage], *, max_tokens: int
    ) -> ChatCompletionResult:
        """Complete a chat, trying the primary model then the fallback."""
        if not self._api_key:
            raise ChatCompletionClientError(
                "No OPENROUTER_API_KEY is configured. Set it before the "
                "Studio Assistant can answer -- see Settings.openrouter_api_key."
            )
        try:
            return await self._complete_with(self._model, messages, max_tokens=max_tokens)
        except ChatCompletionClientError:
            return await self._complete_with(
                self._fallback_model, messages, max_tokens=max_tokens
            )

    async def _complete_with(
        self, model: str, messages: Sequence[ChatMessage], *, max_tokens: int
    ) -> ChatCompletionResult:
        response = await self._client.post(
            "",
            json={
                "model": model,
                "max_tokens": max_tokens,
                "messages": [
                    {"role": message.role, "content": message.content} for message in messages
                ],
            },
        )
        if response.status_code != httpx.codes.OK:
            raise ChatCompletionClientError(
                f"OpenRouter chat request failed for {model}: "
                f"{response.status_code} {response.text}"
            )
        payload = response.json()
        try:
            text = payload["choices"][0]["message"]["content"]
            usage = payload["usage"]
            return ChatCompletionResult(
                text=text,
                model=model,
                input_tokens=usage["prompt_tokens"],
                output_tokens=usage["completion_tokens"],
            )
        except (KeyError, IndexError, TypeError) as error:
            raise ChatCompletionClientError(
                f"OpenRouter's response had an unexpected shape: {payload!r}"
            ) from error

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()
