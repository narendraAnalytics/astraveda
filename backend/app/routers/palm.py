"""Palm Reading (Hasta Samudrika Shastra) — guided questionnaire + AI reading.

Two-phase, mirroring the Kundali router: `POST /palm/generate` persists the
answers and returns immediately; the app renders the result and then calls
`POST /palm/{id}/reading` for the (slower) Sarvam narrative. Everything is
persisted so re-opening is instant. No photo computer vision in v1 — the
optional palm photo stays on the user's device.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
from datetime import datetime
from uuid import UUID

import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Payment, PalmReading, User
from app.services import palm_reading, palm_vision, payments, wallet_pay

router = APIRouter(prefix="/palm", tags=["palm"])

RELATIONS = {"Self", "Spouse", "Child", "Mother", "Father", "Sibling", "Friend", "Other"}
GENDERS = {"Female", "Male", "Other", "Prefer not to say"}
RELATIONSHIP_STATUS = {"Single", "In a relationship", "Married", "Prefer not to say"}
HANDS = {"Left", "Right"}
SHAPES = {"Earth", "Air", "Fire", "Water"}
FINGER_LENGTHS = {"Short", "Balanced", "Long"}
THUMB_FLEX = {"Firm", "Balanced", "Flexible"}
LINE_KEYS = {"heart", "head", "life", "fate"}
MOUNTS = {"Jupiter", "Saturn", "Sun", "Mercury", "Venus", "Moon", "Mars"}

_HAND_SHAPE_TRAIT = {
    "Earth": "grounded, practical",
    "Air": "curious, communicative",
    "Fire": "driven, expressive",
    "Water": "sensitive, intuitive",
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PersonIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD, optional
    dominant_hand: str | None = None

    def person_snapshot(self) -> dict:
        return _identity_from(self)


class CheckoutIn(PersonIn):
    method: str = "card"  # card | wallet


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class PaymentProof(BaseModel):
    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None


class GenerateIn(PaymentProof):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD, optional
    dominant_hand: str
    hand_shape: str
    finger_length: str | None = None
    thumb_flex: str | None = None
    lines: dict[str, str] = Field(default_factory=dict)
    mounts: list[str] = Field(default_factory=list)
    marks: list[str] = Field(default_factory=list)


class ScanIn(PaymentProof):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD, optional
    dominant_hand: str | None = None  # user tells us which hand they photographed
    image: str = Field(min_length=32)  # base64 (no data: prefix)
    mime_type: str = "image/jpeg"


class PalmOut(BaseModel):
    id: str
    name: str
    relation: str | None
    dominant_hand: str
    hand_shape: str
    finger_length: str | None
    thumb_flex: str | None
    lines: dict
    mounts: list
    marks: list
    profile: dict
    source: str
    reading_en: str | None
    created_at: datetime

    @classmethod
    def of(cls, r: PalmReading) -> "PalmOut":
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_hand=r.dominant_hand,
            hand_shape=r.hand_shape,
            finger_length=r.finger_length,
            thumb_flex=r.thumb_flex,
            lines=r.lines or {},
            mounts=r.mounts or [],
            marks=r.marks or [],
            profile=r.profile or {},
            source=r.source or "guided",
            reading_en=r.reading_en,
            created_at=r.created_at,
        )


class PalmSummary(BaseModel):
    """Lightweight row for the "your palms" gallery."""

    id: str
    name: str
    relation: str | None
    dominant_hand: str
    hand_shape: str
    headline_trait: str
    source: str
    has_reading: bool
    created_at: datetime

    @classmethod
    def of(cls, r: PalmReading) -> "PalmSummary":
        heart = (r.lines or {}).get("heart")
        bits = []
        if r.hand_shape and r.hand_shape != "Unknown":
            bits.append(f"{r.hand_shape} hand")
        if heart and heart not in ("Not sure", "not visible"):
            bits.append(f"{heart.lower()} heart line")
        if not bits:
            bits.append("Palm reading")
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_hand=r.dominant_hand,
            hand_shape=r.hand_shape,
            headline_trait=" · ".join(bits),
            source=r.source or "guided",
            has_reading=bool(r.reading_en),
            created_at=r.created_at,
        )


class ReadingOut(BaseModel):
    reading_en: str
    cached: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_lines(raw: dict[str, str]) -> dict[str, str]:
    return {k: str(v)[:80] for k, v in raw.items() if k in LINE_KEYS and v}


class Features(BaseModel):
    name: str
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None
    dominant_hand: str
    hand_shape: str
    finger_length: str | None = None
    thumb_flex: str | None = None
    lines: dict[str, str] = Field(default_factory=dict)
    mounts: list[str] = Field(default_factory=list)
    marks: list[str] = Field(default_factory=list)
    source: str = "guided"
    observations: str | None = None


def _signature(f: Features) -> str:
    blob = json.dumps(
        {
            "hand": f.dominant_hand,
            "shape": f.hand_shape,
            "fingers": f.finger_length,
            "thumb": f.thumb_flex,
            "lines": f.lines,
            "mounts": sorted(f.mounts),
        },
        sort_keys=True,
    )
    return hashlib.sha1(blob.encode()).hexdigest()


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _clean_birth_date(raw: str | None) -> str | None:
    return raw if raw and _DATE_RE.match(raw) else None


def _identity_from(body) -> dict:
    """Validated person/identity fields off any request body that carries them."""
    return {
        "name": (body.name or "").strip(),
        "relation": body.relation if body.relation in RELATIONS else None,
        "gender": body.gender if body.gender in GENDERS else None,
        "relationship_status": (
            body.relationship_status if body.relationship_status in RELATIONSHIP_STATUS else None
        ),
        "birth_date": _clean_birth_date(body.birth_date),
        "dominant_hand": body.dominant_hand if body.dominant_hand in HANDS else None,
    }


def _build_profile(f: Features) -> dict:
    return {
        "name": f.name.strip(),
        "gender": f.gender,
        "relationship_status": f.relationship_status,
        "birth_date": f.birth_date,
        "dominant_hand": f.dominant_hand,
        "hand_shape": f.hand_shape,
        "hand_shape_trait": _HAND_SHAPE_TRAIT.get(f.hand_shape, ""),
        "finger_length": f.finger_length,
        "thumb_flex": f.thumb_flex,
        "lines": f.lines,
        "mounts": f.mounts,
        "marks": f.marks,
        "observations": f.observations,
        "source": f.source,
        "signature": _signature(f),
    }


def _upsert(session: Session, user: User, f: Features, pay: Payment | None = None) -> PalmReading:
    """Insert a new palm reading, or (only when unpaid) update the matching one
    in place (same person + same feature signature) so a free regenerate doesn't
    pile up copies. A paid reading is ALWAYS a fresh row — ₹40 buys a new chart,
    same rule as Kundali/Face."""
    profile = _build_profile(f)
    name = f.name.strip()
    row = None
    if pay is None:
        existing = session.exec(select(PalmReading).where(PalmReading.user_id == user.id)).all()
        row = next(
            (
                r
                for r in existing
                if r.name.strip().lower() == name.lower()
                and (r.relation or None) == f.relation
                and (r.profile or {}).get("signature") == profile["signature"]
            ),
            None,
        )
    if row is None:
        row = PalmReading(user_id=user.id)
        session.add(row)

    row.name = name
    row.relation = f.relation or row.relation
    row.dominant_hand = f.dominant_hand
    row.hand_shape = f.hand_shape
    row.finger_length = f.finger_length
    row.thumb_flex = f.thumb_flex
    row.lines = f.lines
    row.mounts = f.mounts
    row.marks = f.marks
    row.profile = profile
    row.source = f.source

    if pay is not None and pay.status != "consumed":
        row.payment_id = pay.id
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "palm"
        pay.reference_id = str(row.id)
        session.add(pay)

    session.commit()
    session.refresh(row)
    return row


async def _resolve_payment(
    session: Session,
    user: User,
    *,
    payment_id: str | None,
    razorpay_payment_id: str | None,
    razorpay_signature: str | None,
) -> Payment:
    """Return the caller's palm payment once confirmed paid — mirrors Face.
    `consumed`/`paid` pass through; `created` is verified against the Checkout
    signature AND a live order fetch before advancing to `paid`."""
    if not payment_id:
        raise HTTPException(status_code=402, detail="Payment required")
    try:
        pid = UUID(payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc

    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "palm":
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


async def _existing_for(session: Session, pay: Payment) -> PalmReading | None:
    """An idempotent retry of an already-consumed payment → the same row."""
    if pay.status == "consumed" and pay.reference_id:
        try:
            return session.get(PalmReading, UUID(pay.reference_id))
        except ValueError:
            return None
    return None


def _get_owned(session: Session, user: User, palm_id: str) -> PalmReading:
    try:
        pid = UUID(palm_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Palm reading not found") from exc
    row = session.get(PalmReading, pid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Palm reading not found")
    return row


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/checkout", response_model=CheckoutOut)
async def palm_checkout(
    body: CheckoutIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    """₹40 per palm reading — pay by card (Razorpay) or from the wallet."""
    settings = get_settings()
    snapshot = body.person_snapshot()
    amount_paise = settings.palm_price_paise

    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "palm",
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
        method=body.method, purpose="palm", amount_paise=amount_paise,
        snapshot=snapshot, description=f"Palm reading · {snapshot['name']}",
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
    """A paid-but-unclaimed palm order (app died right after paying)."""
    candidates = session.exec(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.purpose == "palm",
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


@router.post("/generate", response_model=PalmOut)
async def generate_palm(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    if body.dominant_hand not in HANDS:
        raise HTTPException(status_code=422, detail="dominant_hand must be Left or Right")
    if body.hand_shape not in SHAPES:
        raise HTTPException(status_code=422, detail="hand_shape must be Earth, Air, Fire or Water")

    pay: Payment | None = None
    ident = _identity_from(body)
    if payments.is_configured():
        pay = await _resolve_payment(
            session, user,
            payment_id=body.payment_id,
            razorpay_payment_id=body.razorpay_payment_id,
            razorpay_signature=body.razorpay_signature,
        )
        existing = await _existing_for(session, pay)
        if existing is not None:
            return PalmOut.of(existing)
        # Trust the person captured at checkout, never a fresh client payload.
        if pay.birth_snapshot:
            ident = pay.birth_snapshot

    f = Features(
        name=(ident.get("name") or body.name).strip(),
        relation=ident.get("relation"),
        gender=ident.get("gender"),
        relationship_status=ident.get("relationship_status"),
        birth_date=_clean_birth_date(ident.get("birth_date")),
        dominant_hand=body.dominant_hand,
        hand_shape=body.hand_shape,
        finger_length=body.finger_length if body.finger_length in FINGER_LENGTHS else None,
        thumb_flex=body.thumb_flex if body.thumb_flex in THUMB_FLEX else None,
        lines=_clean_lines(body.lines),
        mounts=[m for m in body.mounts if m in MOUNTS][:2],
        marks=[str(m)[:40] for m in body.marks if m][:8],
        source="guided",
    )
    return PalmOut.of(_upsert(session, user, f, pay))


@router.post("/scan", response_model=PalmOut)
async def scan_palm(
    body: ScanIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    """Analyse a palm photo with Gemini Vision, then persist the derived features
    (same shape as /generate). The narrative reading still comes from Sarvam via
    POST /palm/{id}/reading. The image is not stored."""
    raw = body.image.split(",", 1)[-1].strip()  # tolerate a data: URI prefix
    try:
        base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="image is not valid base64") from exc

    pay: Payment | None = None
    ident = _identity_from(body)
    if payments.is_configured():
        pay = await _resolve_payment(
            session, user,
            payment_id=body.payment_id,
            razorpay_payment_id=body.razorpay_payment_id,
            razorpay_signature=body.razorpay_signature,
        )
        existing = await _existing_for(session, pay)
        if existing is not None:
            return PalmOut.of(existing)
        if pay.birth_snapshot:
            ident = pay.birth_snapshot

    try:
        v = await palm_vision.analyze_palm(raw, body.mime_type or "image/jpeg")
    except palm_vision.VisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Palm scan failed: {exc}") from exc

    if not v.get("is_hand", False):
        raise HTTPException(
            status_code=422,
            detail="That doesn't look like an open palm — hold your hand flat, palm to the camera.",
        )

    def _enum(val, allowed):
        return val if val in allowed else None

    hand_shape = _enum(v.get("hand_shape"), SHAPES) or "Unknown"
    dominant = (
        ident.get("dominant_hand")
        or _enum(v.get("dominant_hand_guess"), HANDS)
        or "Right"
    )
    lines = _clean_lines(
        {k: val for k, val in (v.get("lines") or {}).items() if val and val != "not visible"}
    )
    mounts_seen = [m for m in (v.get("mounts") or []) if m in MOUNTS]

    # Only ask for a retake when the photo is poor AND Gemini pulled nothing
    # usable from it. A "poor" shot that still yielded a shape / lines / mounts
    # is good enough to read — don't block the user on a lighting judgement.
    if v.get("image_quality") == "poor" and hand_shape == "Unknown" and not lines and not mounts_seen:
        reason = v.get("retake_reason") or "the lines aren't clear enough"
        raise HTTPException(status_code=422, detail=f"Please retake the photo — {reason}.")

    f = Features(
        name=(ident.get("name") or body.name).strip(),
        relation=ident.get("relation"),
        gender=ident.get("gender"),
        relationship_status=ident.get("relationship_status"),
        birth_date=_clean_birth_date(ident.get("birth_date")),
        dominant_hand=dominant,
        hand_shape=hand_shape,
        finger_length=_enum(v.get("finger_length"), FINGER_LENGTHS),
        thumb_flex=_enum(v.get("thumb_flex"), THUMB_FLEX),
        lines=lines,
        mounts=mounts_seen[:3],
        marks=[str(m)[:60] for m in (v.get("marks") or []) if m][:8],
        source="scan",
        observations=(str(v.get("observations"))[:600] if v.get("observations") else None),
    )
    return PalmOut.of(_upsert(session, user, f, pay))


@router.get("", response_model=PalmOut)
async def latest_palm(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    row = session.exec(
        select(PalmReading)
        .where(PalmReading.user_id == user.id)
        .order_by(PalmReading.created_at.desc())
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No palm reading yet")
    return PalmOut.of(row)


@router.get("/list", response_model=list[PalmSummary])
async def list_palms(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[PalmSummary]:
    rows = session.exec(
        select(PalmReading)
        .where(PalmReading.user_id == user.id)
        .order_by(PalmReading.created_at.desc())
    ).all()
    return [PalmSummary.of(r) for r in rows]


@router.get("/{palm_id}", response_model=PalmOut)
async def get_palm(
    palm_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    return PalmOut.of(_get_owned(session, user, palm_id))


@router.delete("/{palm_id}")
async def delete_palm(
    palm_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, palm_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}


@router.post("/{palm_id}/reading", response_model=ReadingOut)
async def palm_reading_route(
    palm_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingOut:
    row = _get_owned(session, user, palm_id)
    if row.reading_en:
        return ReadingOut(reading_en=row.reading_en, cached=True)

    try:
        text = await palm_reading.generate_reading(row)
    except palm_reading.ReadingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - never leak a bare 500 to the app
        raise HTTPException(status_code=502, detail=f"Reading failed: {exc}") from exc

    row.reading_en = text
    session.add(row)
    session.commit()
    return ReadingOut(reading_en=text, cached=False)
