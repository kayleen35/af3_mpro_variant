from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "AI Drug Discovery Decision Support MVP"
    api_prefix: str = "/api"
    # 기본값은 무설치 로컬 실행용 SQLite(aiosqlite). Docker/운영에서는
    # DATABASE_URL 환경변수로 PostgreSQL(postgresql+asyncpg://...)을 주입한다.
    database_url: str = Field(
        default="sqlite+aiosqlite:///./local.db",
        alias="DATABASE_URL",
    )
    backend_cors_origins: str = Field(default="http://localhost:3000", alias="BACKEND_CORS_ORIGINS")
    seed_demo_data: bool = Field(default=True, alias="SEED_DEMO_DATA")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
