"""Postgres implementation of the IdentityRepository port.

Purpose
    Persist identities and their preferences, keyed on the identity subject
    rather than on a hardcoded user id.

Dependencies
    The shared Database wrapper and the identity domain.

Usage
    repository = PostgresIdentityRepository(database)
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ....infrastructure.db import Database
from ..domain import Identity

_ENSURE_IDENTITY = """
    INSERT INTO identities (subject, kind)
    VALUES ($1, $2)
    ON CONFLICT (subject) DO UPDATE SET last_seen_at = now()
"""

_GET_PREFERENCES = """
    SELECT preferences FROM identity_preferences WHERE subject = $1
"""

_SET_PREFERENCES = """
    INSERT INTO identity_preferences (subject, preferences)
    VALUES ($1, $2)
    ON CONFLICT (subject)
    DO UPDATE SET preferences = $2, updated_at = now()
    RETURNING preferences
"""


class PostgresIdentityRepository:
    """Stores identities and preferences in Postgres."""

    def __init__(self, database: Database) -> None:
        self._db = database

    async def ensure(self, identity: Identity) -> None:
        await self._db.execute(_ENSURE_IDENTITY, identity.subject, identity.kind)

    async def get_preferences(self, identity: Identity) -> dict[str, Any]:
        row = await self._db.fetchrow(_GET_PREFERENCES, identity.subject)
        return dict(row["preferences"]) if row else {}

    async def set_preferences(
        self, identity: Identity, preferences: Mapping[str, Any]
    ) -> dict[str, Any]:
        row = await self._db.fetchrow(_SET_PREFERENCES, identity.subject, dict(preferences))
        assert row is not None
        return dict(row["preferences"])
