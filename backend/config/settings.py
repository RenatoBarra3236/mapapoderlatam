from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PORT: int = 3001
    DATABASE_URL: str = "postgresql+psycopg://mapapoder:mapapoder@localhost:5432/mapapoderlatam"
    ENVIRONMENT: str = "development"
    NODE_ENV: str = "development"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    CHILECOMPRA_TICKET: str = ""
    CHILECOMPRA_SEED_TENDER_CODES: str = ""
    CHILECOMPRA_SEED_OC_CODES: str = ""
    CHILECOMPRA_DAILY_BUDGET: int = 9000
    CHILECOMPRA_NIGHT_START: str = "22:00"
    CHILECOMPRA_NIGHT_END: str = "07:00"
    INFOLOBBY_ENDPOINT: str = ""
    INFOPROBIDAD_ENDPOINT: str = ""
    SERVEL_DATA_URL: str = ""
    REGISTRO_COLABORADORES_URL: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PROVIDER: str = "claude"  # "claude" | "gemini"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
