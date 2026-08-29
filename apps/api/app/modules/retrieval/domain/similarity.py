"""Distance-to-relevance maths, and the reason it has its own module.

THE DEFECT THIS EXISTS TO PREVENT
    The prototype persisted its Chroma collection with the L2 (Euclidean) space
    while server/app/rag/store.py line 71 computed score = 1.0 - distance, the
    formula for COSINE distance. Under L2 that formula is not merely imprecise,
    it is unbounded and inverted in sign for any distance above 1: two nearly
    identical vectors 1.4 apart score -0.4, ranking below an unrelated pair at
    0.9. Every relevance number the prototype reported was wrong.

    The lesson is that the operator and the arithmetic are ONE decision. They
    are therefore expressed together, in one place, with the operator named as a
    constant that the SQL is built from. You cannot change one without seeing
    the other.

THE CONTRACT
    - Vectors are stored normalised or not; cosine distance does not care.
    - pgvector's <=> operator returns COSINE DISTANCE in [0, 2]:
        0 identical direction, 1 orthogonal, 2 opposite.
    - cosine similarity  = 1 - distance, in [-1, 1].
    - relevance          = similarity clamped to [0, 1], because a negative
                           similarity means "points the other way", and there is
                           no useful ordering below zero to show a reader.

Dependencies
    Standard library only. Pure functions, exhaustively unit tested.

Usage
    score = relevance_from_cosine_distance(0.25)   # 0.75
"""

from __future__ import annotations

from typing import Final

#: The pgvector operator this module's arithmetic is valid for. The SQL that
#: queries the embeddings table is built from this constant, so the operator and
#: the formula below can never drift apart.
COSINE_DISTANCE_OPERATOR: Final[str] = "<=>"

#: The index opclass that must back the embedding column for the operator above
#: to use an index. Asserted by a migration test.
COSINE_INDEX_OPCLASS: Final[str] = "vector_cosine_ops"

_MIN_COSINE_DISTANCE: Final[float] = 0.0
_MAX_COSINE_DISTANCE: Final[float] = 2.0


def cosine_similarity_from_distance(distance: float) -> float:
    """Convert a pgvector cosine distance into a cosine similarity in [-1, 1].

    Distances outside the theoretical [0, 2] range can only come from floating
    point noise at the endpoints, so they are clamped rather than rejected.
    """
    clamped = min(max(distance, _MIN_COSINE_DISTANCE), _MAX_COSINE_DISTANCE)
    return 1.0 - clamped


def relevance_from_cosine_distance(distance: float) -> float:
    """Convert a cosine distance into a relevance score in [0, 1].

    Monotonically decreasing in distance, so sorting by ascending distance and
    sorting by descending relevance give the same order -- which is why the SQL
    can order by the operator and let this function decorate the rows.
    """
    return max(cosine_similarity_from_distance(distance), 0.0)


def to_pgvector_literal(vector: list[float]) -> str:
    """Render a vector for a query parameter, e.g. "[0.1,0.2]".

    asyncpg has no built-in codec for pgvector's type, so the value crosses as
    text and the SQL casts it. Rendering happens here so no call site has to
    remember the format.
    """
    if not vector:
        raise ValueError("An embedding vector must not be empty.")
    return "[" + ",".join(repr(float(component)) for component in vector) + "]"
