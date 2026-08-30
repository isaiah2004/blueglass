"""Call OpenAI's embeddings endpoint. The one paid vendor call in this codebase.

Purpose
    Q-010's answer: pay OpenAI for `text-embedding-3-small` rather than
    self-host. This is the single seam where that happens -- one HTTP call,
    behind the `EmbeddingClient` protocol every other module depends on,
    never the concrete client.

Why httpx and not the `openai` SDK
    One JSON request, one JSON response. `httpx` is already a pinned
    dependency (the scripture loader uses it); adding the full SDK for one
    endpoint would be a second HTTP client in the image for no behaviour the
    first one lacks.

Dependencies
    httpx. Reads the key and model from Settings, never from os.environ
    directly, so a missing key fails at the one place settings.py already
    fails loudly for everything else.

Usage
    client = OpenAiEmbeddingClient(
        api_key=settings.openai_api_key, model=settings.embedding_model
    )
    vectors = await client.embed(["In the beginning..."])
"""

from __future__ import annotations

from collections.abc import Sequence

import httpx

_ENDPOINT = "https://api.openai.com/v1/embeddings"

#: OpenAI accepts up to 2048 inputs per request; well under that keeps one
#: retry cheap and one rate-limit response small enough to log in full.
MAX_BATCH_SIZE = 96


class EmbeddingClientError(RuntimeError):
    """The embeddings endpoint could not be reached or returned nonsense."""


class OpenAiEmbeddingClient:
    """`EmbeddingClient`, implemented against OpenAI's REST API.

    The key is checked in :meth:`embed`, not here: this class is constructed
    both by scripts.ingest_embeddings (where a missing key should fail
    immediately, and does -- embedding is that script's first move) and by
    the API container at startup (where a missing key must NOT crash the
    process; the Studio Assistant simply isn't usable yet until one is set).
    One check, at the one point both callers actually need the key, serves
    both without a second class.
    """

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float = 30.0) -> None:
        self._api_key = api_key
        self._model = model
        # Deliberately NOT base_url=_ENDPOINT with a later post(""). httpx joins an empty
        # path onto a base by appending a slash, producing "/v1/embeddings/", and OpenAI
        # rejects the trailing slash with "Invalid URL". base_url is for a prefix shared by
        # several paths; this client calls exactly one endpoint, so it posts the full URL.
        # Only a real call against the live API surfaces this -- every test double accepts
        # whatever URL it is handed.
        self._client = httpx.AsyncClient(
            headers={"Authorization": "Bearer " + api_key} if api_key else {},
            timeout=timeout_seconds,
        )

    async def embed(self, texts: Sequence[str]) -> Sequence[list[float]]:
        """One vector per text, batched under ``MAX_BATCH_SIZE`` per request."""
        if not self._api_key:
            raise EmbeddingClientError(
                "No OPENAI_API_KEY is configured. Set it before embedding -- "
                "see Settings.openai_api_key."
            )
        if not texts:
            return []
        vectors: list[list[float]] = []
        for start in range(0, len(texts), MAX_BATCH_SIZE):
            batch = texts[start : start + MAX_BATCH_SIZE]
            vectors.extend(await self._embed_batch(batch))
        return vectors

    async def _embed_batch(self, batch: Sequence[str]) -> list[list[float]]:
        response = await self._client.post(
            _ENDPOINT, json={"model": self._model, "input": list(batch)}
        )
        if response.status_code != httpx.codes.OK:
            raise EmbeddingClientError(
                f"OpenAI embeddings request failed: {response.status_code} {response.text}"
            )
        payload = response.json()
        try:
            rows = sorted(payload["data"], key=lambda row: row["index"])
            return [row["embedding"] for row in rows]
        except (KeyError, TypeError) as error:
            raise EmbeddingClientError(
                f"OpenAI's response had an unexpected shape: {payload!r}"
            ) from error

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()
