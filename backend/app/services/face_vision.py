"""Face image analysis via Gemini Vision (Google AI Studio).

Mukha Samudrika Shastra (Vedic face reading / physiognomy). Gemini only *sees*
the face and returns structured features (face shape, forehead, eyes, nose,
lips, chin/jaw, the three zones, marks). The narrative reading is written by
Sarvam from those features (`services.face_reading`).

Raw REST call via httpx — no SDK dependency, same style as `palm_vision`. The
image is never stored server-side; it lives only in this request.
"""

from __future__ import annotations

import asyncio
import json

import httpx

from app.config import get_settings

settings = get_settings()


class VisionError(RuntimeError):
    pass


# Values must line up with app.routers.face option sets.
_SCHEMA = {
    "type": "object",
    "properties": {
        "is_face": {"type": "boolean"},
        "image_quality": {"type": "string", "enum": ["good", "fair", "poor"]},
        "retake_reason": {"type": "string"},
        "gender_presentation": {"type": "string", "enum": ["Female", "Male", "Unclear"]},
        "face_shape": {
            "type": "string",
            "enum": ["Oval", "Round", "Square", "Oblong", "Heart", "Diamond", "Unknown"],
        },
        "forehead": {"type": "string"},
        "eyebrows": {"type": "string"},
        "eyes": {"type": "string"},
        "nose": {"type": "string"},
        "lips": {"type": "string"},
        "cheeks": {"type": "string"},
        "chin_jaw": {"type": "string"},
        "ears": {"type": "string"},
        "three_zones": {"type": "string"},
        "marks": {"type": "array", "items": {"type": "string"}},
        "observations": {"type": "string"},
    },
    "required": ["is_face", "image_quality", "face_shape"],
}

_PROMPT = (
    "You are a Mukha Samudrika Shastra (Vedic face reading) analyst. Look at "
    "this photograph of a person's face and describe what is VISIBLE — do not "
    "invent detail you cannot see.\n"
    "- is_face: true if a human face looking roughly toward the camera is "
    "visible. Only false if the image clearly shows something else — no face, "
    "the back of a head, or a face turned fully away.\n"
    "- image_quality / retake_reason: 'good' or 'fair' for a normal handheld "
    "phone selfie in ordinary light. Use 'poor' ONLY when the features truly "
    "cannot be made out (severe blur, near-darkness, face fills less than a "
    "third of the frame, or heavy sunglasses/mask covering most of the face); "
    "give a short reason. Do not demand studio lighting.\n"
    "- face_shape: overall geometric shape (Oval, Round, Square, Oblong, Heart, "
    "Diamond).\n"
    "- forehead / eyebrows / eyes / nose / lips / cheeks / chin_jaw / ears: one "
    "short phrase each for how that feature looks (e.g. 'broad and high', "
    "'thick, well-defined arch', 'wide-set, almond-shaped', 'straight bridge, "
    "rounded tip', 'full and even', 'high cheekbones', 'firm rounded chin, "
    "moderate jaw', 'medium, close to the head'). Use 'not clearly visible' if "
    "you cannot tell.\n"
    "- three_zones: one sentence on the balance of the upper (forehead), middle "
    "(brow to nose tip) and lower (nose tip to chin) thirds of the face — which "
    "look longer or more dominant.\n"
    "- marks: note any prominent moles, dimples, scars, or a distinct widow's "
    "peak and roughly where. Empty list if none stand out.\n"
    "- observations: 1-2 sentences of overall impression.\n"
    "Return JSON only."
)


async def analyze_face(image_b64: str, mime_type: str = "image/jpeg") -> dict:
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

    # The free tier returns 503 (overloaded) / 500 intermittently — retry those a
    # couple of times server-side so a blip never reaches the user. 429 (real
    # quota) is not retried.
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
