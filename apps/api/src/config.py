from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


API_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_ENV: str = "development"
    PORT: int = 8080
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://spinout-engine.vercel.app"

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""
    OPENAI_MODEL_FAST: str = "gpt-5.5-mini"
    OPENAI_MODEL_STRONG: str = "gpt-5.5"
    OPENAI_FALLBACK_API_KEY: str = ""
    OPENAI_FALLBACK_MODEL_FAST: str = "gpt-5.4-mini"
    OPENAI_FALLBACK_MODEL_STRONG: str = "gpt-5.4-mini"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = ""
    ELEVENLABS_TTS_MODEL: str = "eleven_flash_v2_5"

    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""
    FEATURE_GATE_MODE: str = "firestore"

    S3_ENDPOINT: str = "https://s3.fr-par.scw.cloud"
    S3_REGION: str = "fr-par"
    S3_BUCKET: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    MAX_UPLOAD_MB: int = Field(default=20, ge=1, le=100)
    ENABLE_DEMO_FIXTURES: bool = False
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
