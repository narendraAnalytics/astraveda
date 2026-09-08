"""AI Dream Interpreter — text-only, Svapna Shastra lens.

Single call: `POST /dream/interpret` verifies the ₹30 Razorpay payment, runs
Sarvam once, persists the structured reading and returns it. The payment flow
mirrors Kundali/Face/Aura — the client never sends an amount and the backend
trusts the dream text captured at checkout, not a fresh client payload.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import DreamReading, Payment, User
from app.services import dream_reading, payments

router = APIRouter(prefix="/dream", tags=["dream"])

RELATIONS = {"Self", "Spouse", "Child", "Mother", "Father", "Sibling", "Friend", "Other"}
GENDERS = {"Female", "Male", "Other", "Prefer not to say"}
RELATIONSHIP_STATUS = {"Single", "In a relationship", "Married", "Prefer not to say"}
CONTEXT_KEYS = ("feeling", "when", "night", "focus")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DreamIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None
    dream: str = Field(min_length=30, max_length=4000)
    context: dict[str, str] = Field(default_factory=dict)

    def person_snapshot(self) -> dict:
        return {
            "name": self.name.strip(),
            "relation": self.relation if self.relation in RELATIONS else None,
            "gender": self.gender if self.gender in GENDERS else None,
            "relationship_status": (
                self.relationship_status if self.relationship_status in RELATIONSHIP_STATUS else None
            ),
            "birth_date": self.birth_date if self.birth_date and _DATE_RE.match(self.birth_date) else None,
        }

    def clean_context(self) -> dict:
        return {k: str(v).strip()[:80] for k, v in (self.context or {}).items() if k in CONTEXT_KEYS and v}

    def checkout_snapshot(self) -> dict:
        return {
            **self.person_snapshot(),
            "dream": self.dream.strip()[:4000],
            "context": self.clean_context(),
        }


class InterpretIn(DreamIn):
    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str
    key_id: str
    amount_paise: int
    currency: str = "INR"


class Symbol(BaseModel):
    symbol: str
    meaning: str


class DreamOut(BaseModel):
    id: str
    name: str
    relation: str | None
    dream_text: str
    context: dict
    title: str
    feeling: str
    symbols: list[Symbol]
    theme: str
    vedic_note: str
    guidance: str
    created_at: datetime

    @classmethod
    def of(cls, r: DreamReading) -> "DreamOut":
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dream_text=r.dream_text,
            context=r.context or {},
            title=r.title,
            feeling=r.feeling,
            symbols=[Symbol(**s) for s in (r.symbols or []) if isinstance(s, dict) and s.get("symbol")],
            theme=r.theme,
            vedic_note=r.vedic_note,
            guidance=r.guidance,
            created_at=r.created_at,
        )


class DreamSummary(BaseModel):
    id: str
    name: str
    relation: str | None
    title: str
    feeling: str
    symbols: list[str]
    created_at: datetime

    @classmethod
    def of(cls, r: DreamReading) -> "DreamSummary":
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            title=r.title or "Your dream",
            feeling=r.feeling,
            symbols=[s["symbol"] for s in (r.symbols or []) if isinstance(s, dict) and s.get("symbol")][:3],
            created_at=r.created_at,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_owned(session: Session, user: User, dream_id: str) -> DreamReading:
    try:
        did = UUID(dream_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Dream not found") from exc
    row = session.get(DreamReading, did)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Dream not found")
    return row


async def _resolve_payment(
    session: Session,
    user: User,
    *,
    payment_id: str | None,
    razorpay_payment_id: str | None,
    razorpay_signature: str | None,
) -> Payment:
    if not payment_id:
        raise HTTPException(status_code=402, detail="Payment required")
    try:
        pid = UUID(payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc

    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "dream":
        raise HTTPException(status_code=402, detail="Payment not found")
    if pay.status in ("consumed", "paid"):
        return pay
    if pay.status != "created":
        raise HTTPException(status_code=402, detail="Payment did not complete")

    try:
        if razorpay_payment_id and razorpay_signature:
            payments.verify_checkout_signature(
                order_id=pay.razorpay_order_id,
                payment_id=razorpay_payment_id,
                signature=razorpay_signature,
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
    pay.razorpay_payment_id = razorpay_payment_id
    session.add(pay)
    session.commit()
    session.refresh(pay)
    return pay


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/checkout", response_model=CheckoutOut)
async def dream_checkout(
    body: DreamIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    settings = get_settings()
    if not payments.is_configured():
        raise HTTPException(status_code=503, detail="Payments are not configured")

    snapshot = body.checkout_snapshot()
    snap_key = hashlib.sha1(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()

    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "dream",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
    ).all()
    reuse = next(
        (
            p
            for p in pending
            if hashlib.sha1(json.dumps(p.birth_snapshot, sort_keys=True).encode()).hexdigest() == snap_key
        ),
        None,
    )
    if reuse is not None:
        return CheckoutOut(
            payment_id=str(reuse.id),
            order_id=reuse.razorpay_order_id,
            key_id=settings.razorpay_key_id,
            amount_paise=reuse.amount_paise,
        )

    payment_id = uuid4()
    amount_paise = settings.dream_price_paise
    try:
        order = await anyio.to_thread.run_sync(
            lambda: payments.create_order(
                amount_paise=amount_paise,
                receipt=str(payment_id),
                notes={"user_id": str(user.id), "purpose": "dream", "name": snapshot["name"]},
            )
        )
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    pay = Payment(
        id=payment_id,
        user_id=user.id,
        purpose="dream",
        amount_paise=amount_paise,
        razorpay_order_id=order["id"],
        birth_snapshot=snapshot,
    )
    session.add(pay)
    session.commit()
    return CheckoutOut(
        payment_id=str(payment_id),
        order_id=order["id"],
        key_id=settings.razorpay_key_id,
        amount_paise=amount_paise,
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
            Payment.purpose == "dream",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
        .order_by(Payment.created_at.desc())
    ).all()

    for pay in candidates:
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "dream": pay.birth_snapshot}}
        try:
            if await anyio.to_thread.run_sync(
                lambda p=pay: payments.order_is_paid(p.razorpay_order_id)
            ):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "dream": pay.birth_snapshot}}
        except payments.PaymentError:
            continue
    return {"pending": None}


@router.post("/interpret", response_model=DreamOut)
async def interpret(
    body: InterpretIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DreamOut:
    pay: Payment | None = None
    snapshot = body.checkout_snapshot()
    if payments.is_configured():
        pay = await _resolve_payment(
            session,
            user,
            payment_id=body.payment_id,
            razorpay_payment_id=body.razorpay_payment_id,
            razorpay_signature=body.razorpay_signature,
        )
        if pay.status == "consumed" and pay.reference_id:
            try:
                done = session.get(DreamReading, UUID(pay.reference_id))
            except ValueError:
                done = None
            if done is not None:
                return DreamOut.of(done)
        if pay.birth_snapshot:
            snapshot = pay.birth_snapshot

    name = snapshot["name"]
    dream_text = str(snapshot.get("dream") or "").strip()
    context = snapshot.get("context") or {}
    if len(dream_text) < 30:
        raise HTTPException(status_code=422, detail="Please describe the dream in a little more detail.")

    profile = {k: snapshot.get(k) for k in ("gender", "relationship_status", "birth_date")}

    try:
        out = await dream_reading.interpret_dream(
            name=name, profile=profile, dream_text=dream_text, context=context,
        )
    except dream_reading.ReadingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Interpretation failed: {exc}") from exc

    row = DreamReading(user_id=user.id)
    session.add(row)
    row.name = name
    row.relation = snapshot.get("relation")
    row.dream_text = dream_text
    row.context = context
    row.title = out["title"]
    row.feeling = out["feeling"]
    row.symbols = out["symbols"]
    row.theme = out["theme"]
    row.vedic_note = out["vedic_note"]
    row.guidance = out["guidance"]
    row.profile = {**profile, "name": name, "source": "text"}

    if pay is not None and pay.status != "consumed":
        row.payment_id = pay.id
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "dream"
        pay.reference_id = str(row.id)
        session.add(pay)

    session.commit()
    session.refresh(row)
    return DreamOut.of(row)


@router.get("/list", response_model=list[DreamSummary])
async def list_dreams(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[DreamSummary]:
    rows = session.exec(
        select(DreamReading)
        .where(DreamReading.user_id == user.id)
        .order_by(DreamReading.created_at.desc())
    ).all()
    return [DreamSummary.of(r) for r in rows]


@router.get("/{dream_id}", response_model=DreamOut)
async def get_dream(
    dream_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DreamOut:
    return DreamOut.of(_get_owned(session, user, dream_id))


@router.delete("/{dream_id}")
async def delete_dream(
    dream_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, dream_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}
