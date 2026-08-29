"""Typed configuration, read from the environment.

Purpose
    One validated object holds every knob. Nothing else in the service reads
    os.environ, so a missing or malformed value fails once, at startup, with a
    message that names the variable.

Key responsibilities
    - Declare each setting with a type, a default, and a description.
    - Derive the CORS origin list from the comma-separated env form.
    - Never expose a secret through repr; the DSN carries a password.

Dependencies
    pydantic-settings. Loaded from the process environment and, for host-side
    runs, an optional .env file at the repository root.

Usage
    settings = get_settings()   # cached; call it anywhere, costs nothing twice
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Everything the API needs to start."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Service identity ──────────────────────────────────────────────────
    service_name: str = Field(
        default="atlas-api",
        description="Name reported by /health and stamped on every log line.",
    )
    environment: Literal["local", "test", "staging", "production"] = Field(
        default="local",
        description="Deployment environment. Controls doc exposure, not behaviour.",
    )
    log_level: str = Field(default="INFO", description="Root log level.")

    # ── Database ──────────────────────────────────────────────────────────
    # SecretStr keeps the password out of tracebacks and out of any accidental
    # repr of the settings object.
    database_url: SecretStr = Field(
        default=SecretStr("postgresql://atlas:atlas@localhost:5436/atlas"),
        description="asyncpg DSN. Inside compose this points at host 'db'.",
    )
    db_pool_min_size: int = Field(default=1, ge=0, description="Idle pool floor.")
    db_pool_max_size: int = Field(
        default=10,
        ge=1,
        description=(
            "Pool ceiling per worker. Workers x this must stay well under "
            "Postgres max_connections (100 by default)."
        ),
    )
    db_connect_timeout_seconds: float = Field(
        default=5.0, gt=0, description="Per-connection dial timeout."
    )

    # ── Scripture read API ────────────────────────────────────────────────
    default_translation: str = Field(
        default="BSB",
        description=(
            "Translation used when the caller names none. The Berean Standard "
            "Bible: modern English, public domain since 2023, and the PRD's "
            "own stated launch preference (question Q-024)."
        ),
    )
    search_default_limit: int = Field(default=40, ge=1, le=200)
    search_max_limit: int = Field(default=200, ge=1)

    # ── Retrieval embeddings (Q-010) ───────────────────────────────────────
    # A paid vendor, deliberately: Q-010 weighed self-hosting BGE-M3 at $0/embed
    # against OpenAI at ~$0.02/M tokens and chose the paid API to avoid a second
    # service in the compose stack. The key is optional at the Settings level
    # so the API can start without it; scripts/ingest_embeddings.py is the only
    # thing that needs it, and it fails loudly, naming the variable, if unset.
    openai_api_key: SecretStr | None = Field(
        default=None,
        description="OpenAI API key. Only scripts.ingest_embeddings needs this.",
    )
    embedding_model: str = Field(
        default="text-embedding-3-small",
        description="Q-010's chosen embedding model. Changing this invalidates "
        "every stored vector -- embedding_dimensions and the pgvector column "
        "width would need to move together.",
    )
    embedding_dimensions: int = Field(
        default=1536,
        description="Must match db/versions/0003_20260829_retrieval_embeddings.py's "
        "EMBEDDING_DIMENSIONS. Not derived from it: a migration and a running "
        "process should not import each other.",
    )

    # ── HTTP ──────────────────────────────────────────────────────────────
    allowed_origins: str = Field(
        default="*",
        description="Comma-separated CORS origins, or '*' for any.",
    )

    @property
    def cors_origins(self) -> list[str]:
        """The CORS origin list, parsed from the comma-separated env form."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def dsn(self) -> str:
        """The database DSN as a plain string, for the driver only."""
        return self.database_url.get_secret_value()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """The process-wide settings object. Cached, so validation runs once."""
    return Settings()
