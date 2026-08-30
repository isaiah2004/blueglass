"""ai_spend_ledger: the Studio Assistant's hard spend guard, made durable.

Purpose
    ai-model-strategy.md's cost architecture requires that "an automated
    test loop cannot drain the key." An in-process counter would reset on
    every restart and would not be shared across workers; a durable ledger
    that every AskStudioAssistant call reads before spending and writes after
    is the only version of that requirement that actually holds under
    restarts and multiple workers.

Shape decisions
    - One row per completed call, not a running total column: an
      append-only log can be summed (`SUM(cost_usd)`) and audited row by
      row, where a single mutable counter can silently drift from reality if
      any write is ever lost or double-applied.
    - `cost_usd numeric(10,6)` -- token-level pricing (see
      app/modules/assistant/domain/pricing.py) produces sub-cent amounts;
      `numeric`, not `float`, so a very long tail of many small answers
      cannot accumulate float rounding error against a real dollar ceiling.
    - No foreign keys: this table logs vendor spend, not app data, and has
      no natural relationship to any other row in the schema.

Revision ID: 0014_ai_spend_ledger
Revises: 0013_dictionary_entries
Created: 2026-08-30
"""

from __future__ import annotations

from alembic import op

revision = "0014_ai_spend_ledger"
down_revision = "0013_dictionary_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ai_spend_ledger (
            id             bigserial PRIMARY KEY,
            task           varchar(32) NOT NULL,
            model          text NOT NULL,
            input_tokens   int NOT NULL CHECK (input_tokens >= 0),
            output_tokens  int NOT NULL CHECK (output_tokens >= 0),
            cost_usd       numeric(10, 6) NOT NULL CHECK (cost_usd >= 0),
            created_at     timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    # The guard's one read is "how much has this task spent, ever" -- an
    # index on task makes that SUM an index-only scan instead of a full
    # table scan once the ledger has any real history.
    op.execute("CREATE INDEX ai_spend_ledger_task_idx ON ai_spend_ledger (task)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_spend_ledger")
