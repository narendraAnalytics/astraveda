"""Daily Horoscope — login-required, free (no payment, no credits).

`GET /horoscope/all`   -> today's reading for all 12 signs
`GET /horoscope?sign=` -> today's reading for one sign

Both are Clerk-JWT protected (the app requires sign-in to view). The content is
NOT user data — it's the same for everyone on a given day — so it's cached in
Neon keyed by (sign, date), written once per day by a single Sarvam call.

Set HOROSCOPE_AUTOGEN=false to stop calling Sarvam: the endpoints then serve the
most recent cached day, falling back to an offline template.
"""

from __future__ import annotations

from datetime import datetime

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.auth import get_current_user
from app.db import get_session
from app.models import Horoscope, User
from app.services import horoscope as svc

router = APIRouter(prefix="/horoscope", tags=["horoscope"])


def _cached_today(session: Session) -> dict[str, Horoscope]:
    today = svc.ist_today()
    rows = session.exec(select(Horoscope).where(Horoscope.date == today)).all()
    return {r.sign: r for r in rows}


def _persist(session: Session, generated: list[dict]) -> None:
    for item in generated:
        try:
            on = datetime.strptime(item["date"], "%Y-%m-%d").date()
        except (ValueError, KeyError):
            continue
        existing = session.exec(
            select(Horoscope).where(Horoscope.sign == item["sign"], Horoscope.date == on)
        ).first()
        row = existing or Horoscope(sign=item["sign"], date=on)
        row.guidance = item.get("guidance", "")
        row.lucky_color = item.get("lucky_color", "")
        row.lucky_number = str(item.get("lucky_number", ""))
        row.mood = item.get("mood", "")
        row.best_time = item.get("best_time", "")
        row.tithi = item.get("tithi", "")
        row.nakshatra = item.get("nakshatra", "")
        row.source = item.get("source", "ai")
        session.add(row)
    try:
        session.commit()
    except Exception:  # noqa: BLE001 — lost a race with a concurrent request; fine
        session.rollback()


async def _all_for_today(session: Session) -> list[dict]:
    today = svc.ist_today()
    cached = _cached_today(session)
    if len(cached) == len(svc.SIGNS):
        return [svc.row_to_dict(cached[s]) for s in svc.SIGNS]

    if svc.is_configured() and svc.autogen_enabled() and svc.may_attempt(today):
        svc.mark_attempt(today)
        try:
            generated = await svc.generate_all(today)
            _persist(session, generated)
            return generated
        except svc.HoroscopeError:
            pass  # fall through to whatever we can serve
        except Exception:  # noqa: BLE001
            pass

    # Best effort: today's partial rows, else the last cached day per sign, else offline.
    out: list[dict] = []
    for s in svc.SIGNS:
        if s in cached:
            out.append(svc.row_to_dict(cached[s]))
            continue
        last = session.exec(
            select(Horoscope).where(Horoscope.sign == s).order_by(Horoscope.date.desc())
        ).first()
        out.append(svc.row_to_dict(last) if last else svc.local_horoscope(s, today))
    return out


@router.get("/all")
async def horoscope_all(
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    items = await _all_for_today(session)
    return {"date": svc.ist_today().isoformat(), "signs": items}


@router.get("")
async def horoscope_one(
    sign: str = Query(min_length=3, max_length=20),
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    name = sign.strip().title()
    if name not in svc.SIGNS:
        raise HTTPException(status_code=422, detail=f"Unknown sign '{sign}'")
    items = await _all_for_today(session)
    for it in items:
        if it["sign"] == name:
            return it
    return svc.local_horoscope(name)
