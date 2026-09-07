"""Today's Cosmic Guidance — the daily panchang widget on the app home screen.

Self-hosted, same principle as the Kundali engine: real astronomy via
`pyswisseph` (Moshier model, no ephemeris files), no third-party panchang API.

What is computed from real sunrise/sunset for the given place and date:
  * Rahu Kalam, Gulika Kalam, Yamaganda  — the weekday eighth-part of the day
  * Abhijit Muhurat ("best time")         — the 8th of 15 daytime muhurtas
  * Tithi + Nakshatra                     — Moon/Sun sidereal (Lahiri)

Lucky colour, mantra and the blessing line are an editorial mapping keyed to
the weekday's ruling planet — every panchang does this, there is no API for it.
The point of this module is that the *weekday* comes from the real date, not a
phone clock, and the timings are real.

This view is deliberately NOT personalised — it takes a location only so the
sunrise math is honest; the default is New Delhi.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.services.kundali import _nak_index, _norm360, _swe, NAKSHATRAS, TITHIS

# Default reference location for the "overall" guidance.
DEFAULT_LOCATION = {"name": "New Delhi", "lat": 28.6139, "lon": 77.2090, "tz": "Asia/Kolkata"}

# Python's date.weekday(): Monday=0 .. Sunday=6.
# Eighth-part of the day (1..8 from sunrise) that each kaala occupies per weekday.
_RAHU_PART = {0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3, 6: 8}
_GULIKA_PART = {0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 7}
_YAMA_PART = {0: 4, 1: 3, 2: 2, 3: 1, 4: 7, 5: 6, 6: 5}

_WEEKDAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Weekday -> ruling planet + editorial colour / mantra / blessing.
_DAY: dict[int, dict] = {
    0: {
        "planet": "Moon",
        "color": {"name": "Moonlit Silver", "tint": "#8b93a3", "bg": "#eef0f4"},
        "mantra": {"text": "Om Namah Shivaya", "deity": "Shiva"},
        "blessing": {
            "title": "May Lord Shiva still every restless thought",
            "body": "and hold your mind in a calm, clear light.",
            "reveal": "Move gently today — what is truly yours will keep.",
        },
    },
    1: {
        "planet": "Mars",
        "color": {"name": "Coral Red", "tint": "#e0664a", "bg": "#fdeae6"},
        "mantra": {"text": "Om Hanumate Namah", "deity": "Hanuman"},
        "blessing": {
            "title": "May Lord Hanuman lend you his courage",
            "body": "and the strength to carry what the day asks.",
            "reveal": "Face the hard thing first; the rest will soften.",
        },
    },
    2: {
        "planet": "Mercury",
        "color": {"name": "Emerald Green", "tint": "#2fa268", "bg": "#e7f6ec"},
        "mantra": {"text": "Om Gam Ganapataye Namah", "deity": "Ganesha"},
        "blessing": {
            "title": "May Lord Ganesha remove all obstacles",
            "body": "and fill your day with wisdom and joy.",
            "reveal": "Pause, breathe, and trust the path opening before you.",
        },
    },
    3: {
        "planet": "Jupiter",
        "color": {"name": "Golden Yellow", "tint": "#d9a521", "bg": "#fdf3d9"},
        "mantra": {"text": "Om Namo Bhagavate Vasudevaya", "deity": "Vishnu"},
        "blessing": {
            "title": "May Lord Vishnu keep your path steady",
            "body": "and your choices wise and unhurried.",
            "reveal": "Say yes slowly today; clarity is on its way.",
        },
    },
    4: {
        "planet": "Venus",
        "color": {"name": "Rose Pink", "tint": "#db5d8c", "bg": "#fdeaf1"},
        "mantra": {"text": "Om Shreem Mahalakshmyai Namah", "deity": "Lakshmi"},
        "blessing": {
            "title": "May Goddess Lakshmi bless your efforts",
            "body": "with abundance, grace, and warm company.",
            "reveal": "Tend what you already have — it is quietly growing.",
        },
    },
    5: {
        "planet": "Saturn",
        "color": {"name": "Deep Indigo", "tint": "#5b5fa8", "bg": "#e9e9f5"},
        "mantra": {"text": "Om Sham Shanaishcharaya Namah", "deity": "Shani"},
        "blessing": {
            "title": "May Lord Shani reward your patience",
            "body": "and turn honest work into lasting ground.",
            "reveal": "Go slow and do it right; time is on your side.",
        },
    },
    6: {
        "planet": "Sun",
        "color": {"name": "Saffron Orange", "tint": "#e08a1e", "bg": "#fdeeda"},
        "mantra": {"text": "Om Suryaya Namah", "deity": "Surya"},
        "blessing": {
            "title": "May Lord Surya light your purpose",
            "body": "and give your day energy and confidence.",
            "reveal": "Begin the bold thing now, while the light is with you.",
        },
    },
}


def _fmt(dt: datetime) -> str:
    """'7:39 AM' — strip the leading zero portably (no %-I on Windows)."""
    return dt.strftime("%I:%M %p").lstrip("0")


def _jd_from_utc(swe, dt_utc: datetime) -> float:
    return swe.julday(
        dt_utc.year,
        dt_utc.month,
        dt_utc.day,
        dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600,
        swe.GREG_CAL,
    )


def _utc_from_jd(swe, jd: float) -> datetime:
    y, m, d, h = swe.revjul(jd, swe.GREG_CAL)
    day = datetime(y, m, d, tzinfo=timezone.utc)
    return day + timedelta(hours=h)


def _sun_event(swe, jd_start: float, lon: float, lat: float, rise: bool) -> float:
    rsmi = (swe.CALC_RISE if rise else swe.CALC_SET)
    res, tret = swe.rise_trans(jd_start, swe.SUN, rsmi, (lon, lat, 0.0), 0.0, 0.0, swe.FLG_MOSEPH)
    if res < 0 or not tret:
        raise RuntimeError("sunrise/sunset unavailable")
    return tret[0]


def _window(start: datetime, end: datetime, label: str) -> dict:
    return {"label": label, "start": _fmt(start), "end": _fmt(end)}


def compute_cosmic_guidance(
    *,
    on: date | None = None,
    lat: float | None = None,
    lon: float | None = None,
    tz: str | None = None,
    place_name: str | None = None,
) -> dict:
    loc_lat = DEFAULT_LOCATION["lat"] if lat is None else lat
    loc_lon = DEFAULT_LOCATION["lon"] if lon is None else lon
    loc_tz = tz or DEFAULT_LOCATION["tz"]
    loc_name = place_name or (DEFAULT_LOCATION["name"] if lat is None else "Your location")

    try:
        zone = ZoneInfo(loc_tz)
    except Exception:
        zone = ZoneInfo(DEFAULT_LOCATION["tz"])
        loc_tz = DEFAULT_LOCATION["tz"]

    day = on or datetime.now(zone).date()
    wd = day.weekday()
    meta = _DAY[wd]

    swe = _swe()

    local_midnight = datetime(day.year, day.month, day.day, tzinfo=zone)
    jd_start = _jd_from_utc(swe, local_midnight.astimezone(timezone.utc))
    jd_noon = _jd_from_utc(swe, (local_midnight + timedelta(hours=12)).astimezone(timezone.utc))

    # --- Panchanga: tithi + nakshatra at local noon (sidereal, Lahiri) ---
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    sflags = swe.FLG_SIDEREAL | swe.FLG_MOSEPH
    moon_lon = _norm360(swe.calc_ut(jd_noon, swe.MOON, sflags)[0][0])
    sun_lon = _norm360(swe.calc_ut(jd_noon, swe.SUN, sflags)[0][0])
    tithi_index = int(_norm360(moon_lon - sun_lon) // 12)
    tithi = TITHIS[tithi_index] if tithi_index < len(TITHIS) else "—"
    nakshatra = NAKSHATRAS[_nak_index(moon_lon)]

    # --- Sunrise / sunset -> the day's inauspicious/auspicious windows ---
    try:
        sunrise = _utc_from_jd(swe, _sun_event(swe, jd_start, loc_lon, loc_lat, rise=True)).astimezone(zone)
        sunset = _utc_from_jd(swe, _sun_event(swe, jd_start, loc_lon, loc_lat, rise=False)).astimezone(zone)
        if sunset <= sunrise:
            sunset = _utc_from_jd(
                swe, _sun_event(swe, jd_start + 0.25, loc_lon, loc_lat, rise=False)
            ).astimezone(zone)
        approximate = False
    except Exception:
        sunrise = local_midnight + timedelta(hours=6)
        sunset = local_midnight + timedelta(hours=18)
        approximate = True

    day_len = sunset - sunrise
    part = day_len / 8
    muhurta = day_len / 15

    def part_window(idx: int, label: str) -> dict:
        s = sunrise + part * (idx - 1)
        return _window(s, s + part, label)

    rahu = part_window(_RAHU_PART[wd], "Rahu Kalam")
    gulika = part_window(_GULIKA_PART[wd], "Gulika Kalam")
    yama = part_window(_YAMA_PART[wd], "Yamaganda")

    abhijit_start = sunrise + muhurta * 7
    best_time = _window(abhijit_start, abhijit_start + muhurta, "Abhijit Muhurat")

    return {
        "date": day.isoformat(),
        "weekday": _WEEKDAY_NAME[wd],
        "planet": meta["planet"],
        "location": {"name": loc_name, "lat": round(loc_lat, 3), "lon": round(loc_lon, 3), "tz": loc_tz},
        "approximate": approximate,
        "sunrise": _fmt(sunrise),
        "sunset": _fmt(sunset),
        "tithi": tithi,
        "nakshatra": nakshatra,
        "lucky_color": meta["color"],
        "mantra": meta["mantra"],
        "blessing": meta["blessing"],
        "rahu_kalam": rahu,
        "gulika_kalam": gulika,
        "yamaganda": yama,
        "best_time": best_time,
    }
