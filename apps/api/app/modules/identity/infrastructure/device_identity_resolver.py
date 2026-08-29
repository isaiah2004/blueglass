"""Resolve an anonymous device identity from a request header.

Purpose
    The A-01 implementation: the client mints a stable random device id once,
    stores it, and sends it on every request. No account, no password, no
    server-side session -- and no shared constant.

    THIS IS THE ONLY PLACE THAT DECIDES WHO A REQUEST IS. Replacing it with a
    token-validating resolver is the whole of the work to add real accounts;
    see app/config/container.py, which is where the choice is made.

Security note
    A device id is an assertion, not proof. It scopes one reader's data away
    from another reader's on the same server, which is what A-01 asks for; it
    does not withstand a caller who guesses or copies somebody else's id. Real
    accounts (decision A-01, later) close that. Nothing that requires actual
    secrecy -- the end-to-end encrypted journal of J-01 -- may rely on this.

Dependencies
    The identity domain and the shared error vocabulary.

Usage
    resolver = DeviceIdentityResolver()
    identity = await resolver.resolve(request.headers)
"""

from __future__ import annotations

from collections.abc import Mapping

from ....shared.errors import UnauthenticatedError
from ..domain import Identity

#: The header the client sends. Named X-Atlas- rather than Authorization so that
#: adding a real bearer token later is additive, not a collision.
DEVICE_ID_HEADER = "X-Atlas-Device-Id"


class DeviceIdentityResolver:
    """Reads a device id header and turns it into an Identity."""

    def __init__(self, header_name: str = DEVICE_ID_HEADER) -> None:
        self._header_name = header_name

    async def resolve(self, headers: Mapping[str, str]) -> Identity:
        """Return the identity this request asserts.

        Raises UnauthenticatedError when the header is absent. There is
        deliberately no fallback subject: a fallback is exactly how the
        prototype ended up serving every device from one dev-user row.
        """
        raw = headers.get(self._header_name) or headers.get(self._header_name.lower())
        if not raw:
            raise UnauthenticatedError(
                f"This endpoint needs an identity. Send a {self._header_name} header.",
                details={"header": self._header_name},
            )
        return Identity.for_device(raw)
