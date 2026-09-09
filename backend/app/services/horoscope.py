"""Daily Horoscope — one short reading per Moon sign (Rashi), refreshed daily.

Self-hosted, same principle as the Cosmic Guidance widget: the *facts* of the
day (weekday ruling planet, tithi, nakshatra) come from the real `cosmic`
engine; Sarvam only turns them into a warm sentence or two per sign. There is no
third-party horoscope API.

Cost control: `generate_all()` is ONE Sarvam call that returns all 12 signs.
The router calls it at most once per day (first request), then serves the Neon
cache. `settings.horoscope_autogen == False` disables the call completely — the
app then falls back to `local_horoscope()`, which needs no network.
"""

from __future__ import annotations

import json
import re
import time as _time
from datetime import date, datetime
from zoneinfo import ZoneInfo

import anyio
import httpx

from app.config import get_settings
from app.services import cosmic

settings = get_settings()

IST = ZoneInfo("Asia/Kolkata")


class HoroscopeError(RuntimeError):
    pass


# Standard zodiac order. `moon_sign` from the Kundali engine uses these exact
# English names, so a saved chart maps straight onto this list.
SIGNS: list[str] = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

# element + ruling planet — used only by the offline fallback text.
_META: dict[str, dict] = {
    "Aries": {"element": "Fire", "ruler": "Mars", "color": "Coral Red", "num": "9"},
    "Taurus": {"element": "Earth", "ruler": "Venus", "color": "Forest Green", "num": "6"},
    "Gemini": {"element": "Air", "ruler": "Mercury", "color": "Lemon Yellow", "num": "5"},
    "Cancer": {"element": "Water", "ruler": "Moon", "color": "Pearl White", "num": "2"},
    "Leo": {"element": "Fire", "ruler": "Sun", "color": "Royal Gold", "num": "1"},
    "Virgo": {"element": "Earth", "ruler": "Mercury", "color": "Sage Green", "num": "5"},
    "Libra": {"element": "Air", "ruler": "Venus", "color": "Soft Rose", "num": "6"},
    "Scorpio": {"element": "Water", "ruler": "Mars", "color": "Deep Maroon", "num": "9"},
    "Sagittarius": {"element": "Fire", "ruler": "Jupiter", "color": "Saffron", "num": "3"},
    "Capricorn": {"element": "Earth", "ruler": "Saturn", "color": "Charcoal Blue", "num": "8"},
    "Aquarius": {"element": "Air", "ruler": "Saturn", "color": "Electric Blue", "num": "8"},
    "Pisces": {"element": "Water", "ruler": "Jupiter", "color": "Sea Green", "num": "3"},
}

_MOODS = ["Grounded", "Hopeful", "Focused", "Reflective", "Energised", "Calm", "Open", "Steady"]


def is_configured() -> bool:
    return bool(settings.sarvam_api_key)


def autogen_enabled() -> bool:
    return bool(settings.horoscope_autogen)


def ist_today() -> date:
    return datetime.now(IST).date()


# ---------------------------------------------------------------------------
# Offline fallback — network-free, deterministic per (sign, date)
# ---------------------------------------------------------------------------

def local_horoscope(sign: str, on: date | None = None) -> dict:
    on = on or ist_today()
    meta = _META[sign]
    # Deterministic pseudo-variety from the date so it isn't identical daily.
    seed = on.toordinal() + SIGNS.index(sign)
    mood = _MOODS[seed % len(_MOODS)]
    ruler = meta["ruler"]
    guidance = (
        f"{ruler}'s influence over {sign} favours a measured pace today. "
        f"Tend to what is already in motion before starting anything new, and "
        f"let a small act of patience settle a matter that has felt unsettled."
    )
    return {
        "sign": sign,
        "date": on.isoformat(),
        "element": meta["element"],
        "ruler": ruler,
        "guidance": guidance,
        "lucky_color": meta["color"],
        "lucky_number": meta["num"],
        "mood": mood,
        "best_time": "Abhijit Muhurat (around midday)",
        "tithi": "",
        "nakshatra": "",
        "source": "fallback",
    }


def local_all(on: date | None = None) -> list[dict]:
    on = on or ist_today()
    return [local_horoscope(s, on) for s in SIGNS]


def row_to_dict(r) -> dict:
    return {
        "sign": r.sign,
        "date": r.date.isoformat(),
        "element": _META.get(r.sign, {}).get("element", ""),
        "ruler": _META.get(r.sign, {}).get("ruler", ""),
        "guidance": r.guidance,
        "lucky_color": r.lucky_color,
        "lucky_number": r.lucky_number,
        "mood": r.mood,
        "best_time": r.best_time,
        "tithi": r.tithi,
        "nakshatra": r.nakshatra,
        "source": r.source,
    }


# ---------------------------------------------------------------------------
# Sarvam — ONE call for all 12 signs
# ---------------------------------------------------------------------------

_SYSTEM = (
    "You are a warm, grounded Vedic astrologer writing the daily horoscope for a "
    "modern mobile app. You will be given today's panchang. Write today's reading "
    "for ALL TWELVE Moon signs (Rashis). Return ONLY a JSON array of exactly 12 "
    "objects, in this sign order: Aries, Taurus, Gemini, Cancer, Leo, Virgo, "
    "Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces. Each object has "
    "these keys:\n"
    '  "sign": the English sign name,\n'
    '  "guidance": 2 to 3 sentences of practical guidance for today, encouraging '
    "and honest, lightly grounded in Vedic language (planetary mood, favourable "
    "or testing phase, timing). No guarantees about money, marriage, jobs, health "
    "or exact events.\n"
    '  "lucky_color": a colour name,\n'
    '  "lucky_number": a single digit 1-9 as a string,\n'
    '  "mood": one word,\n'
    '  "best_time": a short phrase for the most auspicious window today.\n'
    "No markdown, no text outside the JSON array."
)


def _reasoning_effort() -> str | None:
    val = settings.sarvam_reasoning_effort.strip().lower()
    return val if val in {"low", "medium", "high"} else None


def _parse_array(text: str) -> list:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    start, end = t.find("["), t.rfind("]")
    if start != -1 and end != -1 and end > start:
        t = t[start : end + 1]
    return json.loads(t)


def _day_facts(on: date) -> dict:
    """Weekday ruling planet + tithi/nakshatra for `on`, from the cosmic engine.
    Falls back to a bare weekday if the ephemeris is unavailable."""
    try:
        g = cosmic.compute_cosmic_guidance(on=on)
        return {
            "weekday": g["weekday"],
            "planet": g["planet"],
            "tithi": g.get("tithi") or "",
            "nakshatra": g.get("nakshatra") or "",
        }
    except Exception:  # noqa: BLE001
        return {
            "weekday": on.strftime("%A"),
            "planet": "",
            "tithi": "",
            "nakshatra": "",
        }


async def generate_all(on: date | None = None) -> list[dict]:
    """One Sarvam call -> today's horoscope for all 12 signs. Raises
    HoroscopeError on any failure (the caller falls back to `local_all`)."""
    if not settings.sarvam_api_key:
        raise HoroscopeError("SARVAM_API_KEY is not configured on the server")

    on = on or ist_today()
    facts = await anyio.to_thread.run_sync(_day_facts, on)
    user = (
        f"Date: {on.isoformat()} ({facts['weekday']})\n"
        f"Weekday ruling planet: {facts['planet'] or 'unknown'}\n"
        f"Tithi: {facts['tithi'] or 'unknown'}\n"
        f"Nakshatra: {facts['nakshatra'] or 'unknown'}\n"
        "Write today's horoscope for all 12 signs now."
    )

    payload = {
        "model": settings.sarvam_chat_model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
        "reasoning_effort": _reasoning_effort(),
    }
    headers = {
        "Authorization": f"Bearer {settings.sarvam_api_key}",
        "api-subscription-key": settings.sarvam_api_key,
    }
    try:
        async with httpx.AsyncClient(base_url=settings.sarvam_base_url, timeout=90) as client:
            resp = await client.post("/v1/chat/completions", json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise HoroscopeError(f"Sarvam request failed: {exc}") from exc

    if resp.status_code != 200:
        raise HoroscopeError(f"Sarvam {resp.status_code} ({settings.sarvam_chat_model}): {resp.text[:300]}")

    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise HoroscopeError(f"Unexpected Sarvam response: {resp.text[:300]}") from exc

    if not content or not content.strip():
        raise HoroscopeError("Sarvam returned an empty horoscope")

    try:
        arr = _parse_array(content)
    except ValueError as exc:
        raise HoroscopeError(f"Sarvam did not return valid JSON: {content[:300]}") from exc

    by_sign = {}
    for item in arr:
        if not isinstance(item, dict):
            continue
        name = str(item.get("sign") or "").strip().title()
        if name not in _META:
            continue
        by_sign[name] = item

    out: list[dict] = []
    for s in SIGNS:
        item = by_sign.get(s)
        if not item or not str(item.get("guidance") or "").strip():
            out.append(local_horoscope(s, on))
            continue
        out.append({
            "sign": s,
            "date": on.isoformat(),
            "element": _META[s]["element"],
            "ruler": _META[s]["ruler"],
            "guidance": str(item["guidance"]).strip()[:600],
            "lucky_color": str(item.get("lucky_color") or _META[s]["color"]).strip()[:40],
            "lucky_number": (re.sub(r"\D", "", str(item.get("lucky_number") or "")) or _META[s]["num"])[:1],
            "mood": str(item.get("mood") or "Steady").strip()[:24],
            "best_time": str(item.get("best_time") or "Abhijit Muhurat (around midday)").strip()[:80],
            "tithi": facts["tithi"],
            "nakshatra": facts["nakshatra"],
            "source": "ai",
        })
    return out


# ---------------------------------------------------------------------------
# In-process throttle so repeated failed generations don't hammer Sarvam
# ---------------------------------------------------------------------------

_last_attempt: dict[str, float] = {}
_RETRY_AFTER_FAIL_SEC = 600  # 10 minutes


def may_attempt(on: date) -> bool:
    ts = _last_attempt.get(on.isoformat())
    return ts is None or (_time.monotonic() - ts) > _RETRY_AFTER_FAIL_SEC


def mark_attempt(on: date) -> None:
    _last_attempt[on.isoformat()] = _time.monotonic()
