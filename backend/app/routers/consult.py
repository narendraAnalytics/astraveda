"""Ask AstraVeda — voice consultation booking + the outbound-call lifecycle.

Flow (mirrors Kundali/Dream checkout):
  POST /consult/checkout          -> ₹99 Razorpay order (card) or wallet debit
  POST /consult/confirm           -> verify payment, create the Consultation,
                                     place the call now (booking_type="now") or
                                     leave it for the cron (booking_type="scheduled")
  GET  /consult/checkout/pending  -> resume if the app died right after paying
  POST /consult/tick              -> internal; Render cron places due slot calls
  GET  /consult/list, /{id}       -> history + detail (transcript, summary)

The end-of-call webhook is POST /webhooks/sarvam (see routers/webhooks.py).
"""

from __future__ import annotations

import hmac
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

import anyio
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Consultation, Payment, User
from app.services import payments, voice, wallet_pay

router = APIRouter(prefix="/consult", tags=["consult"])
settings = get_settings()

IST = timezone(timedelta(hours=5, minutes=30))
TOPICS = {"career", "marriage", "health", "finance", "general"}
SLOT_START_HOUR = 9
SLOT_END_HOUR = 21
SLOT_DAYS = 4


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConsultIn(BaseModel):
    caller_name: str = Field(min_length=2, max_length=120)
    phone_e164: str = Field(min_length=8, max_length=20)
    consultation_topic: str = "general"
    user_question: str = Field(default="", max_length=800)
    birth_date: date | None = None
    birth_time: time | None = None
    unknown_time: bool = False
    birth_place: str = Field(default="", max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = Field(default=None, max_length=64)
    booking_type: str = "now"          # now | scheduled
    slot: str | None = None            # ISO datetime with +05:30 offset, for scheduled

    def _clean_phone(self) -> str:
        p = "".join(ch for ch in self.phone_e164 if ch.isdigit() or ch == "+")
        if not p.startswith("+"):
            p = "+" + p
        digits = p[1:]
        if not (digits.isdigit() and 8 <= len(digits) <= 15 and digits[0] != "0"):
            raise HTTPException(status_code=422, detail="Enter a valid phone number with country code, e.g. +91…")
        return p

    def _scheduled_at_utc(self) -> datetime | None:
        if self.booking_type != "scheduled":
            return None
        if not self.slot:
            raise HTTPException(status_code=422, detail="Pick a time slot")
        try:
            dt = datetime.fromisoformat(self.slot)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid time slot") from exc
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        local = dt.astimezone(IST)
        now = datetime.now(IST)
        if (
            local.minute != 0
            or local.second != 0
            or not (SLOT_START_HOUR <= local.hour <= SLOT_END_HOUR)
            or local < now + timedelta(minutes=2)
            or local > now + timedelta(days=SLOT_DAYS)
        ):
            raise HTTPException(status_code=422, detail="That time slot is not available")
        return local.astimezone(timezone.utc).replace(tzinfo=None)

    def snapshot(self) -> dict:
        phone = self._clean_phone()
        scheduled_utc = self._scheduled_at_utc()
        topic = self.consultation_topic if self.consultation_topic in TOPICS else "general"
        return {
            "caller_name": self.caller_name.strip(),
            "phone_e164": phone,
            "consultation_topic": topic,
            "user_question": self.user_question.strip(),
            "birth_date": self.birth_date.isoformat() if self.birth_date else None,
            "birth_time": self.birth_time.strftime("%H:%M") if self.birth_time and not self.unknown_time else None,
            "unknown_time": bool(self.unknown_time),
            "birth_place": self.birth_place.strip(),
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timezone": self.timezone,
            "booking_type": "scheduled" if scheduled_utc else "now",
            "scheduled_at": scheduled_utc.isoformat() if scheduled_utc else None,
            "slot_label": _slot_label(scheduled_utc) if scheduled_utc else "now",
        }


class CheckoutIn(ConsultIn):
    method: str = "card"  # card | wallet


class ConfirmIn(BaseModel):
    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class TranscriptLine(BaseModel):
    role: str | None = None
    text: str = ""


class ConsultOut(BaseModel):
    id: str
    caller_name: str
    phone_e164: str
    consultation_topic: str
    user_question: str
    birth_place: str
    booking_type: str
    slot_label: str
    scheduled_at: datetime | None
    status: str
    outcome: str | None
    duration_sec: int | None
    failure_reason: str | None
    call_summary: str
    transcript: list[TranscriptLine]
    created_at: datetime

    @classmethod
    def of(cls, c: Consultation) -> "ConsultOut":
        return cls(
            id=str(c.id),
            caller_name=c.caller_name,
            phone_e164=c.phone_e164,
            consultation_topic=c.consultation_topic,
            user_question=c.user_question,
            birth_place=c.birth_place,
            booking_type=c.booking_type,
            slot_label=c.slot_label,
            scheduled_at=c.scheduled_at,
            status=c.status,
            outcome=c.outcome,
            duration_sec=c.duration_sec,
            failure_reason=c.failure_reason,
            call_summary=c.call_summary,
            transcript=[TranscriptLine(**t) for t in (c.transcript or []) if isinstance(t, dict)],
            created_at=c.created_at,
        )


class ConsultSummary(BaseModel):
    id: str
    caller_name: str
    consultation_topic: str
    booking_type: str
    slot_label: str
    scheduled_at: datetime | None
    status: str
    outcome: str | None
    created_at: datetime

    @classmethod
    def of(cls, c: Consultation) -> "ConsultSummary":
        return cls(
            id=str(c.id),
            caller_name=c.caller_name,
            consultation_topic=c.consultation_topic,
            booking_type=c.booking_type,
            slot_label=c.slot_label,
            scheduled_at=c.scheduled_at,
            status=c.status,
            outcome=c.outcome,
            created_at=c.created_at,
        )


class SlotDay(BaseModel):
    label: str          # "Today" | "Tomorrow" | "Wed 11"
    date: str           # YYYY-MM-DD (IST)
    slots: list[dict]   # [{iso, label}]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clock(local: datetime) -> str:
    """'3:00 PM' — portable (no %-I, which some libc builds reject)."""
    h = local.hour % 12 or 12
    ampm = "AM" if local.hour < 12 else "PM"
    return f"{h}:{local.minute:02d} {ampm}"


def _slot_label(utc_dt: datetime | None) -> str:
    if utc_dt is None:
        return "now"
    aware = utc_dt.replace(tzinfo=timezone.utc) if utc_dt.tzinfo is None else utc_dt
    local = aware.astimezone(IST)
    today = datetime.now(IST).date()
    delta = (local.date() - today).days
    day = "Today" if delta == 0 else "Tomorrow" if delta == 1 else f"{local.strftime('%a')} {local.day}"
    return f"{day}, {_clock(local)}"


def _consultation_from_snapshot(user: User, snap: dict) -> Consultation:
    bd = snap.get("birth_date")
    bt = snap.get("birth_time")
    sched = snap.get("scheduled_at")
    return Consultation(
        user_id=user.id,
        caller_name=snap["caller_name"],
        phone_e164=snap["phone_e164"],
        consultation_topic=snap.get("consultation_topic", "general"),
        user_question=snap.get("user_question", ""),
        birth_date=date.fromisoformat(bd) if bd else None,
        birth_time=time.fromisoformat(bt) if bt else None,
        unknown_time=bool(snap.get("unknown_time")),
        birth_place=snap.get("birth_place", ""),
        latitude=snap.get("latitude"),
        longitude=snap.get("longitude"),
        timezone=snap.get("timezone"),
        booking_type=snap.get("booking_type", "now"),
        scheduled_at=datetime.fromisoformat(sched).replace(tzinfo=None) if sched else None,
        slot_label=snap.get("slot_label", "now"),
        status="paid",
    )


async def _resolve_payment(session: Session, user: User, body: ConfirmIn) -> Payment:
    if not body.payment_id:
        raise HTTPException(status_code=402, detail="Payment required")
    try:
        pid = UUID(body.payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc

    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "consult":
        raise HTTPException(status_code=402, detail="Payment not found")
    if pay.status in ("consumed", "paid"):
        return pay
    if pay.status != "created":
        raise HTTPException(status_code=402, detail="Payment did not complete")

    try:
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


def _get_owned(session: Session, user: User, consult_id: str) -> Consultation:
    try:
        cid = UUID(consult_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Consultation not found") from exc
    row = session.get(Consultation, cid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return row


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/slots", response_model=list[SlotDay])
def slots() -> list[SlotDay]:
    """Bookable hourly slots (IST 09:00–21:00) for the next few days."""
    now = datetime.now(IST)
    out: list[SlotDay] = []
    for day_offset in range(SLOT_DAYS):
        d = (now + timedelta(days=day_offset)).date()
        rows: list[dict] = []
        for hour in range(SLOT_START_HOUR, SLOT_END_HOUR + 1):
            local = datetime(d.year, d.month, d.day, hour, 0, tzinfo=IST)
            if local < now + timedelta(minutes=30):
                continue
            rows.append({"iso": local.isoformat(), "label": _clock(local)})
        if not rows:
            continue
        label = "Today" if day_offset == 0 else "Tomorrow" if day_offset == 1 else f"{d.strftime('%a')} {d.day}"
        out.append(SlotDay(label=label, date=d.isoformat(), slots=rows))
    return out


@router.post("/checkout", response_model=CheckoutOut)
async def consult_checkout(
    body: CheckoutIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    if not voice.is_configured():
        raise HTTPException(status_code=503, detail="Voice consultations are not available right now.")

    snapshot = body.snapshot()

    # Double-tap guard: reuse an unconsumed order for the identical booking.
    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "consult",
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
        method=body.method, purpose="consult", amount_paise=settings.consult_price_paise,
        snapshot=snapshot, description=f"Voice consultation · {snapshot['caller_name']}",
    )
    return CheckoutOut(
        payment_id=str(start.payment.id),
        order_id=start.order_id,
        key_id=start.key_id,
        amount_paise=settings.consult_price_paise,
        method=start.method,
    )


@router.get("/checkout/pending")
async def pending_checkout(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    candidates = session.exec(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.purpose == "consult",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
        .order_by(Payment.created_at.desc())
    ).all()
    for pay in candidates:
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "booking": pay.birth_snapshot}}
        try:
            if await anyio.to_thread.run_sync(lambda p=pay: payments.order_is_paid(p.razorpay_order_id)):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "booking": pay.birth_snapshot}}
        except payments.PaymentError:
            continue
    return {"pending": None}


@router.post("/confirm", response_model=ConsultOut)
async def confirm(
    body: ConfirmIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConsultOut:
    pay = await _resolve_payment(session, user, body)

    # This payment already produced a consultation. Return it — unless that call
    # failed to dial and this is a genuine retry, in which case reuse the row.
    row: Consultation | None = None
    if pay.reference_id:
        try:
            row = session.get(Consultation, UUID(pay.reference_id))
        except ValueError:
            row = None
        if row is not None and not (row.status == "failed" and row.booking_type == "now"):
            return ConsultOut.of(row)

    if row is None:
        if not pay.birth_snapshot:
            raise HTTPException(status_code=422, detail="Booking details were lost — please start again.")
        row = _consultation_from_snapshot(user, pay.birth_snapshot)
        row.payment_id = pay.id
        session.add(row)
        session.commit()
        session.refresh(row)
        pay.reference_type = "consult"
        pay.reference_id = str(row.id)
        session.add(pay)
        session.commit()
    else:
        row.status = "paid"
        row.failure_reason = None
        session.add(row)
        session.commit()
        session.refresh(row)

    def _consume() -> None:
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "consult"
        pay.reference_id = str(row.id)
        session.add(pay)

    if row.booking_type != "now":
        # Scheduled: the Render cron (POST /consult/tick) places the call when due.
        _consume()
        session.add(row)
        session.commit()
        session.refresh(row)
        return ConsultOut.of(row)

    # Call now — place it before consuming, so a provider failure can refund a
    # wallet payment (refund_if_wallet is a no-op once the payment is consumed).
    try:
        row.attempt_id = await anyio.to_thread.run_sync(lambda: voice.place_call(row))
        row.status = "calling"
        row.called_at = datetime.utcnow()
        _consume()
        session.add(row)
        session.commit()
        session.refresh(row)
        return ConsultOut.of(row)
    except voice.VoiceError as exc:
        row.status = "failed"
        row.failure_reason = str(exc)[:800]
        session.add(row)
        wallet_pay.refund_if_wallet(session, user, pay, reason="voice call could not be placed")
        pay.reference_type = "consult"
        pay.reference_id = str(row.id)
        session.add(pay)
        session.commit()
        raise HTTPException(
            status_code=502,
            detail="We couldn't place the call just now. Wallet payments are refunded; card payments will be refunded by our team.",
        ) from exc


@router.post("/tick")
def tick(
    x_tick_secret: str = Header(default=""),
    session: Session = Depends(get_session),
) -> dict:
    """Internal — the Render cron job hits this every couple of minutes to place
    due scheduled calls."""
    if not settings.consult_tick_secret or not hmac.compare_digest(
        x_tick_secret, settings.consult_tick_secret
    ):
        raise HTTPException(status_code=403, detail="forbidden")

    due = session.exec(
        select(Consultation).where(
            Consultation.status == "paid",
            Consultation.booking_type == "scheduled",
            Consultation.scheduled_at <= datetime.utcnow(),
        )
    ).all()
    placed = 0
    for c in due:
        try:
            c.attempt_id = voice.place_call(c)
            c.status = "calling"
            c.called_at = datetime.utcnow()
            placed += 1
        except voice.VoiceError as exc:
            c.status = "failed"
            c.failure_reason = str(exc)[:800]
        session.add(c)
        session.commit()
    return {"due": len(due), "placed": placed}


@router.get("/list", response_model=list[ConsultSummary])
def consult_list(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[ConsultSummary]:
    rows = session.exec(
        select(Consultation)
        .where(Consultation.user_id == user.id)
        .order_by(Consultation.created_at.desc())
    ).all()
    return [ConsultSummary.of(c) for c in rows]


@router.get("/{consult_id}", response_model=ConsultOut)
def get_consultation(
    consult_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConsultOut:
    return ConsultOut.of(_get_owned(session, user, consult_id))


@router.delete("/{consult_id}")
def delete_consultation(
    consult_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, consult_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}
