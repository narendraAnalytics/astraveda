"""Thin client around Sarvam's Bulbul Text-to-Speech API.

Docs: https://docs.sarvam.ai/api-reference-docs/text-to-speech/api/rest-api
  POST https://api.sarvam.ai/text-to-speech
  header: api-subscription-key: <key>
  body:  { text, language_code, speaker, model, pace, speech_sample_rate }
  resp:  { request_id, audios: ["<base64 wav>", ...] }
  limit: 2500 chars per request
"""

from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()

MAX_CHARS = 2500


class TtsError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.sarvam_api_key)


async def synthesize(text: str, *, speaker: str | None = None) -> str:
    """Returns a base64-encoded WAV string for the given text."""
    text = text.strip()
    if not text:
        raise TtsError("Empty text")
    if not is_configured():
        raise TtsError("SARVAM_API_KEY is not configured on the server")
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]

    headers = {"api-subscription-key": settings.sarvam_api_key}
    payload = {
        "text": text,
        "language_code": settings.sarvam_tts_language_code,
        "speaker": speaker or settings.sarvam_tts_speaker,
        "model": settings.sarvam_tts_model,
    }
    async with httpx.AsyncClient(base_url=settings.sarvam_base_url, timeout=30) as client:
        resp = await client.post("/text-to-speech", json=payload, headers=headers)
        if resp.status_code != 200:
            raise TtsError(f"Sarvam {resp.status_code}: {resp.text[:300]}")
        data = resp.json()

    audios = data.get("audios") or []
    if not audios:
        raise TtsError("Sarvam returned no audio")
    return audios[0]
