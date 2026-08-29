"""Liveness and readiness probes.

Purpose
    Two different questions, two different endpoints, because conflating them is
    how a container gets restarted for a database outage it could have survived.

    GET /health  LIVENESS. Is the process up and serving? Touches nothing
                 external, so it is true whenever the answer can be delivered at
                 all. An orchestrator restarts on failure here.
    GET /ready   READINESS. Can it serve real traffic? Runs SELECT 1 against
                 Postgres. An orchestrator removes the instance from the load
                 balancer on failure here, and puts it back when the database
                 recovers, without a restart.

Dependencies
    FastAPI and the container.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .... import __version__
from ....presentation_dependencies import ContainerDep
from ....shared.errors import DependencyUnavailableError
from ....shared.http import error_envelope
from ....shared.logging import current_request_id

router = APIRouter(tags=["meta"])


class HealthOut(BaseModel):
    """GET /health."""

    status: str = Field(description="Always ok; a failure is a non-response.")
    service: str
    version: str
    environment: str


class ReadyOut(BaseModel):
    """GET /ready."""

    status: str
    checks: dict[str, str] = Field(description="One entry per dependency.")


@router.get("/health", response_model=HealthOut, summary="Liveness")
async def health(container: ContainerDep) -> HealthOut:
    """Does not touch the database. See the module docstring."""
    return HealthOut(
        status="ok",
        service=container.settings.service_name,
        version=__version__,
        environment=container.settings.environment,
    )


@router.get(
    "/ready",
    response_model=ReadyOut,
    summary="Readiness",
    responses={503: {"description": "dependency_unavailable"}},
)
async def ready(container: ContainerDep) -> ReadyOut | JSONResponse:
    """Proves Postgres answers before declaring the instance ready.

    Returns the error envelope by hand rather than raising, because a 503 here
    is a routine, expected state during startup and must not be logged as a
    handled application error on every poll.
    """
    try:
        await container.database.ping()
    except DependencyUnavailableError as exc:
        return JSONResponse(
            status_code=503,
            content=error_envelope(
                code=exc.code,
                message=exc.message,
                request_id=current_request_id(),
                details={"checks": {"database": "unavailable"}},
            ),
        )
    return ReadyOut(status="ready", checks={"database": "ok"})
