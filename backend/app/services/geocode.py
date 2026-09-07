"""City search via Open-Meteo's free geocoding API (no key required).

Turns a typed place name into candidates carrying latitude, longitude and an
IANA timezone — everything the chart engine needs for the birthplace.
Docs: https://open-meteo.com/en/docs/geocoding-api
"""

from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()


class GeocodeError(RuntimeError):
    pass


def _label(row: dict) -> str:
    parts = [row.get("name")]
    admin1 = row.get("admin1")
    country = row.get("country")
    if admin1 and admin1 != row.get("name"):
        parts.append(admin1)
    if country:
        parts.append(country)
    return ", ".join(p for p in parts if p)


async def search_places(query: str, count: int = 6) -> list[dict]:
    query = query.strip()
    if len(query) < 2:
        return []

    params = {"name": query, "count": count, "language": "en", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(settings.geocoding_url, params=params)
    except httpx.HTTPError as exc:  # network / DNS / timeout
        raise GeocodeError(f"Geocoding request failed: {exc}") from exc

    if resp.status_code != 200:
        raise GeocodeError(f"Geocoding {resp.status_code}: {resp.text[:200]}")

    results = resp.json().get("results") or []
    out: list[dict] = []
    for row in results:
        if row.get("latitude") is None or row.get("longitude") is None:
            continue
        out.append(
            {
                "label": _label(row),
                "name": row.get("name"),
                "admin1": row.get("admin1"),
                "country": row.get("country"),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "timezone": row.get("timezone") or "UTC",
            }
        )
    return out
