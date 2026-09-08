"""AR Aura & Energy Scan — selfie colour read + energy quiz + AI reading.

Same shape as face.py: `POST /aura/scan` returns the derived palette fast; the
app renders it and calls `POST /aura/{id}/reading` for the Sarvam narrative.
Every scan is a paid ₹60 Razorpay order (flow mirrors Kundali/Face). The selfie
is analysed once and never stored.
"""

from __future__ import annotations

import base64
import binascii
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
from app.models import AuraReading, Payment, User
from app.services import aura_reading, aura_vision, payments, wallet_pay

router = APIRouter(prefix="/aura", tags=["aura"])

RELATIONS = {"Self", "Spouse", "Child", "Mother", "Father", "Sibling", "Friend", "Other"}
GENDERS = {"Female", "Male", "Other", "Prefer not to say"}
RELATIONSHIP_STATUS = {"Single", "In a relationship", "Married", "Prefer not to say"}
AURA_COLORS = set(aura_vision.AURA_COLORS)
QUIZ_KEYS = ("energy", "focus", "feeling", "need")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PersonIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None

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


class CheckoutIn(PersonIn):
    method: str = "card"  # card | wallet


class ScanIn(PersonIn):
    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None
    image: str = Field(min_length=32)
    mime_type: str = "image/jpeg"
    quiz: dict[str, str] = Field(default_factory=dict)


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class AuraOut(BaseModel):
    id: str
    name: str
    relation: str | None
    dominant_color: str
    secondary_colors: list
    features: dict
    quiz: dict
    profile: dict
    source: str
    reading_en: str | None
    created_at: datetime

    @classmethod
    def of(cls, r: AuraReading) -> "AuraOut":
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_color=r.dominant_color,
            secondary_colors=r.secondary_colors or [],
            features=r.features or {},
            quiz=r.quiz or {},
            profile=r.profile or {},
            source=r.source or "scan",
            reading_en=r.reading_en,
            created_at=r.created_at,
        )


class AuraSummary(BaseModel):
    id: str
    name: str
    relation: str | None
    dominant_color: str
    headline_trait: str
    source: str
    has_reading: bool
    created_at: datetime

    @classmethod
    def of(cls, r: AuraReading) -> "AuraSummary":
        secs = [s for s in (r.secondary_colors or []) if s]
        trait = f"{r.dominant_color} aura"
        if secs:
            trait += f" · {secs[0].lower()} tones"
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_color=r.dominant_color,
            headline_trait=trait,
            source=r.source or "scan",
            has_reading=bool(r.reading_en),
            created_at=r.created_at,
        )


class ReadingOut(BaseModel):
    reading_en: str
    cached: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_quiz(raw: dict) -> dict:
    return {k: str(v).strip()[:120] for k, v in (raw or {}).items() if k in QUIZ_KEYS and v}


def _signature(name: str, snapshot: dict, dominant: str, quiz: dict) -> str:
    blob = json.dumps(
        {"name": name.lower(), "snap": snapshot, "dominant": dominant, "quiz": quiz},
        sort_keys=True,
    )
    return hashlib.sha1(blob.encode()).hexdigest()


def _persist(
    session: Session,
    user: User,
    *,
    snapshot: dict,
    dominant: str,
    secondary: list[str],
    features: dict,
    quiz: dict,
    pay: Payment | None,
) -> AuraReading:
    name = snapshot["name"]
    profile = {
        **snapshot,
        "dominant_color": dominant,
        "secondary_colors": secondary,
        "features": features,
        "quiz": quiz,
        "source": "scan",
        "signature": _signature(name, snapshot, dominant, quiz),
    }

    row = AuraReading(user_id=user.id)
    session.add(row)
    row.name = name
    row.relation = snapshot.get("relation")
    row.dominant_color = dominant
    row.secondary_colors = secondary
    row.features = features
    row.quiz = quiz
    row.profile = profile
    row.source = "scan"

    if pay is not None and pay.status != "consumed":
        row.payment_id = pay.id
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "aura"
        pay.reference_id = str(row.id)
        session.add(pay)

    session.commit()
    session.refresh(row)
    return row


def _get_owned(session: Session, user: User, aura_id: str) -> AuraReading:
    try:
        aid = UUID(aura_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Aura reading not found") from exc
    row = session.get(AuraReading, aid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Aura reading not found")
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
    if pay is None or pay.user_id != user.id or pay.purpose != "aura":
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
async def aura_checkout(
    body: CheckoutIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    settings = get_settings()
    snapshot = body.person_snapshot()
    amount_paise = settings.aura_price_paise

    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "aura",
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
        method=body.method, purpose="aura", amount_paise=amount_paise,
        snapshot=snapshot, description=f"Aura scan · {snapshot['name']}",
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
    candidates = session.exec(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.purpose == "aura",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
        .order_by(Payment.created_at.desc())
    ).all()

    for pay in candidates:
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "person": pay.birth_snapshot}}
        try:
            if await anyio.to_thread.run_sync(
                lambda p=pay: payments.order_is_paid(p.razorpay_order_id)
            ):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "person": pay.birth_snapshot}}
        except payments.PaymentError:
            continue
    return {"pending": None}


@router.post("/scan", response_model=AuraOut)
async def scan_aura(
    body: ScanIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AuraOut:
    raw = body.image.split(",", 1)[-1].strip()
    try:
        base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="image is not valid base64") from exc

    quiz = _clean_quiz(body.quiz)

    pay: Payment | None = None
    snapshot = body.person_snapshot()
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
                done = session.get(AuraReading, UUID(pay.reference_id))
            except ValueError:
                done = None
            if done is not None:
                return AuraOut.of(done)
        if pay.birth_snapshot:
            snapshot = pay.birth_snapshot

    try:
        v = await aura_vision.analyze_aura(raw, body.mime_type or "image/jpeg")
    except aura_vision.VisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Aura scan failed: {exc}") from exc

    if not v.get("is_face", False):
        raise HTTPException(
            status_code=422,
            detail="We couldn't see your face — center it in the circle and try again.",
        )
    if v.get("image_quality") == "poor":
        reason = v.get("retake_reason") or "the photo is too dark or blurred"
        raise HTTPException(status_code=422, detail=f"Please retake the photo — {reason}.")

    dominant = v.get("dominant_color") if v.get("dominant_color") in AURA_COLORS else "White"
    secondary = [c for c in (v.get("secondary_colors") or []) if c in AURA_COLORS and c != dominant][:2]
    features = {
        "brightness": v.get("brightness") if v.get("brightness") in ("dim", "soft", "radiant") else None,
        "warmth": v.get("warmth") if v.get("warmth") in ("cool", "balanced", "warm") else None,
        "visual_notes": str(v.get("visual_notes"))[:400] if v.get("visual_notes") else None,
    }

    row = _persist(
        session,
        user,
        snapshot=snapshot,
        dominant=dominant,
        secondary=secondary,
        features=features,
        quiz=quiz,
        pay=pay,
    )
    return AuraOut.of(row)


@router.get("", response_model=AuraOut)
async def latest_aura(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AuraOut:
    row = session.exec(
        select(AuraReading)
        .where(AuraReading.user_id == user.id)
        .order_by(AuraReading.created_at.desc())
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No aura scan yet")
    return AuraOut.of(row)


@router.get("/list", response_model=list[AuraSummary])
async def list_auras(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[AuraSummary]:
    rows = session.exec(
        select(AuraReading)
        .where(AuraReading.user_id == user.id)
        .order_by(AuraReading.created_at.desc())
    ).all()
    return [AuraSummary.of(r) for r in rows]


@router.get("/{aura_id}", response_model=AuraOut)
async def get_aura(
    aura_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AuraOut:
    return AuraOut.of(_get_owned(session, user, aura_id))


@router.delete("/{aura_id}")
async def delete_aura(
    aura_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, aura_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}


@router.post("/{aura_id}/reading", response_model=ReadingOut)
async def aura_reading_route(
    aura_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingOut:
    row = _get_owned(session, user, aura_id)
    if row.reading_en:
        return ReadingOut(reading_en=row.reading_en, cached=True)

    try:
        text = await aura_reading.generate_reading(row)
    except aura_reading.ReadingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Reading failed: {exc}") from exc

    row.reading_en = text
    session.add(row)
    session.commit()
    return ReadingOut(reading_en=text, cached=False)
