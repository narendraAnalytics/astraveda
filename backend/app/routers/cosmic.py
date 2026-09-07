"""Today's Cosmic Guidance — the daily panchang widget on the app home screen.

Public (no auth): it is the same for everyone at a given location, not user
data. Computed once per day per rounded lat/lon and cached in Neon.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import PanchangCache
from app.services import cosmic

router = APIRouter(prefix="/cosmic", tags=["cosmic"])

# Recompute a cache row at most once every 12h (covers date rollover in any tz).
_TTL = timedelta(hours=12)


@router.get("/today")
async def cosmic_today(
    db: Session = Depends(get_session),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    tz: str | None = Query(default=None, max_length=64),
    place: str | None = Query(default=None, max_length=120),
) -> dict:
    if (lat is None) != (lon is None):
        raise HTTPException(status_code=422, detail="Pass both lat and lon, or neither.")

    loc = cosmic.DEFAULT_LOCATION
    key_lat = loc["lat"] if lat is None else round(lat, 3)
    key_lon = loc["lon"] if lon is None else round(lon, 3)
    today = datetime.now(timezone.utc).date().isoformat()
    cache_key = f"{today}|{key_lat}|{key_lon}"

    row = db.exec(select(PanchangCache).where(PanchangCache.cache_key == cache_key)).first()
    if row and datetime.utcnow() - row.created_at < _TTL:
        return row.payload

    try:
        payload = await anyio.to_thread.run_sync(
            lambda: cosmic.compute_cosmic_guidance(lat=lat, lon=lon, tz=tz, place_name=place)
        )
    except Exception as exc:  # noqa: BLE001 - engine/deploy issue
        if row:
            return row.payload  # stale is better than nothing
        raise HTTPException(status_code=503, detail=f"Guidance engine unavailable: {exc}") from exc

    if row:
        row.payload = payload
        row.created_at = datetime.utcnow()
        db.add(row)
    else:
        db.add(PanchangCache(cache_key=cache_key, payload=payload))
    try:
        db.commit()
    except Exception:  # noqa: BLE001 - lost a race with a concurrent request; fine
        db.rollback()
    return payload
