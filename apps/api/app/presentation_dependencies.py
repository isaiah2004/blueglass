"""FastAPI dependency helpers. The only place routes touch the container.

Purpose
    Keep the presentation layer's knowledge of wiring down to "ask the app for
    the container". Routes annotate a parameter and get a use case; they never
    import an adapter, which is what keeps rule 5.1.1 true at the edge.

Key responsibilities
    - Expose the container from application state.
    - Expose current_identity, the single dependency that answers "who is this".

Dependencies
    FastAPI, the container, the identity module.

Usage
    async def endpoint(identity: CurrentIdentity) -> ...:
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from .config.container import Container
from .modules.identity.domain import Identity


def get_container(request: Request) -> Container:
    """The wired object graph for this application."""
    container: Container = request.app.state.container
    return container


ContainerDep = Annotated[Container, Depends(get_container)]


async def current_identity(request: Request, container: ContainerDep) -> Identity:
    """Resolve the caller's identity, or fail with 401.

    THIS IS THE SEAM. Every route that touches a reader's data depends on this
    function; it delegates to the container's IdentityResolver, and swapping
    that adapter is the whole of the work to move from anonymous device ids to
    real accounts (decision A-01).

    There is no fallback subject. The prototype's dev-user constant
    (server/app/routers/user.py line 15) meant every device shared one account;
    a test asserts that constant appears nowhere in this service.
    """
    return await container.identity_resolver.resolve(request.headers)


CurrentIdentity = Annotated[Identity, Depends(current_identity)]
