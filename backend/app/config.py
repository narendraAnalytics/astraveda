from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    sarvam_api_key: str = ""
    # Blank -> local SQLite file (dev on a machine without Postgres).
    database_url: str = ""
    allowed_origins: str = "*"

    # Clerk. JWT verification is networkless — paste the PEM public key from the
    # Clerk dashboard (API Keys -> Show JWT public key / "PEM public key").
    clerk_jwt_key: str = ""
    clerk_issuer: str = "https://nearby-buck-5233.clerk.accounts.dev"
    # Svix signing secret for the /webhooks/clerk endpoint (Clerk dashboard -> Webhooks).
    clerk_webhook_secret: str = ""

    sarvam_base_url: str = "https://api.sarvam.ai"
    sarvam_translate_model: str = "sarvam-translate:v1"
    # Sarvam hard limit is 2000 chars/request; stay under it.
    sarvam_max_chars: int = 1800
    # Chat model used to turn a computed chart into a plain-language reading.
    sarvam_chat_model: str = "sarvam-105b"

    # Open-Meteo geocoding — free, no key. Resolves a city to lat/lon/timezone.
    geocoding_url: str = "https://geocoding-api.open-meteo.com/v1/search"

    @property
    def sqlalchemy_url(self) -> str:
        if not self.database_url:
            return "sqlite:///./astraveda_dev.db"
        # SQLModel/SQLAlchemy wants the psycopg v3 driver spelled out.
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
