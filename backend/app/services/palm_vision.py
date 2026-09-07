"""Palm image analysis via Gemini Vision (Google AI Studio).

Gemini only *sees* the hand — it returns structured Hasta Samudrika features
(hand shape, how each line looks, raised mounts, marks). The narrative reading is
still produced by Sarvam from those features (`services.palm_reading`).

Raw REST call via httpx — no SDK dependency, same style as the Sarvam client.
The image is never stored server-side; it lives only in this request.
"""

from __future__ import annotations

import json

import httpx

from app.config import get_settings

settings = get_settings()


class VisionError(RuntimeError):
    pass


# Values must line up with app.routers.palm option sets.
_SCHEMA = {
    "type": "object",
    "properties": {
        "is_hand": {"type": "boolean"},
        "image_quality": {"type": "string", "enum": ["good", "fair", "poor"]},
        "retake_reason": {"type": "string"},
        "dominant_hand_guess": {"type": "string", "enum": ["Left", "Right", "Unknown"]},
        "hand_shape": {"type": "string", "enum": ["Earth", "Air", "Fire", "Water", "Unknown"]},
        "finger_length": {"type": "string", "enum": ["Short", "Balanced", "Long", "Unknown"]},
        "thumb_flex": {"type": "string", "enum": ["Firm", "Balanced", "Flexible", "Unknown"]},
        "lines": {
            "type": "object",
            "properties": {
                "heart": {"type": "string"},
                "head": {"type": "string"},
                "life": {"type": "string"},
                "fate": {"type": "string"},
            },
        },
        "mounts": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["Jupiter", "Saturn", "Sun", "Mercury", "Venus", "Moon", "Mars"],
            },
        },
        "marks": {"type": "array", "items": {"type": "string"}},
        "observations": {"type": "string"},
    },
    "required": ["is_hand", "image_quality", "hand_shape"],
}

_PROMPT = (
    "You are a Hasta Samudrika Shastra (Vedic palmistry) analyst. Look at this "
    "photograph of a person's palm and describe what is VISIBLE — do not invent "
    "detail you cannot see.\n"
    "- is_hand: false if the image is not clearly an open palm.\n"
    "- image_quality / retake_reason: 'poor' with a short reason if lines are not "
    "readable (blurry, dark, too far, closed fingers, back of hand).\n"
    "- hand_shape: elemental type from palm proportions and finger length "
    "(Earth=square palm+short fingers, Air=square palm+long fingers, Fire=long "
    "palm+short fingers, Water=long palm+long fingers).\n"
    "- lines.heart/head/life/fate: one short phrase each for how that line looks "
    "(e.g. 'deep and long', 'curved, ends under Jupiter', 'faint and broken', "
    "'absent'). Use 'not visible' if you cannot trace it.\n"
    "- mounts: list only the 1-3 mounts that look clearly raised or well developed.\n"
    "- marks: note any classic marks formed by the lines (fish, star, triangle, "
    "trident, cross, island) and where. Empty list if none stand out.\n"
    "- observations: 1-2 sentences of overall impression.\n"
    "Return JSON only."
)


async def analyze_palm(image_b64: str, mime_type: str = "image/jpeg") -> dict:
    if not settings.gemini_api_key:
        raise VisionError("GEMINI_API_KEY is not configured on the server")

    url = (
        f"{settings.gemini_base_url}/models/{settings.gemini_vision_model}:generateContent"
        f"?key={settings.gemini_api_key}"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.15,
            "responseMimeType": "application/json",
            "responseSchema": _SCHEMA,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        raise VisionError(f"Gemini request failed: {exc}") from exc

    if resp.status_code == 429:
        raise VisionError("Gemini free-tier rate limit hit — try again in a minute.")
    if resp.status_code != 200:
        raise VisionError(f"Gemini {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise VisionError(f"Unexpected Gemini response: {resp.text[:300]}") from exc

    try:
        parsed = json.loads(text)
    except ValueError as exc:
        raise VisionError(f"Gemini did not return valid JSON: {text[:300]}") from exc

    if not isinstance(parsed, dict):
        raise VisionError("Gemini returned a non-object payload")
    return parsed
