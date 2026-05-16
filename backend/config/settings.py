from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PORT: int = 3001
    DATABASE_URL: str = "mysql+pymysql://root:password@localhost:3306/mapapoderlatam"
    NODE_ENV: str = "development"
    ANTHROPIC_API_KEY: str = ""

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
