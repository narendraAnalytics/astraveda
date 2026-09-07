"""Vedic chart computation — server-authoritative, fully self-hosted.

Core chart (Lagna, planets by sign/house/nakshatra, panchanga, Vimshottari
Dasha) is computed directly with the Swiss Ephemeris (`pyswisseph`) using the
Lahiri ayanamsa and whole-sign houses. This is the source of truth the app
renders.

`jyotishyamitra` (also Swiss Ephemeris under the hood) is called opportunistically
for the fuller output — all 16 divisional charts, shadbala, ashtakavarga — which
is stashed as `raw` for later phases. If it is unavailable or errors, the core
chart is unaffected.
"""

from __future__ import annotations

import threading
from datetime import date, datetime, timedelta


def _swe():
    """Import pyswisseph lazily so a missing/broken native build only breaks the
    Kundali endpoint, not the whole API (translate, auth, webhooks)."""
    try:
        import swisseph as swe  # noqa: PLC0415

        return swe
    except Exception as exc:  # pragma: no cover - deploy/build issue
        raise KundaliError(f"Astrology engine unavailable (pyswisseph not loaded): {exc}") from exc

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

# Vimshottari: dasha lord cycle keyed to the nakshatra sequence, and each lord's span.
DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {
    "Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
    "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17,
}
DASHA_TOTAL = 120

TITHIS = [
    "Shukla Pratipada", "Shukla Dwitiya", "Shukla Tritiya", "Shukla Chaturthi",
    "Shukla Panchami", "Shukla Shashthi", "Shukla Saptami", "Shukla Ashtami",
    "Shukla Navami", "Shukla Dashami", "Shukla Ekadashi", "Shukla Dwadashi",
    "Shukla Trayodashi", "Shukla Chaturdashi", "Purnima",
    "Krishna Pratipada", "Krishna Dwitiya", "Krishna Tritiya", "Krishna Chaturthi",
    "Krishna Panchami", "Krishna Shashthi", "Krishna Saptami", "Krishna Ashtami",
    "Krishna Navami", "Krishna Dashami", "Krishna Ekadashi", "Krishna Dwadashi",
    "Krishna Trayodashi", "Krishna Chaturdashi", "Amavasya",
]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# (display name, pyswisseph constant name) — resolved against the module at runtime.
_PLANETS = [
    ("Sun", "SUN"),
    ("Moon", "MOON"),
    ("Mars", "MARS"),
    ("Mercury", "MERCURY"),
    ("Jupiter", "JUPITER"),
    ("Venus", "VENUS"),
    ("Saturn", "SATURN"),
    ("Rahu", "MEAN_NODE"),
]

_NAK_SPAN = 360.0 / 27.0
_SIDEREAL_YEAR_DAYS = 365.2425

# jyotishyamitra keeps birth data in module globals — serialise access.
_JSM_LOCK = threading.Lock()


class KundaliError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _norm360(deg: float) -> float:
    return deg % 360.0


def _sign_index(lon: float) -> int:
    return int(_norm360(lon) // 30)


def _nak_index(lon: float) -> int:
    return int(_norm360(lon) // _NAK_SPAN)


def _pada(lon: float) -> int:
    within = _norm360(lon) % _NAK_SPAN
    return int(within // (_NAK_SPAN / 4)) + 1


def _dms(lon: float) -> str:
    within = _norm360(lon) % 30
    d = int(within)
    m = int((within - d) * 60)
    return f"{d}°{m:02d}'"


def _julian_day_ut(swe, d: date, hour: float, minute: float, tz_offset: float) -> float:
    ut = hour + minute / 60.0 - tz_offset
    return swe.julday(d.year, d.month, d.day, ut, swe.GREG_CAL)


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def _compute_core(
    *,
    birth_date: date,
    hour: int,
    minute: int,
    latitude: float,
    longitude: float,
    tz_offset: float,
) -> dict:
    swe = _swe()
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    flags = swe.FLG_SIDEREAL | swe.FLG_SPEED | swe.FLG_MOSEPH
    jd = _julian_day_ut(swe, birth_date, hour, minute, tz_offset)

    ayanamsa = swe.get_ayanamsa_ut(jd)

    # Ascendant (Lagna) with whole-sign houses.
    cusps, ascmc = swe.houses_ex(jd, latitude, longitude, b"W", swe.FLG_SIDEREAL)
    asc_lon = _norm360(ascmc[0])
    lagna_sign = _sign_index(asc_lon)

    planets: list[dict] = []
    positions: dict[str, float] = {}
    for name, const_name in _PLANETS:
        code = getattr(swe, const_name)
        (lon, _lat, _dist, speed, *_), _flag = swe.calc_ut(jd, code, flags)
        lon = _norm360(lon)
        positions[name] = lon
        sign = _sign_index(lon)
        planets.append(
            {
                "name": name,
                "longitude": round(lon, 4),
                "sign": SIGNS[sign],
                "sign_index": sign,
                "degree": _dms(lon),
                "house": ((sign - lagna_sign) % 12) + 1,
                "nakshatra": NAKSHATRAS[_nak_index(lon)],
                "pada": _pada(lon),
                "retrograde": bool(speed < 0) and name not in ("Sun", "Moon", "Rahu"),
            }
        )

    # Ketu = 180° from Rahu.
    ketu_lon = _norm360(positions["Rahu"] + 180.0)
    positions["Ketu"] = ketu_lon
    ketu_sign = _sign_index(ketu_lon)
    planets.append(
        {
            "name": "Ketu",
            "longitude": round(ketu_lon, 4),
            "sign": SIGNS[ketu_sign],
            "sign_index": ketu_sign,
            "degree": _dms(ketu_lon),
            "house": ((ketu_sign - lagna_sign) % 12) + 1,
            "nakshatra": NAKSHATRAS[_nak_index(ketu_lon)],
            "pada": _pada(ketu_lon),
            "retrograde": True,
        }
    )

    moon_lon = positions["Moon"]
    sun_lon = positions["Sun"]

    # Panchanga essentials.
    tithi_index = int(_norm360(moon_lon - sun_lon) // 12)
    nak_index = _nak_index(moon_lon)
    weekday = WEEKDAYS[int(jd + 0.5) % 7]  # JD 0.0 was a Monday noon

    houses = [
        {
            "house": i + 1,
            "sign": SIGNS[(lagna_sign + i) % 12],
            "sign_index": (lagna_sign + i) % 12,
            "planets": [p["name"] for p in planets if p["house"] == i + 1],
        }
        for i in range(12)
    ]

    dasha = _vimshottari(moon_lon, birth_date)

    return {
        "meta": {
            "ayanamsa": round(ayanamsa, 4),
            "ayanamsa_name": "Lahiri",
            "house_system": "Whole Sign",
            "julian_day_ut": jd,
        },
        "lagna": {
            "sign": SIGNS[lagna_sign],
            "sign_index": lagna_sign,
            "degree": _dms(asc_lon),
            "nakshatra": NAKSHATRAS[_nak_index(asc_lon)],
        },
        "avakhada": {
            "varna": _VARNA[lagna_sign % 4],
            "rashi": SIGNS[_sign_index(moon_lon)],
            "rashi_lord": _SIGN_LORD[_sign_index(moon_lon)],
            "nakshatra": NAKSHATRAS[nak_index],
            "nakshatra_pada": _pada(moon_lon),
            "nakshatra_lord": DASHA_LORDS[nak_index % 9],
            "tithi": TITHIS[tithi_index] if tithi_index < len(TITHIS) else "—",
            "yoga_index": int(_norm360(moon_lon + sun_lon) // _NAK_SPAN) + 1,
            "karana_index": int(_norm360(moon_lon - sun_lon) // 6) + 1,
            "sun_sign": SIGNS[_sign_index(sun_lon)],
            "moon_sign": SIGNS[_sign_index(moon_lon)],
        },
        "panchanga": {
            "vaara": weekday,
            "tithi": TITHIS[tithi_index] if tithi_index < len(TITHIS) else "—",
            "nakshatra": NAKSHATRAS[nak_index],
        },
        "planets": planets,
        "houses": houses,
        "vimshottari": dasha,
    }


_VARNA = ["Kshatriya", "Vaishya", "Shudra", "Brahmin"]
_SIGN_LORD = [
    "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
]


def _add_years(start: datetime, years: float) -> datetime:
    return start + timedelta(days=years * _SIDEREAL_YEAR_DAYS)


def _vimshottari(moon_lon: float, birth_date: date) -> dict:
    """Full Mahadasha timeline from birth, plus Antardasha for the running Maha."""
    nak = _nak_index(moon_lon)
    start_lord_idx = nak % 9
    frac_elapsed = (_norm360(moon_lon) % _NAK_SPAN) / _NAK_SPAN

    birth_dt = datetime(birth_date.year, birth_date.month, birth_date.day)
    today = datetime.utcnow()

    periods: list[dict] = []
    cursor = birth_dt
    # First (partial) Mahadasha: only the un-elapsed balance.
    first_years = DASHA_YEARS[DASHA_LORDS[start_lord_idx]] * (1 - frac_elapsed)
    for step in range(9):
        lord = DASHA_LORDS[(start_lord_idx + step) % 9]
        span = first_years if step == 0 else DASHA_YEARS[lord]
        end = _add_years(cursor, span)
        periods.append(
            {
                "lord": lord,
                "start": cursor.date().isoformat(),
                "end": end.date().isoformat(),
                "years": round(span, 2),
            }
        )
        cursor = end

    current_idx = next(
        (i for i, p in enumerate(periods)
         if p["start"] <= today.date().isoformat() < p["end"]),
        None,
    )

    antardasha: list[dict] = []
    if current_idx is not None:
        maha = periods[current_idx]
        maha_lord = maha["lord"]
        maha_start = datetime.fromisoformat(maha["start"])
        maha_span_years = DASHA_YEARS[maha_lord]
        lord_pos = DASHA_LORDS.index(maha_lord)
        sub_cursor = maha_start
        for k in range(9):
            sub_lord = DASHA_LORDS[(lord_pos + k) % 9]
            sub_years = maha_span_years * DASHA_YEARS[sub_lord] / DASHA_TOTAL
            # For the partial first Mahadasha the earliest antardashas are already
            # spent before birth; clip them so the timeline starts at birth.
            sub_end = _add_years(sub_cursor, sub_years)
            if sub_end > maha_start and sub_end > birth_dt:
                antardasha.append(
                    {
                        "lord": sub_lord,
                        "start": max(sub_cursor, birth_dt).date().isoformat(),
                        "end": sub_end.date().isoformat(),
                    }
                )
            sub_cursor = sub_end

    current_antar = next(
        (a for a in antardasha
         if a["start"] <= today.date().isoformat() < a["end"]),
        None,
    )

    return {
        "balance_at_birth": {
            "lord": DASHA_LORDS[start_lord_idx],
            "years": round(first_years, 2),
        },
        "mahadasha": periods,
        "current": {
            "mahadasha": periods[current_idx]["lord"] if current_idx is not None else None,
            "antardasha": current_antar["lord"] if current_antar else None,
        },
        "antardasha": antardasha,
    }


# ---------------------------------------------------------------------------
# Optional: jyotishyamitra full output (divisional charts, shadbala, …)
# ---------------------------------------------------------------------------

def _compute_raw(
    *,
    name: str,
    birth_date: date,
    hour: int,
    minute: int,
    latitude: float,
    longitude: float,
    tz_offset: float,
) -> dict | None:
    try:
        import jyotishyamitra as jsm  # noqa: PLC0415  (optional, heavy import)
    except Exception:  # pragma: no cover - library not installed
        return None

    try:
        with _JSM_LOCK:
            jsm.clear_birthdata()
            jsm.input_birthdata(
                name=name or "Seeker",
                gender="others",
                year=str(birth_date.year),
                month=str(birth_date.month),
                day=str(birth_date.day),
                hour=str(hour),
                min=str(minute),
                sec="0",
                place="birthplace",
                longitude=f"{longitude:+.4f}",
                lattitude=f"{latitude:+.4f}",
                timezone=f"{tz_offset:+.2f}",
            )
            jsm.validate_birthdata()
            if not jsm.IsBirthdataValid():
                return None
            bd = jsm.get_birthdata()
            data = jsm.generate_astrologicalData(bd, returnval="ASTRODATA_DICTIONARY")
        return data if isinstance(data, dict) else None
    except Exception:  # pragma: no cover - never let the extra output break generation
        return None


# ---------------------------------------------------------------------------
# Public entrypoint (sync — call via anyio.to_thread from the router)
# ---------------------------------------------------------------------------

def compute_chart(
    *,
    name: str,
    birth_date: date,
    hour: int,
    minute: int,
    latitude: float,
    longitude: float,
    tz_offset: float,
    include_raw: bool = True,
) -> tuple[dict, dict | None]:
    try:
        core = _compute_core(
            birth_date=birth_date,
            hour=hour,
            minute=minute,
            latitude=latitude,
            longitude=longitude,
            tz_offset=tz_offset,
        )
    except Exception as exc:  # noqa: BLE001
        raise KundaliError(f"Chart computation failed: {exc}") from exc

    raw = (
        _compute_raw(
            name=name,
            birth_date=birth_date,
            hour=hour,
            minute=minute,
            latitude=latitude,
            longitude=longitude,
            tz_offset=tz_offset,
        )
        if include_raw
        else None
    )
    return core, raw
