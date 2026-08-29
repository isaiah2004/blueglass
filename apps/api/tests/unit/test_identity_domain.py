"""The Identity value object and the header resolver."""

from __future__ import annotations

import pytest

from app.modules.identity.domain import Identity
from app.modules.identity.infrastructure import DEVICE_ID_HEADER, DeviceIdentityResolver
from app.shared.errors import UnauthenticatedError


def test_a_device_identity_is_namespaced() -> None:
    """The namespace is what lets account subjects coexist later without a
    device id ever colliding with an account id."""
    identity = Identity.for_device("abcdefgh1234")

    assert identity.subject == "device:abcdefgh1234"
    assert identity.kind == "device"


@pytest.mark.parametrize(
    "device_id", ["short", "", "  ", "has space", "x" * 129, "sql'injection", "a\nb"]
)
def test_a_malformed_device_id_is_rejected(device_id: str) -> None:
    with pytest.raises(UnauthenticatedError) as raised:
        Identity.for_device(device_id)

    assert raised.value.code == "invalid_device_id"


async def test_the_resolver_reads_the_header() -> None:
    identity = await DeviceIdentityResolver().resolve({DEVICE_ID_HEADER: "device-abcdefgh"})

    assert identity.subject == "device:device-abcdefgh"


async def test_the_resolver_accepts_a_lowercased_header_name() -> None:
    """Plain dicts are used in tests; real HTTP headers are case-insensitive."""
    identity = await DeviceIdentityResolver().resolve(
        {DEVICE_ID_HEADER.lower(): "device-abcdefgh"}
    )

    assert identity.kind == "device"


async def test_a_missing_header_raises_rather_than_defaulting() -> None:
    """No fallback subject. A fallback is precisely how the prototype ended up
    serving every device from one dev-user row."""
    with pytest.raises(UnauthenticatedError) as raised:
        await DeviceIdentityResolver().resolve({})

    assert raised.value.code == "identity_required"
    assert raised.value.details["header"] == DEVICE_ID_HEADER
