"""AI Dream Interpreter — Svapna Shastra (Vedic dream lore) lens.

Text only. The user describes the dream; Sarvam returns a structured reading as
JSON: title, feeling, key symbols, theme, a Vedic note, and guidance. One call —
there is no separate narrative phase.
"""

from __future__ import annotations

import json
import re
from datetime import date

import httpx

from app.config import get_settings

settings = get_settings()


class ReadingError(RuntimeError):
    pass


_SYSTEM = (
    "You are a thoughtful dream interpreter who blends Svapna Shastra (the "
    "Indian tradition of dream lore) with gentle modern psychology, writing for "
    "a mobile app. Given the person's dream and a little context, return ONLY a "
    "JSON object with these keys:\n"
    '  "title": a short evocative name for the dream (3-6 words),\n'
    '  "feeling": one sentence naming the core emotion of the dream,\n'
    '  "symbols": an array of 3 to 5 objects, each {"symbol": "...", "meaning": '
    'a one-sentence meaning blending Vedic and universal readings},\n'
    '  "theme": 2-3 sentences on what the dream points to in waking life,\n'
    '  "vedic_note": 2-3 sentences of traditional Svapna Shastra significance — '
    "whether such a dream tends to be seen as auspicious or a caution, and how "
    "the quarter of the night it occurred in weighs on it (dreams near dawn are "
    "held to carry the most meaning),\n"
    '  "guidance": 2-3 sentences of a gentle, practical suggestion.\n'
    "Use natural pronouns if a gender is given. Never predict death, disease or "
    "disaster; never give medical or financial advice. No markdown, no text "
    "outside the JSON object."
)

_CTX_LABELS = {
    "feeling": "How the dream felt",
    "when": "When it happened",
    "night": "Time of night",
    "focus": "On their mind lately",
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


def _user_content(*, name: str, profile: dict, dream_text: str, context: dict) -> str:
    lines = [f"Name: {name}"]
    gender = profile.get("gender")
    if gender and gender != "Prefer not to say":
        lines.append(f"Gender: {gender}")
    rel_status = profile.get("relationship_status")
    if rel_status and rel_status != "Prefer not to say":
        lines.append(f"Relationship status: {rel_status}")
    age = _age_from(profile.get("birth_date"))
    if age is not None and 0 < age < 120:
        lines.append(f"Approximate age: {age}")

    for key, label in _CTX_LABELS.items():
        if context.get(key):
            lines.append(f"{label}: {context[key]}")

    lines.append("")
    lines.append("The dream, in their words:")
    lines.append(dream_text.strip())
    return "\n".join(lines)


def _parse_json(text: str) -> dict:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    # grab the outermost object if the model wrapped it in prose
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end != -1 and end > start:
        t = t[start : end + 1]
    return json.loads(t)


def _reasoning_effort() -> str | None:
    val = settings.sarvam_reasoning_effort.strip().lower()
    return val if val in {"low", "medium", "high"} else None


async def interpret_dream(*, name: str, profile: dict, dream_text: str, context: dict) -> dict:
    if not settings.sarvam_api_key:
        raise ReadingError("SARVAM_API_KEY is not configured on the server")

    payload = {
        "model": settings.sarvam_chat_model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _user_content(
                name=name, profile=profile, dream_text=dream_text, context=context,
            )},
        ],
        "temperature": 0.6,
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
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ReadingError(f"Unexpected Sarvam response: {resp.text[:300]}") from exc

    if not content or not content.strip():
        raise ReadingError("Sarvam returned an empty interpretation")

    try:
        parsed = _parse_json(content)
    except ValueError as exc:
        raise ReadingError(f"Sarvam did not return valid JSON: {content[:300]}") from exc

    symbols = []
    for s in parsed.get("symbols") or []:
        if isinstance(s, dict) and s.get("symbol"):
            symbols.append({
                "symbol": str(s["symbol"])[:60],
                "meaning": str(s.get("meaning") or "")[:280],
            })
    return {
        "title": str(parsed.get("title") or "Your dream")[:90],
        "feeling": str(parsed.get("feeling") or "")[:200],
        "symbols": symbols[:5],
        "theme": str(parsed.get("theme") or "")[:800],
        "vedic_note": str(parsed.get("vedic_note") or "")[:800],
        "guidance": str(parsed.get("guidance") or "")[:800],
    }
