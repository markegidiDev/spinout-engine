from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_ENV: str = "development"
    PORT: int = 8080
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_FAST: str = "gpt-5.5-mini"
    OPENAI_MODEL_STRONG: str = "gpt-5.5"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = ""
    ELEVENLABS_TTS_MODEL: str = "eleven_flash_v2_5"

    S3_ENDPOINT: str = "https://s3.fr-par.scw.cloud"
    S3_REGION: str = "fr-par"
    S3_BUCKET: str = "spinout-engine-demo"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    MAX_UPLOAD_MB: int = Field(default=20, ge=1, le=100)
    ENABLE_DEMO_FIXTURES: bool = True
    SAVE_AUDIO_TO_S3: bool = True
    REQUEST_TIMEOUT_SECONDS: int = Field(default=45, ge=5, le=120)

    @property
    def allowed_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
        return [origin for origin in origins if origin]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

