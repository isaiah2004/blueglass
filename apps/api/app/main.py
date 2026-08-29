"""Application factory. The only module that assembles the whole service.

Purpose
    Build a FastAPI application from settings: configure logging, wire the
    container, install the cross-cutting middleware and error handlers, and
    mount every module's router.

Key responsibilities
    - create_app(settings) so tests can build an isolated app with their own
      settings and their own container, without touching process globals.
    - Open the database pool during lifespan startup and close it on shutdown,
      tolerating a database that is not up yet so /health still answers.

Dependencies
    FastAPI, the container, the shared HTTP and logging packages, the module
    routers.

Usage
    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import Settings, get_settings
from .config.container import Container
from .modules.health.presentation import router as health_router
from .modules.identity.presentation import router as identity_router
from .modules.scripture.presentation import router as scripture_router
from .modules.study.presentation import router as study_router
from .shared.http import RequestContextMiddleware, register_exception_handlers
from .shared.logging import configure_logging

_DESCRIPTION = (
    "Scripture read API for Atlas Bible. Translations, the 66-book canon, "
    "chapters, indexed verse search, and chapter study content."
)

_logger = logging.getLogger("atlas.startup")


def _build_lifespan(container: Container):
    """Bind the container's lifecycle to the application's."""

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await container.startup()
        _logger.info(
            "api started",
            extra={
                "service": container.settings.service_name,
                "environment": container.settings.environment,
                "database_connected": container.database.is_connected,
            },
        )
        yield
        await container.shutdown()

    return lifespan


def _install_middleware(app: FastAPI, settings: Settings) -> None:
    """Cross-cutting concerns, innermost last.

    Starlette runs middleware in reverse registration order, so registering CORS
    after the request-context middleware means CORS sits outside it -- which is
    what we want: a rejected preflight should not allocate a correlation id.
    """
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # The client authenticates with a header, not a cookie. Keeping
        # credentials off avoids the wildcard-origin-with-credentials pattern
        # that browsers refuse anyway.
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )


def create_app(
    settings: Settings | None = None, container: Container | None = None
) -> FastAPI:
    """Build a fully wired application.

    Passing a container is how tests substitute in-memory repositories: the
    lifespan, the routes and the dependency helpers all read the same object, so
    there is no window in which two containers exist.
    """
    resolved = settings or get_settings()
    configure_logging(resolved.log_level)
    wired = container or Container(resolved)

    app = FastAPI(
        title="Atlas Bible API",
        version=__version__,
        description=_DESCRIPTION,
        lifespan=_build_lifespan(wired),
    )
    app.state.container = wired

    _install_middleware(app, resolved)
    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(scripture_router)
    app.include_router(identity_router)
    app.include_router(study_router)
    return app


#: The ASGI application uvicorn serves.
app = create_app()
