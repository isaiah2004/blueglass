"""DEFECT 3, the half only a live database can prove.

The unit test in tests/unit/test_defect_3_relevance_scores.py pins the
arithmetic. These tests pin the two things that live in Postgres:

  1. the <=> operator really returns COSINE distance, so a known set of vectors
     comes back in the known order with the known scores;
  2. the HNSW index really is built with vector_cosine_ops. An index built with
     vector_l2_ops is not an error -- <=> would simply stop using it and fall
     back to a sequential scan, quietly, which is exactly the class of silent
     mismatch that produced the original defect.
"""

from __future__ import annotations

import asyncpg
import pytest

from app.modules.retrieval.domain import relevance_from_cosine_distance

pytestmark = pytest.mark.integration

_DIMENSIONS = 1536


def _vector(first: float, second: float) -> str:
    """A 1536-wide vector whose only non-zero components are the first two."""
    components = [first, second] + [0.0] * (_DIMENSIONS - 2)
    return "[" + ",".join(str(value) for value in components) + "]"


QUERY = _vector(1.0, 0.0)
DOCUMENTS: tuple[tuple[str, str], ...] = (
    ("identical", _vector(1.0, 0.0)),
    ("similar", _vector(0.6, 0.8)),
    ("orthogonal", _vector(0.0, 1.0)),
    ("opposite", _vector(-1.0, 0.0)),
)
EXPECTED_ORDER = ["identical", "similar", "orthogonal", "opposite"]


async def _seed(connection: asyncpg.Connection) -> None:
    for index, (name, vector) in enumerate(DOCUMENTS):
        await connection.execute(
            """
            INSERT INTO embeddings (kind, ref_key, chunk_index, content, embedding)
            VALUES ('test', $1, $2, $1, $3::vector)
            """,
            name,
            index,
            vector,
        )


async def test_cosine_distance_ranks_in_the_known_order(
    connection: asyncpg.Connection,
) -> None:
    await _seed(connection)

    rows = await connection.fetch(
        """
        SELECT ref_key, embedding <=> $1::vector AS distance
        FROM embeddings
        WHERE kind = 'test'
        ORDER BY embedding <=> $1::vector
        """,
        QUERY,
    )

    assert [row["ref_key"] for row in rows] == EXPECTED_ORDER


async def test_the_scores_match_the_arithmetic_the_domain_module_documents(
    connection: asyncpg.Connection,
) -> None:
    """The number the API reports, computed from the number Postgres returns."""
    await _seed(connection)

    rows = await connection.fetch(
        "SELECT ref_key, embedding <=> $1::vector AS distance "
        "FROM embeddings WHERE kind = 'test' ORDER BY embedding <=> $1::vector",
        QUERY,
    )
    scores = {
        row["ref_key"]: relevance_from_cosine_distance(float(row["distance"])) for row in rows
    }

    assert scores["identical"] == pytest.approx(1.0, abs=1e-6)
    assert scores["similar"] == pytest.approx(0.6, abs=1e-6)
    assert scores["orthogonal"] == pytest.approx(0.0, abs=1e-6)
    assert scores["opposite"] == pytest.approx(0.0, abs=1e-6)


async def test_the_l2_operator_ranks_a_perfect_match_last(
    connection: asyncpg.Connection,
) -> None:
    """The divergence, taken from Postgres rather than from arithmetic here.

    A vector pointing the same way as the query but three times as long is a
    PERFECT cosine match and the WORST L2 match. The prototype ordered by the
    L2 space while scoring as if cosine, so this is the shape of the answers it
    was giving.
    """
    await _seed(connection)
    await connection.execute(
        "INSERT INTO embeddings (kind, ref_key, chunk_index, content, embedding) "
        "VALUES ('test', 'scaled', 99, 'scaled', $1::vector)",
        _vector(3.0, 0.0),
    )

    by_cosine = await connection.fetch(
        "SELECT ref_key FROM embeddings WHERE kind = 'test' "
        "ORDER BY embedding <=> $1::vector, ref_key",
        QUERY,
    )
    by_l2 = await connection.fetch(
        "SELECT ref_key FROM embeddings WHERE kind = 'test' "
        "ORDER BY embedding <-> $1::vector, ref_key",
        QUERY,
    )

    cosine_order = [row["ref_key"] for row in by_cosine]
    l2_order = [row["ref_key"] for row in by_l2]

    assert cosine_order[:2] == ["identical", "scaled"]
    assert l2_order[-1] == "scaled"
    assert cosine_order != l2_order


async def test_the_index_is_built_for_cosine_not_l2(
    connection: asyncpg.Connection,
) -> None:
    """Read from the live catalog, because the migration file saying so is not
    the same as the database being so."""
    definition = await connection.fetchval(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'embeddings_hnsw_idx'"
    )

    assert definition is not None, "embeddings_hnsw_idx is missing"
    assert "vector_cosine_ops" in definition
    assert "vector_l2_ops" not in definition
