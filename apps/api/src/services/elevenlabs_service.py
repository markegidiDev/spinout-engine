from __future__ import annotations

import base64
from typing import Protocol

import requests

from src.config import Settings


class AudioStorage(Protocol):
    def is_configured(self) -> bool:
        ...

    def upload_bytes(self, key: str, data: bytes, content_type: str) -> None:
        ...

    def generate_presigned_url(self, key: str, expires: int = 3600) -> str:
        ...


class ElevenLabsService:
    def __init__(self, settings: Settings, storage: AudioStorage | None = None):
        self.settings = settings
        self.storage = storage

    def is_configured(self) -> bool:
        return bool(self.settings.ELEVENLABS_API_KEY and self.settings.ELEVENLABS_VOICE_ID)

    def generate_investor_audio(
        self,
        *,
        text: str,
        session_id: str,
        question_number: int = 1,
    ) -> dict[str, str]:
        if not self.is_configured():
            return {}

        endpoint = f"https://api.elevenlabs.io/v1/text-to-speech/{self.settings.ELEVENLABS_VOICE_ID}"
        payload = {
            "text": text[:1200],
            "model_id": self.settings.ELEVENLABS_TTS_MODEL,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.7},
        }
        try:
            response = requests.post(
                endpoint,
                headers={
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": self.settings.ELEVENLABS_API_KEY,
                },
                json=payload,
                timeout=self.settings.REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
        except Exception:
            return {}

        audio = response.content
        if self.settings.SAVE_AUDIO_TO_S3 and self.storage and self.storage.is_configured():
            key = f"audio/{session_id}/question-{question_number}.mp3"
            try:
                self.storage.upload_bytes(key=key, data=audio, content_type="audio/mpeg")
                return {
                    "audioUrl": self.storage.generate_presigned_url(key),
                    "audioObjectKey": key,
                }
            except Exception:
                return {"audioBase64": base64.b64encode(audio).decode("ascii")}

        return {"audioBase64": base64.b64encode(audio).decode("ascii")}

