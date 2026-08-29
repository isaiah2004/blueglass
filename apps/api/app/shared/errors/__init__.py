"""Public API of the shared error vocabulary."""

from .app_error import (
    AppError,
    ConflictError,
    DependencyUnavailableError,
    NotFoundError,
    UnauthenticatedError,
    ValidationError,
)

__all__ = [
    "AppError",
    "ConflictError",
    "DependencyUnavailableError",
    "NotFoundError",
    "UnauthenticatedError",
    "ValidationError",
]
