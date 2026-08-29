"""Public API of the badge infrastructure layer."""

from .postgres_badge_repository import PostgresBadgeRepository

__all__ = ["PostgresBadgeRepository"]
