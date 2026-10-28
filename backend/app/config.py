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
        RATE_LIMIT_PER_IP:  Max requests per IP per rolling window.
        DAILY_GLOBAL_CAP:   Max Gemini extractions across all users per day.
    """

    DATABASE_URL: str = (
        "postgresql+asyncpg://ope_user:ope_local_pass@localhost:5432/ope_dev"
    )
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    FRONTEND_ORIGINS: str = "http://localhost:8081"
    TRUSTED_PROXY: bool = False
    RATE_LIMIT_PER_IP: int = 20
    DAILY_GLOBAL_CAP: int = 300

    @property
    def cors_origins(self) -> list[str]:
        """Split the comma-separated FRONTEND_ORIGINS into a list."""
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


# Module-level singleton — import `settings` wherever needed.
settings = Settings()
