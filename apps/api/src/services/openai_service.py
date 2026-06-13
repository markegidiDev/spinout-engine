from __future__ import annotations

import json
import re
from typing import Any

from openai import OpenAI

from src.config import Settings


class AIProviderError(RuntimeError):
    pass


class OpenAIService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client: OpenAI | None = None
        self._fallback_client: OpenAI | None = None

    def is_configured(self) -> bool:
        return bool(self.settings.OPENAI_API_KEY)

    @property
    def client(self) -> OpenAI:
        if not self.is_configured():
            raise AIProviderError("OpenAI API key is not configured")
        if self._client is None:
            kwargs: dict[str, Any] = {
                "api_key": self.settings.OPENAI_API_KEY,
                "timeout": self.settings.REQUEST_TIMEOUT_SECONDS,
            }
            if self.settings.OPENAI_BASE_URL:
                kwargs["base_url"] = self.settings.OPENAI_BASE_URL
            self._client = OpenAI(**kwargs)
        return self._client

    @property
    def fallback_client(self) -> OpenAI | None:
        if not self.settings.OPENAI_FALLBACK_API_KEY:
            return None
        if self._fallback_client is None:
            self._fallback_client = OpenAI(
                api_key=self.settings.OPENAI_FALLBACK_API_KEY,
                timeout=self.settings.REQUEST_TIMEOUT_SECONDS,
            )
        return self._fallback_client

    def complete_json(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        repair: bool = True,
    ) -> dict[str, Any]:
        selected_model = model or self.settings.OPENAI_MODEL_FAST
        content = self._chat_completion_json(system=system, user=user, model=selected_model)
        try:
            return _parse_json_object(content)
        except ValueError as first_error:
            if not repair:
                raise AIProviderError("OpenAI returned invalid JSON") from first_error

            repair_prompt = (
                "Repair this response into one valid JSON object. Keep the same meaning. "
                "Return JSON only.\n\n"
                f"{content[:12000]}"
            )
            repaired = self._chat_completion_json(
                system="You repair malformed JSON responses.",
                user=repair_prompt,
                model=self.settings.OPENAI_MODEL_FAST,
            )
            try:
                return _parse_json_object(repaired)
            except ValueError as second_error:
                raise AIProviderError("OpenAI JSON repair failed") from second_error

    def _chat_completion_json(self, *, system: str, user: str, model: str) -> str:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"{user}\n\nReturn exactly one JSON object."},
        ]
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.2,
            )
        except Exception as exc:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.2,
                )
            except Exception as retry_exc:
                response = self._fallback_completion(messages=messages, primary_model=model)

        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise AIProviderError("OpenAI returned an empty response")
        return content

    def _fallback_completion(self, *, messages: list[dict[str, str]], primary_model: str):
        fallback_client = self.fallback_client
        if fallback_client is None:
            raise AIProviderError("Primary AI request failed and no fallback API key is configured")

        fallback_model = (
            self.settings.OPENAI_FALLBACK_MODEL_STRONG
            if primary_model == self.settings.OPENAI_MODEL_STRONG
            else self.settings.OPENAI_FALLBACK_MODEL_FAST
        )
        try:
            return fallback_client.chat.completions.create(
                model=fallback_model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.2,
            )
        except Exception:
            return fallback_client.chat.completions.create(
                model=fallback_model,
                messages=messages,
                temperature=0.2,
            )


def _parse_json_object(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("No JSON object found")
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object")
    return parsed
