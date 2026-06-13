from __future__ import annotations

import json
from typing import Any

import requests

from src.config import Settings
from src.schemas import EvidenceItem, VentureMemo
from src.services.openai_service import _parse_json_object


class GeminiProviderError(RuntimeError):
    pass


class GeminiService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(self.settings.GEMINI_API_KEY)

    def review_memo(self, *, memo: VentureMemo, evidence: list[EvidenceItem]) -> dict[str, Any]:
        if not self.is_configured():
            raise GeminiProviderError("Gemini API key is not configured")

        prompt = (
            "Review this venture memo critically against the supplied evidence. "
            "Flag weak claims, hallucination risk, missing proof, and unclear market logic. "
            "Return JSON with keys: hallucinationFlags, missingEvidence, review.\n\n"
            f"Memo: {memo.model_dump_json(by_alias=True)}\n\n"
            f"Evidence: {json.dumps([item.model_dump() for item in evidence], ensure_ascii=False)}"
        )
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.GEMINI_MODEL}:generateContent"
        )
        try:
            response = requests.post(
                endpoint,
                params={"key": self.settings.GEMINI_API_KEY},
                json={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=self.settings.REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            body = response.json()
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            return _parse_json_object(text)
        except Exception as exc:
            raise GeminiProviderError("Gemini review failed") from exc

