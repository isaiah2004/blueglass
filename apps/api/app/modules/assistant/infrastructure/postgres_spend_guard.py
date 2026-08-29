"""Postgres implementation of the SpendGuard port, backed by ai_spend_ledger.

Purpose
    The spend ceiling only holds under restarts and multiple API workers if
    "how much has been spent" is read from a shared, durable store rather
    than an in-process counter (see 0014_20260830_ai_spend_ledger.py). This
    is that store.

Dependencies
    The shared Database wrapper and the assistant domain's cost estimator.
"""

from __future__ import annotations

from ....infrastructure.db import Database

_REMAINING = """
    SELECT $1::numeric - COALESCE(SUM(cost_usd), 0) AS remaining
    FROM ai_spend_ledger
    WHERE task = $2
"""

_RECORD = """
    INSERT INTO ai_spend_ledger (task, model, input_tokens, output_tokens, cost_usd)
    VALUES ($1, $2, $3, $4, $5)
"""

#: One task name for every grounded-chat call. A future paid task (e.g. a
#: second assistant surface) would get its own name and its own ceiling,
#: rather than sharing this one's budget invisibly.
_TASK = "grounded_chat"


class PostgresSpendGuard:
    """Tracks OpenRouter spend for the Studio Assistant in `ai_spend_ledger`."""

    def __init__(self, database: Database, *, ceiling_usd: float) -> None:
        self._db = database
        self._ceiling_usd = ceiling_usd

    async def remaining_budget_usd(self) -> float:
        row = await self._db.fetchrow(_REMAINING, self._ceiling_usd, _TASK)
        assert row is not None
        return float(row["remaining"])

    async def record(
        self, *, model: str, input_tokens: int, output_tokens: int, cost_usd: float
    ) -> None:
        await self._db.execute(_RECORD, _TASK, model, input_tokens, output_tokens, cost_usd)
