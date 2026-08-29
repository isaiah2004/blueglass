"""Public API of the retrieval domain."""

from .similarity import (
    COSINE_DISTANCE_OPERATOR,
    COSINE_INDEX_OPCLASS,
    cosine_similarity_from_distance,
    relevance_from_cosine_distance,
    to_pgvector_literal,
)

__all__ = [
    "COSINE_DISTANCE_OPERATOR",
    "COSINE_INDEX_OPCLASS",
    "cosine_similarity_from_distance",
    "relevance_from_cosine_distance",
    "to_pgvector_literal",
]
