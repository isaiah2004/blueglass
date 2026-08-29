"""Ports the identity module depends on.

Purpose
    IdentityResolver is THE seam. Today one adapter reads a device-id header.
    When real accounts arrive, a second adapter validates a bearer token and the
    container picks it -- no route, use case, or repository changes.

Dependencies
    typing.Protocol and the identity domain.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from ..domain import Identity


class IdentityResolver(Protocol):
    """Turns the credentials on a request into an Identity."""

    async def resolve(self, headers: Mapping[str, str]) -> Identity:
        """Return the request's identity, or raise UnauthenticatedError."""
        ...


class IdentityRepository(Protocol):
    """Persistence for identities and the preferences attached to them."""

    async def ensure(self, identity: Identity) -> None:
        """Record the identity if it is new. Idempotent."""
        ...

    async def get_preferences(self, identity: Identity) -> dict[str, Any]:
        """The stored preference object, or an empty one."""
        ...

    async def set_preferences(
        self, identity: Identity, preferences: Mapping[str, Any]
    ) -> dict[str, Any]:
        """Replace the stored preference object and return what was stored."""
        ...
