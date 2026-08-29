"""Database adapters. Nothing above the infrastructure layer imports this."""

from .pool import Database

__all__ = ["Database"]
