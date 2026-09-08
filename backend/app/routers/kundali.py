"""Vedic Kundali — geocoding, chart generation, and the AI reading.

Two-phase by design: `POST /kundali/generate` returns the computed chart fast;
the app renders it immediately and then calls `POST /kundali/{id}/reading` for
the (slower) Sarvam narrative. Everything is persisted so re-opening is instant.
"""

from __future__ import annotations

from datetime import date, datetime, time
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Kundali, Payment, User
from app.services import geocode, kundali as kundali_engine, payments, reading, wallet_pay

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


RELATIONS = {"Self", "Spouse", "Child", "Mother", "Father", "Sibling", "Friend", "Other"}


class GenerateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    birth_date: date
    birth_time: time = time(12, 0)
    unknown_time: bool = False
    birth_place: str = Field(min_length=1, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str = Field(min_length=1, max_length=64)

    # Proof of the ₹15 payment. Required once Razorpay is configured; the three
    # razorpay_* fields are what Checkout hands the client, verified server-side.
    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None
    method: str = "card"  # card | wallet

    def birth_fields(self) -> dict:
        return self.model_dump(
            mode="json",
            include={
                "name", "relation", "birth_date", "birth_time",
                "unknown_time", "birth_place", "latitude", "longitude", "timezone",
            },
        )


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class KundaliOut(BaseModel):
    id: str
    name: str
    relation: str | None
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
            relation=k.relation,
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


class KundaliSummary(BaseModel):
    """Lightweight row for the "your charts" gallery — no full chart payload."""

    id: str
    name: str
    relation: str | None
    birth_date: date
    birth_time: time
    unknown_time: bool
    birth_place: str
    lagna: str | None
    moon_sign: str | None
    nakshatra: str | None
    current_mahadasha: str | None
    has_reading: bool
    created_at: datetime

    @classmethod
    def of(cls, k: Kundali) -> "KundaliSummary":
        chart = k.chart or {}
        ava = chart.get("avakhada", {})
        vim = chart.get("vimshottari", {}).get("current", {})
        return cls(
            id=str(k.id),
            name=k.name,
            relation=k.relation,
            birth_date=k.birth_date,
            birth_time=k.birth_time,
            unknown_time=k.unknown_time,
            birth_place=k.birth_place,
            lagna=(chart.get("lagna") or {}).get("sign"),
            moon_sign=ava.get("moon_sign"),
            nakshatra=ava.get("nakshatra"),
            current_mahadasha=vim.get("mahadasha"),
            has_reading=bool(k.reading_en),
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


@router.post("/checkout", response_model=CheckoutOut)
async def kundali_checkout(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    """Create a ₹15 Razorpay order for one Kundali. Every generation is paid —
    there is no per-person de-dupe."""
    settings = get_settings()
    snapshot = body.birth_fields()
    amount_paise = settings.kundali_price_paise

    # Reuse an unconsumed order for the identical birth snapshot (double-tap).
    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "kundali",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
    ).all()
    reuse = next((p for p in pending if p.birth_snapshot == snapshot), None)
    if reuse is not None:
        m = "wallet" if reuse.razorpay_order_id.startswith("wallet_") else "card"
        return CheckoutOut(
            payment_id=str(reuse.id),
            order_id="" if m == "wallet" else reuse.razorpay_order_id,
            key_id="" if m == "wallet" else settings.razorpay_key_id,
            amount_paise=reuse.amount_paise,
            method=m,
        )

    start = await wallet_pay.start_payment(
        session, user,
        method=body.method, purpose="kundali", amount_paise=amount_paise,
        snapshot=snapshot, description=f"Kundali · {body.name.strip()}",
    )
    return CheckoutOut(
        payment_id=str(start.payment.id),
        order_id=start.order_id,
        key_id=start.key_id,
        amount_paise=amount_paise,
        method=start.method,
    )


@router.get("/checkout/pending")
async def pending_checkout(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """A paid-but-unclaimed Kundali order (app died right after paying) so the
    form can offer "resume" without a second charge."""
    candidates = session.exec(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.purpose == "kundali",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
        .order_by(Payment.created_at.desc())
    ).all()

    for pay in candidates:
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "birth": pay.birth_snapshot}}
        # `created` but maybe paid — confirm directly with Razorpay before offering.
        try:
            if await anyio.to_thread.run_sync(
                lambda p=pay: payments.order_is_paid(p.razorpay_order_id)
            ):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "birth": pay.birth_snapshot}}
        except payments.PaymentError:
            continue
    return {"pending": None}


async def _resolve_payment(session: Session, user: User, body: GenerateIn) -> Payment:
    """Return the caller's Kundali payment once it is confirmed paid.

    - `consumed`  → returned as-is (caller handles the idempotent retry).
    - `paid`      → the webhook already confirmed it; nothing more to check.
    - `created`   → verify the Checkout signature AND fetch the order from
                    Razorpay to confirm it is really paid, then advance to paid.
    Anything else → 402.
    """
    if not body.payment_id:
        raise HTTPException(status_code=402, detail="Payment required")
    try:
        pid = UUID(body.payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc

    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "kundali":
        raise HTTPException(status_code=402, detail="Payment not found")
    if pay.status in ("consumed", "paid"):
        return pay
    if pay.status != "created":
        raise HTTPException(status_code=402, detail="Payment did not complete")

    try:
        # Fresh purchase: verify the fields Checkout returned. Resume (no fields):
        # rely on fetching our own order from Razorpay.
        if body.razorpay_payment_id and body.razorpay_signature:
            payments.verify_checkout_signature(
                order_id=pay.razorpay_order_id,
                payment_id=body.razorpay_payment_id,
                signature=body.razorpay_signature,
            )
        confirmed = await anyio.to_thread.run_sync(
            lambda: payments.order_is_paid(pay.razorpay_order_id)
        )
    except payments.PaymentError as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    if not confirmed:
        raise HTTPException(status_code=402, detail="Payment not completed")

    pay.status = "paid"
    pay.paid_at = datetime.utcnow()
    pay.razorpay_payment_id = body.razorpay_payment_id
    session.add(pay)
    session.commit()
    session.refresh(pay)
    return pay


@router.post("/generate", response_model=KundaliOut)
async def generate_kundali(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> KundaliOut:
    pay: Payment | None = None
    if payments.is_configured():
        pay = await _resolve_payment(session, user, body)
        # A retry after the chart was already made → return that same chart.
        if pay.status == "consumed" and pay.reference_id:
            done = session.get(Kundali, UUID(pay.reference_id))
            if done is not None:
                return KundaliOut.of(done)
        # Trust the snapshot captured at checkout, never a fresh client payload.
        if pay.birth_snapshot:
            body = GenerateIn(**pay.birth_snapshot)

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

    name = body.name.strip()
    place = body.birth_place.strip()
    relation = body.relation if body.relation in RELATIONS else None

    # Every generation is a fresh chart — one paid ₹15 order, one new row.
    # (An idempotent retry of the *same* payment is handled above.)
    row = Kundali(user_id=user.id)
    session.add(row)

    row.name = name
    row.relation = relation or row.relation
    row.birth_date = body.birth_date
    row.birth_time = birth_time
    row.unknown_time = body.unknown_time
    row.birth_place = place
    row.latitude = body.latitude
    row.longitude = body.longitude
    row.timezone = body.timezone
    row.tz_offset = tz_offset
    row.chart = chart
    row.raw = raw
    # Chart is deterministic from these inputs, so an existing reading still fits.

    # Consume the ₹15 entitlement against this chart (immutably links the two).
    if pay is not None and pay.status != "consumed":
        row.payment_id = pay.id
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "kundali"
        pay.reference_id = str(row.id)
        session.add(pay)

    # Mirror birth details onto the profile only for the user's own chart.
    if relation in (None, "Self"):
        user.date_of_birth = body.birth_date
        user.birth_time = None if body.unknown_time else birth_time
        user.birth_place = place
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


@router.get("/list", response_model=list[KundaliSummary])
async def list_kundalis(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[KundaliSummary]:
    rows = session.exec(
        select(Kundali)
        .where(Kundali.user_id == user.id)
        .order_by(Kundali.created_at.desc())
    ).all()
    return [KundaliSummary.of(k) for k in rows]


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


@router.delete("/{kundali_id}")
async def delete_kundali(
    kundali_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, kundali_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}


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
    except Exception as exc:  # noqa: BLE001 - never leak a bare 500 to the app
        raise HTTPException(status_code=502, detail=f"Reading failed: {exc}") from exc

    row.reading_en = text
    session.add(row)
    session.commit()
    return ReadingOut(reading_en=text, cached=False)
