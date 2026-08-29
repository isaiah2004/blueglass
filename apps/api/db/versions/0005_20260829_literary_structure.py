"""Structure badge: literary structures and their labelled nodes.

Hajime Murai's *Literary Structure of the Bible* (CC BY 4.0) supplies 1,959
pericopes and just over ten thousand labelled chiastic nodes for the whole
canon. The pericope boundaries land in the existing `passages` table under
scheme 'murai'; the structures themselves land here.

Decision Q-015 -- ship it, attributed inline as "Murai's reading" -- is
enforced as data rather than as a note to whoever writes the UI. Every
structure row carries attributed_to, claim_label and claim_type, all NOT NULL
and all non-blank by CHECK. claim_type is constrained to a small vocabulary in
which 'interpretive' is the only value this ingest writes: chiastic structure
is one scholar's analysis, and a row that could be rendered as settled fact
must not be expressible.

Decision AI-05 -- every claim carries a source anchor -- is enforced by a NOT
NULL source_id, so a structure with no provenance cannot exist and therefore
cannot render.

Revision ID: 0005_structure
Revises: 0004_history
Created: 2026-08-29
"""

from __future__ import annotations

from alembic import op

revision = "0005_structure"
down_revision = "0004_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _create_literary_structures()
    _create_structure_nodes()


def _create_literary_structures() -> None:
    """One analysis of one passage, by one named scholar.

    UNIQUE (passage_id, source_id) rather than a bare primary key on
    passage_id: chiasm is contested, and the schema should let a second
    scholar's reading of the same passage sit beside the first rather than
    overwrite it.
    """
    op.execute(
        """
        CREATE TABLE literary_structures (
            id            serial PRIMARY KEY,
            passage_id    varchar(48) NOT NULL
                              REFERENCES passages(passage_id) ON DELETE CASCADE,
            pattern       varchar(16) NOT NULL,
            centre_label  varchar(16),
            legend        text,
            attributed_to text NOT NULL,
            claim_label   text NOT NULL,
            claim_type    varchar(16) NOT NULL DEFAULT 'interpretive',
            source_id     int NOT NULL REFERENCES data_sources(id),
            CONSTRAINT literary_structures_one_per_source
                UNIQUE (passage_id, source_id),
            CONSTRAINT literary_structures_pattern_known
                CHECK (pattern IN ('chiasm', 'parallel', 'sequence', 'other')),
            CONSTRAINT literary_structures_claim_known
                CHECK (claim_type IN ('interpretive', 'attested')),
            CONSTRAINT literary_structures_attributed
                CHECK (btrim(attributed_to) <> '' AND btrim(claim_label) <> '')
        )
        """
    )
    op.execute(
        "CREATE INDEX literary_structures_passage_idx ON literary_structures (passage_id)"
    )


def _create_structure_nodes() -> None:
    """The ordered limbs of one structure: A, B, C, D, C', B', A'.

    pair_label is stored rather than derived so the client can draw the pairing
    without parsing prime marks, and the range index answers "which limb is
    this verse in?" in one lookup -- the query the inline badge makes.
    """
    op.execute(
        """
        CREATE TABLE structure_nodes (
            id           bigserial PRIMARY KEY,
            structure_id int NOT NULL
                             REFERENCES literary_structures(id) ON DELETE CASCADE,
            node_index   smallint NOT NULL,
            label        varchar(16) NOT NULL,
            pair_label   varchar(16) NOT NULL,
            is_centre    boolean NOT NULL DEFAULT false,
            start_key    int NOT NULL,
            end_key      int NOT NULL,
            summary      text,
            catchword    text,
            CONSTRAINT structure_nodes_ordered UNIQUE (structure_id, node_index),
            CONSTRAINT structure_nodes_in_order CHECK (end_key >= start_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX structure_nodes_range_idx ON structure_nodes
            USING gist (int4range(start_key, end_key, '[]'))
        """
    )
    op.execute("CREATE INDEX structure_nodes_structure_idx ON structure_nodes (structure_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS structure_nodes")
    op.execute("DROP TABLE IF EXISTS literary_structures")
