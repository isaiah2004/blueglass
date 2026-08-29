"""HTTP routes for identity and reader preferences.

Purpose
    Prove the identity seam works end to end, and port endpoints 4, 15 and 16 of
    the port map.

The asymmetry this fixes
    The prototype returned the bare preference object from GET /me/prefs but
    required it wrapped in a prefs key on PUT (flutter-port-map.md section 5,
    endpoints 15 and 16), so a client could not send back what it had just
    received. Both directions here are wrapped.

Routes
    GET  /me            who the caller is, as the server sees them
    GET  /me/prefs      wrapped preference object
    PUT  /me/prefs      wrapped preference object, returns what was stored

Every route here requires an identity. There is no anonymous fallback.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ....presentation_dependencies import ContainerDep, CurrentIdentity

router = APIRouter(prefix="/me", tags=["identity"])

_UNAUTHENTICATED = {401: {"description": "identity_required, or invalid_device_id"}}


class IdentityOut(BaseModel):
    """GET /me."""

    subject: str = Field(description="Opaque, stable id for this caller.")
    kind: str = Field(description="device today; account once real auth lands.")


class PreferencesBody(BaseModel):
    """The wrapped preference object, used by BOTH directions."""

    prefs: dict[str, Any] = Field(
        default_factory=dict,
        description="Free-form client preferences, e.g. rag, web, verseSize.",
    )


@router.get("", response_model=IdentityOut, responses=_UNAUTHENTICATED)
async def me(identity: CurrentIdentity) -> IdentityOut:
    """Echo the resolved identity, so a client can confirm its device id took."""
    return IdentityOut(subject=identity.subject, kind=identity.kind)


@router.get("/prefs", response_model=PreferencesBody, responses=_UNAUTHENTICATED)
async def get_prefs(container: ContainerDep, identity: CurrentIdentity) -> PreferencesBody:
    """The stored preferences. Wrapped, symmetric with the PUT."""
    return PreferencesBody(prefs=await container.get_preferences(identity))


@router.put("/prefs", response_model=PreferencesBody, responses=_UNAUTHENTICATED)
async def set_prefs(
    container: ContainerDep, identity: CurrentIdentity, body: PreferencesBody
) -> PreferencesBody:
    """Replace the stored preferences and return what was stored."""
    return PreferencesBody(prefs=await container.set_preferences(identity, body.prefs))
