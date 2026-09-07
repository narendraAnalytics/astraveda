"""Turn a computed chart into a warm, plain-language Vedic reading (English).

Uses Sarvam's chat model. The chart math is never delegated to the LLM — only
the interpretation of already-computed facts. Result is cached on the Kundali row.
"""

from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()


class ReadingError(RuntimeError):
    pass


_SYSTEM = (
    "You are a warm, encouraging Vedic astrologer writing for a modern mobile app. "
    "Given the computed birth chart facts, write a personal reading in clear English. "
    "Use four short paragraphs with these headings on their own line: "
    "Lagna & Personality, Moon & Mind, Current Dasha, Guidance. "
    "Be specific to the placements given. Never invent planetary positions. "
    "Around 220-280 words. No markdown symbols, no disclaimers."
)


def _facts(name: str, chart: dict) -> str:
    lagna = chart.get("lagna", {})
    ava = chart.get("avakhada", {})
    vim = chart.get("vimshottari", {})
    cur = vim.get("current", {})
    lines = [
        f"Name: {name}",
        f"Lagna (Ascendant): {lagna.get('sign')} at {lagna.get('degree')}, "
        f"nakshatra {lagna.get('nakshatra')}",
        f"Moon sign (Rashi): {ava.get('moon_sign')}; "
        f"Nakshatra: {ava.get('nakshatra')} pada {ava.get('nakshatra_pada')} "
        f"(lord {ava.get('nakshatra_lord')})",
        f"Sun sign: {ava.get('sun_sign')}",
        f"Tithi: {ava.get('tithi')}; Varna: {ava.get('varna')}",
        f"Running Mahadasha: {cur.get('mahadasha')}; Antardasha: {cur.get('antardasha')}",
    ]
    placements = [
        f"{p['name']} in {p['sign']} (house {p['house']}, {p['nakshatra']})"
        for p in chart.get("planets", [])
    ]
    if placements:
        lines.append("Planets: " + "; ".join(placements))
    return "\n".join(lines)


async def generate_reading(name: str, chart: dict) -> str:
    if not settings.sarvam_api_key:
        raise ReadingError("SARVAM_API_KEY is not configured on the server")

    payload = {
        "model": settings.sarvam_chat_model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _facts(name, chart)},
        ],
        "temperature": 0.4,
        "max_tokens": 900,
    }
    headers = {
        "Authorization": f"Bearer {settings.sarvam_api_key}",
        "api-subscription-key": settings.sarvam_api_key,
    }
    try:
        async with httpx.AsyncClient(base_url=settings.sarvam_base_url, timeout=60) as client:
            resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise ReadingError(f"Sarvam request failed: {exc}") from exc

    if resp.status_code != 200:
        raise ReadingError(f"Sarvam {resp.status_code} ({settings.sarvam_chat_model}): {resp.text[:300]}")

    try:
        data = resp.json()
    except ValueError as exc:
        raise ReadingError(f"Sarvam returned a non-JSON response: {resp.text[:300]}") from exc

    try:
        choice = data["choices"][0]
        content = choice["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ReadingError(f"Unexpected Sarvam response: {str(data)[:300]}") from exc

    if not content or not content.strip():
        reason = choice.get("finish_reason", "unknown")
        raise ReadingError(f"Sarvam returned an empty reading (finish_reason={reason})")
    return content.strip()
