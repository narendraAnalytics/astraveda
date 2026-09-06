"""Thin client around Sarvam's Text Translation API (sarvam-translate:v1).

Docs: https://docs.sarvam.ai/api-reference/text/translate-text
  POST https://api.sarvam.ai/translate
  header: api-subscription-key: <key>
  body:  { input, source_language_code, target_language_code, model }
  limit: 2000 chars per request
"""

from __future__ import annotations

import re

import httpx

from app.config import get_settings

settings = get_settings()

# App language code -> Sarvam BCP-47-ish code.
LANG_CODES: dict[str, str] = {
    "en": "en-IN",
    "hi": "hi-IN",
    "od": "od-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "mr": "mr-IN",
    "kn": "kn-IN",
}

SUPPORTED = set(LANG_CODES)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?。！?॥।\n])\s+")


class SarvamError(RuntimeError):
    pass


def _chunk(text: str, limit: int) -> list[str]:
    """Split text into <=limit pieces, preferring sentence boundaries."""
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    buf = ""
    for piece in _SENTENCE_SPLIT.split(text):
        candidate = f"{buf} {piece}".strip() if buf else piece
        if len(candidate) <= limit:
            buf = candidate
            continue
        if buf:
            chunks.append(buf)
        if len(piece) <= limit:
            buf = piece
        else:  # a single sentence longer than the limit — hard-wrap it
            for i in range(0, len(piece), limit):
                chunks.append(piece[i : i + limit])
            buf = ""
    if buf:
        chunks.append(buf)
    return chunks


async def translate(text: str, target_lang: str, source_lang: str = "en") -> str:
    if not text.strip():
        return text
    if target_lang not in SUPPORTED:
        raise SarvamError(f"Unsupported target language: {target_lang}")
    if target_lang == source_lang:
        return text
    if not settings.sarvam_api_key:
        raise SarvamError("SARVAM_API_KEY is not configured on the server")

    headers = {"api-subscription-key": settings.sarvam_api_key}
    out: list[str] = []
    async with httpx.AsyncClient(base_url=settings.sarvam_base_url, timeout=30) as client:
        for chunk in _chunk(text, settings.sarvam_max_chars):
            payload = {
                "input": chunk,
                "source_language_code": LANG_CODES[source_lang],
                "target_language_code": LANG_CODES[target_lang],
                "model": settings.sarvam_translate_model,
            }
            resp = await client.post("/translate", json=payload, headers=headers)
            if resp.status_code != 200:
                raise SarvamError(f"Sarvam {resp.status_code}: {resp.text[:300]}")
            data = resp.json()
            out.append(data.get("translated_text", ""))
    return " ".join(p for p in out if p)
