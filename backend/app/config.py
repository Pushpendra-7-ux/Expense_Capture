"""
app/config.py — Application settings powered by pydantic-settings.

All values are read from environment variables or a `.env` file located
next to the running process (typically backend/.env).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration singleton.

    Attributes:
        DATABASE_URL:       PostgreSQL async connection string (asyncpg).
        GEMINI_API_KEY:     API key for Google Gemini (empty = disabled).
        GEMINI_MODEL:       Which Gemini model to call.
        FRONTEND_ORIGINS:   Comma-separated list of allowed CORS origins.
        TRUSTED_PROXY:      Whether the app runs behind a trusted reverse proxy.
        RATE_LIMIT_ENABLED: Toggle rate limiting on/off (useful for prototypes).
        RATE_LIMIT_PER_IP:  Max requests per IP per rolling window.
        DAILY_GLOBAL_CAP:   Max Gemini extractions across all users per day.
    """

    DATABASE_URL: str = (
        "postgresql+asyncpg://ope_user:ope_local_pass@localhost:5432/ope_dev"
    )
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_FALLBACK_MODELS: str = (
        "gemini-3.5-flash,gemini-2.5-flash,gemini-3.6-flash,"
        "gemini-3.8-flash,gemini-2.5-flash-lite"
    )
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://localhost:4173"
    TRUSTED_PROXY: bool = False
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_IP: int = 10000
    DAILY_GLOBAL_CAP: int = 100000

    @property
    def cors_origins(self) -> list[str]:
        """Split the comma-separated FRONTEND_ORIGINS into a list."""
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    @property
    def gemini_model_candidates(self) -> list[str]:
        """Primary model first, then a de-duplicated fallback cascade."""
        models = [self.GEMINI_MODEL]
        models.extend(
            m.strip()
            for m in self.GEMINI_FALLBACK_MODELS.split(",")
            if m.strip()
        )
        # Preserve order while removing duplicates.
        return list(dict.fromkeys(models))

    model_config = {
        "env_file": (".env", "backend/.env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


# Module-level singleton — import `settings` wherever needed.
settings = Settings()
