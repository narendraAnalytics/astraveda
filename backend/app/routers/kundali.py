"""Vedic Kundali — geocoding, chart generation, and the AI reading.

Two-phase by design: `POST /kundali/generate` returns the computed chart fast;
the app renders it immediately and then calls `POST /kundali/{id}/reading` for
the (slower) Sarvam narrative. Everything is persisted so re-opening is instant.
"""

from __future__ import annotations

from datetime import date, datetime, time
from uuid import UUID
from zoneinfo import ZoneInfo

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.db import get_session
from app.models import Kundali, User
from app.services import geocode, kundali as kundali_engine, reading

router = APIRouter(prefix="/kundali", tags=["kundali"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PlaceOut(BaseModel):
    label: str
    name: str | None = None
    admin1: str | None = None
    country: str | None = None
    latitude: float
    longitude: float
    timezone: str


class GenerateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    birth_date: date
    birth_time: time = time(12, 0)
    unknown_time: bool = False
    birth_place: str = Field(min_length=1, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str = Field(min_length=1, max_length=64)


class KundaliOut(BaseModel):
    id: str
    name: str
    birth_date: date
    birth_time: time
    unknown_time: bool
    birth_place: str
    latitude: float
    longitude: float
    timezone: str
    chart: dict
    reading_en: str | None
    created_at: datetime

    @classmethod
    def of(cls, k: Kundali) -> "KundaliOut":
        return cls(
            id=str(k.id),
            name=k.name,
            birth_date=k.birth_date,
            birth_time=k.birth_time,
            unknown_time=k.unknown_time,
            birth_place=k.birth_place,
            latitude=k.latitude,
            longitude=k.longitude,
            timezone=k.timezone,
            chart=k.chart,
            reading_en=k.reading_en,
            created_at=k.created_at,
        )


class ReadingOut(BaseModel):
    reading_en: str
    cached: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tz_offset_hours(tz_name: str, d: date, t: time) -> float:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:  # unknown tz → assume UTC
        return 0.0
    dt = datetime(d.year, d.month, d.day, t.hour, t.minute, tzinfo=tz)
    off = dt.utcoffset()
    return off.total_seconds() / 3600 if off else 0.0


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/geocode", response_model=list[PlaceOut])
async def geocode_place(
    q: str = Query(min_length=2, max_length=120),
) -> list[PlaceOut]:
    # No auth: this is a plain public city lookup (Open-Meteo) with no user data,
    # and keeping it unauthenticated means the birth-place autocomplete keeps
    # working even if a token/config issue would block the rest of the flow.
    try:
        rows = await geocode.search_places(q)
    except geocode.GeocodeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return [PlaceOut(**row) for row in rows]


@router.post("/generate", response_model=KundaliOut)
async def generate_kundali(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> KundaliOut:
    birth_time = time(12, 0) if body.unknown_time else body.birth_time
    tz_offset = _tz_offset_hours(body.timezone, body.birth_date, birth_time)

    try:
        chart, raw = await anyio.to_thread.run_sync(
            lambda: kundali_engine.compute_chart(
                name=body.name,
                birth_date=body.birth_date,
                hour=birth_time.hour,
                minute=birth_time.minute,
                latitude=body.latitude,
                longitude=body.longitude,
                tz_offset=tz_offset,
            )
        )
    except kundali_engine.KundaliError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    row = Kundali(
        user_id=user.id,
        name=body.name.strip(),
        birth_date=body.birth_date,
        birth_time=birth_time,
        unknown_time=body.unknown_time,
        birth_place=body.birth_place.strip(),
        latitude=body.latitude,
        longitude=body.longitude,
        timezone=body.timezone,
        tz_offset=tz_offset,
        chart=chart,
        raw=raw,
    )
    session.add(row)

    # Mirror the birth details onto the profile so next time is one-tap confirm.
    user.date_of_birth = body.birth_date
    user.birth_time = None if body.unknown_time else birth_time
    user.birth_place = body.birth_place.strip()
    user.timezone = body.timezone
    user.updated_at = datetime.utcnow()
    session.add(user)

    session.commit()
    session.refresh(row)
    return KundaliOut.of(row)


@router.get("", response_model=KundaliOut)
async def latest_kundali(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> KundaliOut:
    row = session.exec(
        select(Kundali)
        .where(Kundali.user_id == user.id)
        .order_by(Kundali.created_at.desc())
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No kundali generated yet")
    return KundaliOut.of(row)


def _get_owned(session: Session, user: User, kundali_id: str) -> Kundali:
    try:
        kid = UUID(kundali_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Kundali not found") from exc
    row = session.get(Kundali, kid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Kundali not found")
    return row


@router.get("/{kundali_id}", response_model=KundaliOut)
async def get_kundali(
    kundali_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> KundaliOut:
    return KundaliOut.of(_get_owned(session, user, kundali_id))


@router.post("/{kundali_id}/reading", response_model=ReadingOut)
async def kundali_reading(
    kundali_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingOut:
    row = _get_owned(session, user, kundali_id)
    if row.reading_en:
        return ReadingOut(reading_en=row.reading_en, cached=True)

    try:
        text = await reading.generate_reading(row.name, row.chart)
    except reading.ReadingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    row.reading_en = text
    session.add(row)
    session.commit()
    return ReadingOut(reading_en=text, cached=False)
