"""Who is making this request.

Purpose
    Decision A-01 is anonymous device id now, real accounts later. That is only
    safe if there is one seam the whole service resolves identity through, so a
    later swap to real auth changes one adapter and nothing else.

    The prototype had no such seam: every /me route read the module constant
    dev-user (server/app/routers/user.py line 15), so every device on earth
    shared one account. That constant does not exist anywhere in this service,
    and a test asserts it never comes back.

Key responsibilities
    - Model an identity as a subject plus the kind of credential that produced
      it, so a log line or a row can say which.
    - Validate a device id, because it becomes a primary key.

Dependencies
    Standard library plus the shared error vocabulary. No framework.

Usage
    identity = Identity.for_device("2f9c8a1e-...")
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from ....shared.errors import UnauthenticatedError

IdentityKind = Literal["device", "account"]

#: A device id is opaque to the server; it only has to be stable, unguessable
#: and safe to store. The bound rules out a header long enough to be an attack,
#: and the alphabet rules out anything that would need escaping in a log line.
_DEVICE_ID = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


@dataclass(frozen=True, slots=True)
class Identity:
    """The authenticated (or, for now, self-asserted) subject of a request."""

    subject: str
    kind: IdentityKind

    @staticmethod
    def for_device(device_id: str) -> Identity:
        """Build a device identity, validating the id.

        Raises UnauthenticatedError rather than ValidationError: from the
        caller's point of view a malformed device id is the same failure as
        sending none at all, and giving it a second code would let a client
        treat one as retryable and the other as fatal for no reason.
        """
        candidate = device_id.strip()
        if not _DEVICE_ID.match(candidate):
            raise UnauthenticatedError(
                "The device id must be 8-128 characters of A-Z, a-z, 0-9, dot, "
                "colon, underscore or hyphen.",
                code="invalid_device_id",
            )
        return Identity(subject=f"device:{candidate}", kind="device")
