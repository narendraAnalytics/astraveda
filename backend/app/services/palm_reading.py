"""Turn a guided palm questionnaire into a warm Vedic palm reading (English).

Hasta Samudrika Shastra (Vedic palmistry). Uses Sarvam's chat model. The reader
only interprets the querent's self-reported hand features — it is told never to
invent a specific marking, and to speak gently where a feature was "Not sure".
Result is cached on the PalmReading row.
"""

from __future__ import annotations

from datetime import date

import httpx

from app.config import get_settings

settings = get_settings()


class ReadingError(RuntimeError):
    pass


_SYSTEM = (
    "You are a traditional Hasta Samudrika Shastra (Vedic palmistry) reader "
    "writing for a modern mobile app. Given the querent's self-reported hand "
    "features, write a warm, specific reading in clear English. Use these "
    "headings, each on its own line: Hand Nature, Heart Line & Relationships, "
    "Head Line & Mind, Life Line & Vitality, Fate Line & Career, Mounts & "
    "Planetary Strengths, Guidance. Where a feature was reported as 'Not sure', "
    "speak to it generally and gently invite the reader to look closer — never "
    "invent a specific marking. Reference the Vedic planetary rulers of the "
    "mounts (Guru, Shani, Surya, Budha, Shukra, Chandra, Mangala) where relevant. "
    "If gender is given, use natural pronouns; if relationship status or age is "
    "given, let it shape the Heart Line & Relationships and Life Line sections. "
    "260 to 340 words. No markdown symbols, no disclaimers, and never predict "
    "death, disease or disaster."
)

_LINE_LABELS = {
    "heart": "Heart line (Hridaya Rekha)",
    "head": "Head line (Mastaka Rekha)",
    "life": "Life line (Jeevana Rekha)",
    "fate": "Fate line (Bhagya Rekha)",
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

    lines += [
        f"Dominant hand: {row.dominant_hand}",
        f"Hand shape (elemental): {row.hand_shape}",
        f"Finger length: {row.finger_length or 'not given'}",
        f"Thumb: {row.thumb_flex or 'not given'}",
    ]
    line_answers = row.lines or {}
    for key, label in _LINE_LABELS.items():
        lines.append(f"{label}: {line_answers.get(key) or 'not given'}")
    mounts = row.mounts or []
    lines.append(
        "Fullest mounts: " + (", ".join(mounts) if mounts else "none especially raised (balanced)")
    )
    marks = [m for m in (row.marks or []) if m and m.lower() != "none"]
    if marks:
        lines.append("Auspicious marks noticed: " + ", ".join(marks))
    obs = (row.profile or {}).get("observations")
    if obs:
        lines.append(f"Analyst's overall impression of the palm photo: {obs}")
    if (row.profile or {}).get("source") == "scan":
        lines.append("(These features were read from a photo of the actual palm.)")
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
        "temperature": 0.5,
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
