"""Retrieval embeddings, on pgvector, with the COSINE opclass.

Defect 3 (DECISIONS.md section 4): the prototype's Chroma collection was
persisted with the L2 space while the code computed 1.0 - distance as if the
distance were cosine, so every relevance score it reported was wrong.

The fix has two halves and both live here or next to each other:

  * this index is built with vector_cosine_ops, so the <=> operator can use it;
  * app/modules/retrieval/domain/similarity.py owns the arithmetic and names the
    operator as the constant the query is built from.

An index built with vector_l2_ops would NOT be an error -- <=> would simply stop
using it and fall back to a sequential scan, quietly. That is why the opclass is
asserted by a test against the live catalog rather than merely written here.

Vector width is 1536: text-embedding-3-small, decision Q-010.

Revision ID: 0003
Revises: 0002
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

EMBEDDING_DIMENSIONS = 1536


def upgrade() -> None:
    op.execute(
        f"""
        CREATE TABLE embeddings (
            id          bigserial PRIMARY KEY,
            kind        varchar(24) NOT NULL,
            ref_key     text NOT NULL,
            verse_key   int,
            chunk_index smallint NOT NULL DEFAULT 0,
            content     text NOT NULL,
            embedding   vector({EMBEDDING_DIMENSIONS}) NOT NULL,
            source_id   int REFERENCES data_sources(id),
            created_at  timestamptz NOT NULL DEFAULT now(),
            UNIQUE (kind, ref_key, chunk_index)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX embeddings_hnsw_idx ON embeddings
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """
    )
    op.execute("CREATE INDEX embeddings_verse_idx ON embeddings (verse_key)")
    op.execute("CREATE INDEX embeddings_kind_idx ON embeddings (kind)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS embeddings")
