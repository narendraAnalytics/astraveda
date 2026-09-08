"""Turn structured face features into a warm Vedic face reading (English).

Mukha Samudrika Shastra. Uses Sarvam's chat model. The reader only interprets
what the vision model reported it could see — it is told never to invent a
feature. Result is cached on the FaceReading row.
"""

from __future__ import annotations

from datetime import date

import httpx

from app.config import get_settings

settings = get_settings()


class ReadingError(RuntimeError):
    pass


_SYSTEM = (
    "You are a traditional Mukha Samudrika Shastra (Vedic face reading) analyst "
    "writing for a modern mobile app. Given the querent's observed facial "
    "features, write a warm, specific reading in clear English. Use these "
    "headings, each on its own line: Face Nature, Forehead & Early Life, Eyes & "
    "Eyebrows, Nose & Prosperity, Lips & Speech, Chin, Jaw & Willpower, The "
    "Three Zones (Trikala), Guidance. Where a feature was reported as 'not "
    "clearly visible', speak to it generally and gently — never invent a "
    "specific feature. If gender is given, use natural pronouns; if "
    "relationship status or age is given, let it shape the Lips & Speech and "
    "Guidance sections. Treat the three zones as early life (forehead), middle "
    "life (brow to nose tip) and later life (nose tip to chin). 260 to 340 "
    "words. No markdown symbols, no disclaimers, and never predict death, "
    "disease or disaster."
)

_FEATURE_LABELS = {
    "forehead": "Forehead",
    "eyebrows": "Eyebrows",
    "eyes": "Eyes",
    "nose": "Nose",
    "lips": "Lips",
    "cheeks": "Cheeks",
    "chin_jaw": "Chin & jaw",
    "ears": "Ears",
    "three_zones": "Three zones (upper/middle/lower balance)",
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

    lines.append(f"Face shape: {row.face_shape}")

    features = row.features or {}
    for key, label in _FEATURE_LABELS.items():
        val = features.get(key)
        if val and val != "not clearly visible":
            lines.append(f"{label}: {val}")

    marks = [m for m in (row.marks or []) if m and m.lower() != "none"]
    if marks:
        lines.append("Notable marks: " + ", ".join(marks))

    obs = prof.get("observations")
    if obs:
        lines.append(f"Analyst's overall impression of the face photo: {obs}")
    if prof.get("source") == "scan":
        lines.append("(These features were read from a photo of the actual face.)")
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
