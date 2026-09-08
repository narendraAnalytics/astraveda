"""Aura selfie analysis via Gemini Vision (Google AI Studio).

There is no real aura camera — this reads the *colour, light and tone* of a
front-facing selfie into a suggested aura palette. Gemini only sees; Sarvam
writes the reading (`services.aura_reading`) from this plus the user's energy
quiz.

Raw REST call via httpx — same style as `face_vision` / `palm_vision`. The image
is never stored server-side; it lives only in this request.
"""

from __future__ import annotations

import asyncio
import json

import httpx

from app.config import get_settings

settings = get_settings()


class VisionError(RuntimeError):
    pass


AURA_COLORS = [
    "Red",
    "Orange",
    "Yellow",
    "Gold",
    "Green",
    "Teal",
    "Blue",
    "Indigo",
    "Violet",
    "Pink",
    "White",
]

_SCHEMA = {
    "type": "object",
    "properties": {
        "is_face": {"type": "boolean"},
        "image_quality": {"type": "string", "enum": ["good", "fair", "poor"]},
        "retake_reason": {"type": "string"},
        "dominant_color": {"type": "string", "enum": AURA_COLORS},
        "secondary_colors": {
            "type": "array",
            "items": {"type": "string", "enum": AURA_COLORS},
        },
        "brightness": {"type": "string", "enum": ["dim", "soft", "radiant"]},
        "warmth": {"type": "string", "enum": ["cool", "balanced", "warm"]},
        "visual_notes": {"type": "string"},
    },
    "required": ["is_face", "image_quality", "dominant_color"],
}

_PROMPT = (
    "You are an intuitive aura reader working from a photograph. Look at this "
    "front-facing selfie and read the COLOUR, LIGHT and TONE of the image — the "
    "skin undertone, the clothing and background colours, the warmth or coolness "
    "of the light, how bright or soft it feels. From that overall impression, "
    "choose the aura palette.\n"
    "- is_face: true if a person's face is visible. Only false if there is "
    "clearly no face in the frame.\n"
    "- image_quality / retake_reason: 'good' or 'fair' for a normal handheld "
    "selfie. Use 'poor' ONLY if the frame is almost black, badly blurred, or "
    "the face fills less than a quarter of it; give a short reason.\n"
    "- dominant_color: the single strongest aura colour from the palette.\n"
    "- secondary_colors: 0 to 2 supporting colours, strongest first.\n"
    "- brightness: dim / soft / radiant — how luminous the overall image feels.\n"
    "- warmth: cool / balanced / warm — the colour temperature of the light.\n"
    "- visual_notes: 1-2 sentences describing the colours and light you see "
    "(not a personality reading — just what is visually present).\n"
    "Return JSON only."
)


async def analyze_aura(image_b64: str, mime_type: str = "image/jpeg") -> dict:
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
            "temperature": 0.3,
            "responseMimeType": "application/json",
            "responseSchema": _SCHEMA,
        },
    }

    resp = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                resp = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            if attempt == 2:
                raise VisionError(f"Gemini request failed: {exc}") from exc
            await asyncio.sleep(1.5 * (attempt + 1))
            continue

        if resp.status_code in (500, 502, 503, 529) and attempt < 2:
            await asyncio.sleep(1.5 * (attempt + 1))
            continue
        break

    assert resp is not None
    if resp.status_code == 429:
        raise VisionError("The reading service is busy right now — please try again in a minute.")
    if resp.status_code in (500, 502, 503, 529):
        raise VisionError("The reading service is busy right now — please try again in a moment.")
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
