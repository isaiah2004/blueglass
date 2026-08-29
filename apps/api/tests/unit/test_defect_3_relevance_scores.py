"""DEFECT 3 — RAG relevance scores were wrong.

Source of the defect
    A:/Work/spark/spark-app/server/app/rag/store.py asked Chroma for the
    cosine space at line 20, but the collection on disk was persisted with L2,
    and line 71 then computed:

        score = 1.0 - float(dist)

    Under L2 that formula is not approximately right, it is broken: L2 distance
    is unbounded, so a near-identical pair 1.4 apart scores -0.4 and sorts BELOW
    an unrelated pair at 0.9. Every relevance number the prototype reported --
    and therefore every source it chose to cite -- was suspect.

The fix, and what these tests hold in place
    The operator and the arithmetic are one decision, so they live in one
    module. These tests assert:
      1. the arithmetic, at every boundary;
      2. that a KNOWN RANKING comes out in the known order;
      3. that the SQL is built from the cosine operator constant, not a literal;
      4. that the L2 formula would have produced a different, wrong answer --
         so the test would fail if someone reintroduced it.

The live-index half of this (that the pgvector index really is built with
vector_cosine_ops) is asserted in tests/integration/test_pgvector_ranking.py.
"""

from __future__ import annotations

import math

import pytest

from app.modules.retrieval.domain import (
    COSINE_DISTANCE_OPERATOR,
    cosine_similarity_from_distance,
    relevance_from_cosine_distance,
    to_pgvector_literal,
)
from app.modules.retrieval.infrastructure import pgvector_embedding_repository as repo


def cosine_distance(left: list[float], right: list[float]) -> float:
    """The value pgvector's <=> operator returns, computed by hand."""
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    norm = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return 1.0 - dot / norm


#: A query and four documents whose true ordering is not in dispute.
QUERY = [1.0, 0.0, 0.0]
DOCUMENTS: dict[str, list[float]] = {
    "identical": [1.0, 0.0, 0.0],
    "similar": [0.6, 0.8, 0.0],
    "orthogonal": [0.0, 1.0, 0.0],
    "opposite": [-1.0, 0.0, 0.0],
}
EXPECTED_ORDER = ["identical", "similar", "orthogonal", "opposite"]


@pytest.mark.parametrize(
    ("distance", "expected"),
    [(0.0, 1.0), (0.5, 0.5), (1.0, 0.0), (2.0, -1.0)],
)
def test_cosine_similarity_at_the_boundaries(distance: float, expected: float) -> None:
    assert cosine_similarity_from_distance(distance) == pytest.approx(expected)


@pytest.mark.parametrize(
    ("distance", "expected"),
    [(0.0, 1.0), (0.25, 0.75), (1.0, 0.0), (1.5, 0.0), (2.0, 0.0)],
)
def test_relevance_is_clamped_into_the_unit_interval(distance: float, expected: float) -> None:
    """A negative similarity means "points the other way". There is no useful
    ordering below zero to show a reader, so it clamps."""
    assert relevance_from_cosine_distance(distance) == pytest.approx(expected)


def test_known_ranking_comes_out_in_the_known_order() -> None:
    """THE regression test. Score four documents against one query and assert
    the exact order and the exact scores."""
    scored = {
        name: relevance_from_cosine_distance(cosine_distance(QUERY, vector))
        for name, vector in DOCUMENTS.items()
    }
    ranked = sorted(scored, key=lambda name: scored[name], reverse=True)

    assert ranked == EXPECTED_ORDER
    assert scored["identical"] == pytest.approx(1.0)
    assert scored["similar"] == pytest.approx(0.6)
    assert scored["orthogonal"] == pytest.approx(0.0)
    assert scored["opposite"] == pytest.approx(0.0)


#: The same direction as the query, three times as long. Cosine calls this a
#: PERFECT match; L2 calls it the worst document in the set. Real embedding
#: pipelines produce vectors of varying magnitude whenever anything -- a model
#: swap, a truncated chunk, a missing normalisation step -- changes, which is
#: precisely how a space mismatch stops being theoretical.
SCALED = [3.0, 0.0, 0.0]


def l2_distance(left: list[float], right: list[float]) -> float:
    """Euclidean distance -- what the prototype's collection actually used."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right, strict=True)))


def test_cosine_treats_a_scaled_copy_as_a_perfect_match() -> None:
    assert cosine_distance(QUERY, SCALED) == pytest.approx(0.0, abs=1e-9)
    assert relevance_from_cosine_distance(cosine_distance(QUERY, SCALED)) == 1.0


def test_under_l2_the_prototype_would_rank_a_perfect_match_last() -> None:
    """THE demonstration that the defect was real, not pedantry.

    A document identical in meaning to the query sorts BELOW an orthogonal one
    under L2, and the prototype's 1.0 - distance scores it -1.0.
    """
    candidates = {"scaled_perfect_match": SCALED, "orthogonal": DOCUMENTS["orthogonal"]}
    by_l2 = sorted(candidates, key=lambda name: l2_distance(QUERY, candidates[name]))

    assert by_l2 == ["orthogonal", "scaled_perfect_match"]
    assert 1.0 - l2_distance(QUERY, SCALED) == pytest.approx(-1.0)


def test_the_prototypes_formula_produced_scores_outside_the_unit_interval() -> None:
    """Every score below is a number the prototype would have reported and no
    reader could have interpreted."""
    wrong = {name: 1.0 - l2_distance(QUERY, vector) for name, vector in DOCUMENTS.items()}

    assert wrong["orthogonal"] < 0.0
    assert wrong["opposite"] == pytest.approx(-1.0)
    assert min(wrong.values()) < 0.0


def test_the_query_is_built_from_the_cosine_operator_constant() -> None:
    """The operator and the formula must not be able to drift apart, so the SQL
    interpolates the same constant the score function is documented against."""
    assert COSINE_DISTANCE_OPERATOR == "<=>"
    assert repo._NEAREST.count(COSINE_DISTANCE_OPERATOR) == 2
    assert "<->" not in repo._NEAREST  # the L2 operator
    assert "<#>" not in repo._NEAREST  # the inner-product operator


def test_vector_literal_rendering() -> None:
    assert to_pgvector_literal([1.0, 0.5]) == "[1.0,0.5]"
    with pytest.raises(ValueError, match="must not be empty"):
        to_pgvector_literal([])
