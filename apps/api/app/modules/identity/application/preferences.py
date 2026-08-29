"""Use cases: read and write a reader's preferences.

Purpose
    Ports endpoints 15 and 16 of the port map -- and fixes the asymmetry it
    records. The prototype returned the bare preference object from GET but
    demanded a wrapped one on PUT, so a client could not round-trip its own
    response. Both directions here are wrapped in a prefs key, which also leaves
    room to add metadata (an updated_at, a schema version) without breaking the
    body shape a second time.

Dependencies
    The identity ports and domain.

Usage
    prefs = await GetPreferences(repository)(identity)
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ..domain import Identity
from .ports import IdentityRepository


class GetPreferences:
    """Read the stored preferences for an identity."""

    def __init__(self, repository: IdentityRepository) -> None:
        self._repository = repository

    async def __call__(self, identity: Identity) -> dict[str, Any]:
        return await self._repository.get_preferences(identity)


class SetPreferences:
    """Replace the stored preferences for an identity."""

    def __init__(self, repository: IdentityRepository) -> None:
        self._repository = repository

    async def __call__(
        self, identity: Identity, preferences: Mapping[str, Any]
    ) -> dict[str, Any]:
        await self._repository.ensure(identity)
        return await self._repository.set_preferences(identity, preferences)
