"""
Application Configuration.
Loads all environment variables via Pydantic BaseSettings.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = Field(
        default="postgresql+psycopg://tris_user:tris_password@localhost:5432/tris_db",
        description="Async PostgreSQL connection string",
    )
    DB_ECHO: bool = False

    SECRET_KEY: str = Field(
        default="tris_dev_secret_key_change_in_production_min_32_bytes_long_safe",
        description="Secret key for JWT generation",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @property
    def is_production(self) -> bool:
        """Evaluates whether the active runtime environment is production/staging."""
        return self.ENVIRONMENT.lower() not in ("development", "test", "testing")

    def validate_production_security(self) -> None:
        """Enforces security boundaries outside development."""
        if not self.is_production:
            return
        if "change_in_production" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "Default or weak SECRET_KEY detected in non-development environment! "
                "You must configure a strong 32+ character SECRET_KEY in production."
            )


settings = Settings()
settings.validate_production_security()
