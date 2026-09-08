"""Vastu Shastra room analysis via Gemini Vision (Google AI Studio).

One multimodal call: the room photo + the user's facing direction + room type ->
a structured Vastu read (score, elemental balance, doshas, non-demolition
remedies). Gemini does the whole analysis here — no Sarvam step in v1.

Raw REST call via httpx — same style as the other *_vision services. The image
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


ELEMENTS = ["Fire", "Water", "Earth", "Air", "Space"]
ROOM_TYPES = ["Entrance", "Living", "Kitchen", "Bedroom", "Pooja", "Bathroom", "Study", "Other"]
DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "Unknown"]

_SCHEMA = {
    "type": "object",
    "properties": {
        "is_room": {"type": "boolean"},
        "image_quality": {"type": "string", "enum": ["good", "fair", "poor"]},
        "retake_reason": {"type": "string"},
        "score": {"type": "integer"},
        "verdict": {"type": "string"},
        "elements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "element": {"type": "string", "enum": ELEMENTS},
                    "state": {"type": "string", "enum": ["strong", "balanced", "weak", "afflicted"]},
                    "note": {"type": "string"},
                },
                "required": ["element", "state", "note"],
            },
        },
        "doshas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "issue": {"type": "string"},
                    "severity": {"type": "string", "enum": ["minor", "moderate", "major"]},
                },
                "required": ["issue", "severity"],
            },
        },
        "remedies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "remedy": {"type": "string"},
                    "fixes": {"type": "string"},
                    "ease": {"type": "string", "enum": ["easy", "moderate"]},
                },
                "required": ["remedy", "fixes", "ease"],
            },
        },
        "summary": {"type": "string"},
        "guidance": {"type": "string"},
    },
    "required": ["is_room", "image_quality", "score", "verdict"],
}


def _prompt(*, room_type: str, direction: str) -> str:
    dir_txt = "an unknown direction" if direction == "Unknown" else f"the {direction} direction"
    return (
        "You are a Vastu Shastra consultant analysing a photograph of a room. "
        f"The occupant says this is their {room_type.lower()} and that it faces "
        f"{dir_txt}. Assess it against classical Vastu principles for that room "
        "type and direction — the placement of the door, windows, heavy "
        "furniture, mirrors, water sources, the cooking/fire zone, colours, "
        "clutter and light.\n"
        "- is_room: true if the image shows an interior space. False only if it "
        "clearly shows something else.\n"
        "- image_quality / retake_reason: 'good' or 'fair' for a normal room "
        "photo. 'poor' only if it is too dark or blurred to make anything out.\n"
        "- score: 0-100 overall Vastu harmony for this room in this direction.\n"
        "- verdict: one encouraging sentence summarising the score.\n"
        "- elements: for each of Fire, Water, Earth, Air, Space, a state and a "
        "short note on how that element sits in this room.\n"
        "- doshas: the Vastu defects you can actually see, each with a severity. "
        "Empty list if the room is largely in order.\n"
        "- remedies (upay): practical, NON-DEMOLITION fixes only — a sea-salt "
        "bowl, an Om or Swastik symbol, a mirror or plant moved, a colour, a "
        "furniture shift, better light. For each: the remedy, what it fixes, and "
        "how easy it is.\n"
        "- summary: 2-3 warm sentences on the room's overall energy.\n"
        "- guidance: 2-3 sentences of gentle priority advice.\n"
        "Never tell the occupant to demolish or rebuild, never use fear, never "
        "predict disaster. Return JSON only."
    )


async def analyze_room(
    image_b64: str,
    *,
    room_type: str,
    direction: str,
    mime_type: str = "image/jpeg",
) -> dict:
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
                    {"text": _prompt(room_type=room_type, direction=direction)},
                    {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": _SCHEMA,
        },
    }

    resp = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
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
        raise VisionError("The analysis service is busy right now — please try again in a minute.")
    if resp.status_code in (500, 502, 503, 529):
        raise VisionError("The analysis service is busy right now — please try again in a moment.")
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
