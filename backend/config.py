from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SANDBOX_DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    class Config:
        env_file = ".env"


settings = Settings()
