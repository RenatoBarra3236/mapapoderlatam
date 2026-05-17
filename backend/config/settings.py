from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PORT: int = 3001
    DATABASE_URL: str = "postgresql+psycopg://mapapoder:mapapoder@localhost:5432/mapapoderlatam"
    ENVIRONMENT: str = "development"
    NODE_ENV: str = "development"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    CHILECOMPRA_TICKET: str = ""
    INFOLOBBY_ENDPOINT: str = ""
    INFOPROBIDAD_ENDPOINT: str = ""
    SERVEL_DATA_URL: str = ""
    REGISTRO_COLABORADORES_URL: str = ""
    ANTHROPIC_API_KEY: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
