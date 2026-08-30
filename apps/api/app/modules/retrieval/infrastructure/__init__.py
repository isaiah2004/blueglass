"""Retrieval infrastructure: the pgvector adapter and the OpenAI client."""

from .openai_embedding_client import EmbeddingClientError, OpenAiEmbeddingClient
from .pgvector_embedding_repository import PgVectorEmbeddingRepository

__all__ = ["EmbeddingClientError", "OpenAiEmbeddingClient", "PgVectorEmbeddingRepository"]
