"""Turn the aura selfie impression + energy quiz into a warm aura reading.

Uses Sarvam's chat model. The reader interprets the colour palette Gemini saw
and the four quiz answers — it is told to treat this as an intuitive energy
reading, not a medical or predictive one. Result is cached on the AuraReading
row.
"""

from __future__ import annotations

from datetime import date

import httpx

from app.config import get_settings

settings = get_settings()


class ReadingError(RuntimeError):
    pass


_SYSTEM = (
    "You are an intuitive aura and chakra reader writing for a modern mobile "
    "app. Given the aura colours seen in the person's photo and their short "
    "energy quiz, write a warm, encouraging reading in clear English. Use these "
    "headings, each on its own line: Your Aura Colour, The Secondary Tones, The "
    "Seven Chakras, Your Gifts, The Shadow Side, This Week's Energy, Guidance. "
    "Under 'The Seven Chakras', briefly name each of the seven (Root, Sacral, "
    "Solar Plexus, Heart, Throat, Third Eye, Crown) and say whether it reads as "
    "open, tender, or over-active, guided by the quiz answers. If gender is "
    "given use natural pronouns; if relationship status or age is given let it "
    "colour the Guidance. 280 to 360 words. No markdown symbols, no medical "
    "claims, no disclaimers, and never predict death, disease or disaster."
)

_QUIZ_LABELS = {
    "energy": "Energy today",
    "focus": "Mostly on their mind",
    "feeling": "How they feel right now",
    "need": "What would help most",
}


def _age_from(birth_date: str | None) -> int | None:
    if not birth_date:
        return None
    try:
        y, m, d = (int(x) for x in birth_date.split("-"))
        today = date.today()
        return today.year - y - ((today.month, today.day) < (m, d))
    except (ValueError, TypeError):
        return None


def _facts(row) -> str:
    prof = row.profile or {}
    lines = [f"Name: {row.name}"]

    gender = prof.get("gender")
    if gender and gender != "Prefer not to say":
        lines.append(f"Gender: {gender}")
    rel_status = prof.get("relationship_status")
    if rel_status and rel_status != "Prefer not to say":
        lines.append(f"Relationship status: {rel_status}")
    age = _age_from(prof.get("birth_date"))
    if age is not None and 0 < age < 120:
        lines.append(f"Approximate age: {age}")

    lines.append(f"Dominant aura colour: {row.dominant_color}")
    secs = [s for s in (row.secondary_colors or []) if s]
    if secs:
        lines.append("Secondary aura tones: " + ", ".join(secs))

    feats = row.features or {}
    if feats.get("brightness"):
        lines.append(f"Overall brightness of the photo: {feats['brightness']}")
    if feats.get("warmth"):
        lines.append(f"Colour warmth of the light: {feats['warmth']}")
    if feats.get("visual_notes"):
        lines.append(f"What the reader saw in the photo: {feats['visual_notes']}")

    quiz = row.quiz or {}
    for key, label in _QUIZ_LABELS.items():
        if quiz.get(key):
            lines.append(f"{label}: {quiz[key]}")

    return "\n".join(lines)


def _reasoning_effort() -> str | None:
    val = settings.sarvam_reasoning_effort.strip().lower()
    return val if val in {"low", "medium", "high"} else None


async def generate_reading(row) -> str:
    if not settings.sarvam_api_key:
        raise ReadingError("SARVAM_API_KEY is not configured on the server")

    payload = {
        "model": settings.sarvam_chat_model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _facts(row)},
        ],
        "temperature": 0.55,
        "max_tokens": 2048,
        "reasoning_effort": _reasoning_effort(),
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
