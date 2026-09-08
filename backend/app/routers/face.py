"""Face Reading (Mukha Samudrika Shastra) — selfie scan + AI reading.

Same two-phase shape as palm: `POST /face/scan` returns the derived features
fast; the app renders them and then calls `POST /face/{id}/reading` for the
(slower) Sarvam narrative. Everything is persisted so re-opening is instant.

Every reading is a paid ₹45 Razorpay order — the payment flow mirrors Kundali
(`services.payments`): the client never sends an amount and the backend never
trusts a raw "payment succeeded". The selfie is analysed once and never stored.
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
from app.models import FaceReading, Payment, User
from app.services import face_reading, face_vision, payments, wallet_pay

router = APIRouter(prefix="/face", tags=["face"])

RELATIONS = {"Self", "Spouse", "Child", "Mother", "Father", "Sibling", "Friend", "Other"}
GENDERS = {"Female", "Male", "Other", "Prefer not to say"}
RELATIONSHIP_STATUS = {"Single", "In a relationship", "Married", "Prefer not to say"}
FACE_SHAPES = {"Oval", "Round", "Square", "Oblong", "Heart", "Diamond"}

_FEATURE_KEYS = (
    "forehead",
    "eyebrows",
    "eyes",
    "nose",
    "lips",
    "cheeks",
    "chin_jaw",
    "ears",
    "three_zones",
)
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PersonIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    gender: str | None = None
    relationship_status: str | None = None
    birth_date: str | None = None  # YYYY-MM-DD, optional

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
    image: str = Field(min_length=32)  # base64 (no data: prefix)
    mime_type: str = "image/jpeg"


class GenerateIn(PersonIn):
    """The tiny fallback when the camera is denied — 3 self-reported features."""

    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None
    face_shape: str
    forehead: str | None = None
    chin_jaw: str | None = None


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class FaceOut(BaseModel):
    id: str
    name: str
    relation: str | None
    face_shape: str
    features: dict
    marks: list
    profile: dict
    source: str
    reading_en: str | None
    created_at: datetime

    @classmethod
    def of(cls, r: FaceReading) -> "FaceOut":
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            face_shape=r.face_shape,
            features=r.features or {},
            marks=r.marks or [],
            profile=r.profile or {},
            source=r.source or "scan",
            reading_en=r.reading_en,
            created_at=r.created_at,
        )


class FaceSummary(BaseModel):
    id: str
    name: str
    relation: str | None
    face_shape: str
    headline_trait: str
    source: str
    has_reading: bool
    created_at: datetime

    @classmethod
    def of(cls, r: FaceReading) -> "FaceSummary":
        feats = r.features or {}
        bits = []
        if r.face_shape and r.face_shape != "Unknown":
            bits.append(f"{r.face_shape} face")
        fore = feats.get("forehead")
        if fore and fore != "not clearly visible":
            bits.append(f"{fore.lower()} forehead")
        if not bits:
            bits.append("Face reading")
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            face_shape=r.face_shape,
            headline_trait=" · ".join(bits),
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

def _clean_features(raw: dict) -> dict:
    out = {}
    for k in _FEATURE_KEYS:
        v = raw.get(k)
        if v and isinstance(v, str):
            out[k] = v.strip()[:120]
    return out


def _signature(name: str, snapshot: dict, face_shape: str, features: dict) -> str:
    blob = json.dumps(
        {"name": name.lower(), "snap": snapshot, "shape": face_shape, "features": features},
        sort_keys=True,
    )
    return hashlib.sha1(blob.encode()).hexdigest()


def _persist(
    session: Session,
    user: User,
    *,
    snapshot: dict,
    face_shape: str,
    features: dict,
    marks: list[str],
    source: str,
    observations: str | None,
    pay: Payment | None,
) -> FaceReading:
    name = snapshot["name"]
    profile = {
        **snapshot,
        "face_shape": face_shape,
        "features": features,
        "marks": marks,
        "observations": observations,
        "source": source,
        "signature": _signature(name, snapshot, face_shape, features),
    }

    row = FaceReading(user_id=user.id)
    session.add(row)
    row.name = name
    row.relation = snapshot.get("relation")
    row.face_shape = face_shape
    row.features = features
    row.marks = marks
    row.profile = profile
    row.source = source

    if pay is not None and pay.status != "consumed":
        row.payment_id = pay.id
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "face"
        pay.reference_id = str(row.id)
        session.add(pay)

    session.commit()
    session.refresh(row)
    return row


def _get_owned(session: Session, user: User, face_id: str) -> FaceReading:
    try:
        fid = UUID(face_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Face reading not found") from exc
    row = session.get(FaceReading, fid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Face reading not found")
    return row


async def _resolve_payment(
    session: Session,
    user: User,
    *,
    payment_id: str | None,
    razorpay_payment_id: str | None,
    razorpay_signature: str | None,
) -> Payment:
    """Return the caller's face payment once it is confirmed paid — mirrors the
    Kundali flow. `consumed`/`paid` pass through; `created` is verified against
    the Checkout signature AND a live order fetch before advancing to `paid`."""
    if not payment_id:
        raise HTTPException(status_code=402, detail="Payment required")
    try:
        pid = UUID(payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc

    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "face":
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


async def _existing_for(session: Session, pay: Payment) -> FaceReading | None:
    """An idempotent retry of an already-consumed payment → the same row."""
    if pay.status == "consumed" and pay.reference_id:
        try:
            done = session.get(FaceReading, UUID(pay.reference_id))
        except ValueError:
            return None
        return done
    return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/checkout", response_model=CheckoutOut)
async def face_checkout(
    body: CheckoutIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    """₹45 per face reading — pay by card (Razorpay) or from the wallet."""
    settings = get_settings()
    snapshot = body.person_snapshot()
    amount_paise = settings.face_price_paise

    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "face",
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
        method=body.method, purpose="face", amount_paise=amount_paise,
        snapshot=snapshot, description=f"Face reading · {snapshot['name']}",
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
    """A paid-but-unclaimed face order (app died right after paying)."""
    candidates = session.exec(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.purpose == "face",
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


@router.post("/scan", response_model=FaceOut)
async def scan_face(
    body: ScanIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FaceOut:
    raw = body.image.split(",", 1)[-1].strip()  # tolerate a data: URI prefix
    try:
        base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="image is not valid base64") from exc

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
        existing = await _existing_for(session, pay)
        if existing is not None:
            return FaceOut.of(existing)
        # Trust the snapshot captured at checkout, never a fresh client payload.
        if pay.birth_snapshot:
            snapshot = pay.birth_snapshot

    try:
        v = await face_vision.analyze_face(raw, body.mime_type or "image/jpeg")
    except face_vision.VisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Face scan failed: {exc}") from exc

    if not v.get("is_face", False):
        raise HTTPException(
            status_code=422,
            detail="That doesn't look like a clear face — center your face and look at the camera.",
        )

    face_shape = v.get("face_shape") if v.get("face_shape") in FACE_SHAPES else "Unknown"
    features = _clean_features(v)
    marks = [str(m)[:60] for m in (v.get("marks") or []) if m][:8]

    if v.get("image_quality") == "poor" and face_shape == "Unknown" and not features:
        reason = v.get("retake_reason") or "the features aren't clear enough"
        raise HTTPException(status_code=422, detail=f"Please retake the photo — {reason}.")

    row = _persist(
        session,
        user,
        snapshot=snapshot,
        face_shape=face_shape,
        features=features,
        marks=marks,
        source="scan",
        observations=(str(v.get("observations"))[:600] if v.get("observations") else None),
        pay=pay,
    )
    return FaceOut.of(row)


@router.post("/generate", response_model=FaceOut)
async def generate_face(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FaceOut:
    if body.face_shape not in FACE_SHAPES:
        raise HTTPException(status_code=422, detail="face_shape must be one of " + ", ".join(sorted(FACE_SHAPES)))

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
        existing = await _existing_for(session, pay)
        if existing is not None:
            return FaceOut.of(existing)
        if pay.birth_snapshot:
            snapshot = pay.birth_snapshot

    features = _clean_features({"forehead": body.forehead, "chin_jaw": body.chin_jaw})
    row = _persist(
        session,
        user,
        snapshot=snapshot,
        face_shape=body.face_shape,
        features=features,
        marks=[],
        source="guided",
        observations=None,
        pay=pay,
    )
    return FaceOut.of(row)


@router.get("", response_model=FaceOut)
async def latest_face(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FaceOut:
    row = session.exec(
        select(FaceReading)
        .where(FaceReading.user_id == user.id)
        .order_by(FaceReading.created_at.desc())
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No face reading yet")
    return FaceOut.of(row)


@router.get("/list", response_model=list[FaceSummary])
async def list_faces(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FaceSummary]:
    rows = session.exec(
        select(FaceReading)
        .where(FaceReading.user_id == user.id)
        .order_by(FaceReading.created_at.desc())
    ).all()
    return [FaceSummary.of(r) for r in rows]


@router.get("/{face_id}", response_model=FaceOut)
async def get_face(
    face_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FaceOut:
    return FaceOut.of(_get_owned(session, user, face_id))


@router.delete("/{face_id}")
async def delete_face(
    face_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, face_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}


@router.post("/{face_id}/reading", response_model=ReadingOut)
async def face_reading_route(
    face_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingOut:
    row = _get_owned(session, user, face_id)
    if row.reading_en:
        return ReadingOut(reading_en=row.reading_en, cached=True)

    try:
        text = await face_reading.generate_reading(row)
    except face_reading.ReadingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Reading failed: {exc}") from exc

    row.reading_en = text
    session.add(row)
    session.commit()
    return ReadingOut(reading_en=text, cached=False)
