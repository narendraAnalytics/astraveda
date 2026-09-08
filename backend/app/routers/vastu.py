"""Vastu AI — room photo + facing direction -> a Vastu Shastra analysis.

Single Gemini call (`POST /vastu/analyze`) verifies the ₹150 Razorpay payment,
runs Gemini once, persists the structured result and returns it. Payment flow
mirrors Aura/Face — the client never sends an amount, and the label / room type /
direction are trusted from the checkout snapshot. The photo is taken after
payment and is never stored server-side.
"""

from __future__ import annotations

import base64
import binascii
from datetime import datetime
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Payment, User, VastuReading
from app.services import payments, vastu_vision, wallet_pay

router = APIRouter(prefix="/vastu", tags=["vastu"])

ROOM_TYPES = set(vastu_vision.ROOM_TYPES)
DIRECTIONS = set(vastu_vision.DIRECTIONS)
ELEMENTS = set(vastu_vision.ELEMENTS)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SpaceIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    room_type: str
    direction: str = "Unknown"

    def snapshot(self) -> dict:
        return {
            "label": self.label.strip(),
            "room_type": self.room_type if self.room_type in ROOM_TYPES else "Other",
            "direction": self.direction if self.direction in DIRECTIONS else "Unknown",
        }


class CheckoutIn(SpaceIn):
    method: str = "card"  # card | wallet


class AnalyzeIn(SpaceIn):
    payment_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None
    image: str = Field(min_length=32)
    mime_type: str = "image/jpeg"


class CheckoutOut(BaseModel):
    payment_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class Element(BaseModel):
    element: str
    state: str
    note: str


class Dosha(BaseModel):
    issue: str
    severity: str


class Remedy(BaseModel):
    remedy: str
    fixes: str
    ease: str


class VastuOut(BaseModel):
    id: str
    label: str
    room_type: str
    direction: str
    score: int
    verdict: str
    elements: list[Element]
    doshas: list[Dosha]
    remedies: list[Remedy]
    summary: str
    guidance: str
    created_at: datetime

    @classmethod
    def of(cls, r: VastuReading) -> "VastuOut":
        return cls(
            id=str(r.id),
            label=r.label,
            room_type=r.room_type,
            direction=r.direction,
            score=r.score,
            verdict=r.verdict,
            elements=[Element(**e) for e in (r.elements or []) if isinstance(e, dict) and e.get("element")],
            doshas=[Dosha(**d) for d in (r.doshas or []) if isinstance(d, dict) and d.get("issue")],
            remedies=[Remedy(**m) for m in (r.remedies or []) if isinstance(m, dict) and m.get("remedy")],
            summary=r.summary,
            guidance=r.guidance,
            created_at=r.created_at,
        )


class VastuSummary(BaseModel):
    id: str
    label: str
    room_type: str
    direction: str
    score: int
    verdict: str
    dosha_count: int
    created_at: datetime

    @classmethod
    def of(cls, r: VastuReading) -> "VastuSummary":
        return cls(
            id=str(r.id),
            label=r.label,
            room_type=r.room_type,
            direction=r.direction,
            score=r.score,
            verdict=r.verdict,
            dosha_count=len(r.doshas or []),
            created_at=r.created_at,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp_score(v) -> int:
    try:
        return max(0, min(100, int(v)))
    except (TypeError, ValueError):
        return 0


def _clean_list(raw, keys: tuple[str, ...], caps: dict[str, int], limit: int) -> list[dict]:
    out = []
    for item in (raw or [])[: limit + 4]:
        if not isinstance(item, dict):
            continue
        row = {}
        ok = True
        for k in keys:
            val = item.get(k)
            if not val:
                ok = False
                break
            row[k] = str(val)[: caps.get(k, 200)]
        if ok:
            out.append(row)
    return out[:limit]


def _get_owned(session: Session, user: User, vastu_id: str) -> VastuReading:
    try:
        vid = UUID(vastu_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Vastu analysis not found") from exc
    row = session.get(VastuReading, vid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Vastu analysis not found")
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
    if pay is None or pay.user_id != user.id or pay.purpose != "vastu":
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
async def vastu_checkout(
    body: CheckoutIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    settings = get_settings()
    snapshot = body.snapshot()
    amount_paise = settings.vastu_price_paise

    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "vastu",
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
        method=body.method, purpose="vastu", amount_paise=amount_paise,
        snapshot=snapshot, description=f"Vastu · {snapshot['label']}",
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
            Payment.purpose == "vastu",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
        .order_by(Payment.created_at.desc())
    ).all()

    for pay in candidates:
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "space": pay.birth_snapshot}}
        try:
            if await anyio.to_thread.run_sync(
                lambda p=pay: payments.order_is_paid(p.razorpay_order_id)
            ):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "space": pay.birth_snapshot}}
        except payments.PaymentError:
            continue
    return {"pending": None}


@router.post("/analyze", response_model=VastuOut)
async def analyze(
    body: AnalyzeIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VastuOut:
    raw = body.image.split(",", 1)[-1].strip()
    try:
        base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="image is not valid base64") from exc

    pay: Payment | None = None
    snapshot = body.snapshot()
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
                done = session.get(VastuReading, UUID(pay.reference_id))
            except ValueError:
                done = None
            if done is not None:
                return VastuOut.of(done)
        if pay.birth_snapshot:
            snapshot = pay.birth_snapshot

    try:
        v = await vastu_vision.analyze_room(
            raw,
            room_type=snapshot["room_type"],
            direction=snapshot["direction"],
            mime_type=body.mime_type or "image/jpeg",
        )
    except vastu_vision.VisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Vastu analysis failed: {exc}") from exc

    if not v.get("is_room", False):
        raise HTTPException(status_code=422, detail="That doesn't look like a room — take a wider photo of the space.")
    if v.get("image_quality") == "poor":
        reason = v.get("retake_reason") or "the photo is too dark or blurred"
        raise HTTPException(status_code=422, detail=f"Please retake the photo — {reason}.")

    elements = [
        e
        for e in _clean_list(v.get("elements"), ("element", "state", "note"), {"note": 240}, 5)
        if e["element"] in ELEMENTS
    ]
    doshas = _clean_list(v.get("doshas"), ("issue", "severity"), {"issue": 240}, 8)
    remedies = _clean_list(v.get("remedies"), ("remedy", "fixes", "ease"), {"remedy": 200, "fixes": 240}, 8)

    row = VastuReading(user_id=user.id)
    session.add(row)
    row.label = snapshot["label"]
    row.room_type = snapshot["room_type"]
    row.direction = snapshot["direction"]
    row.score = _clamp_score(v.get("score"))
    row.verdict = str(v.get("verdict") or "")[:200]
    row.elements = elements
    row.doshas = doshas
    row.remedies = remedies
    row.summary = str(v.get("summary") or "")[:800]
    row.guidance = str(v.get("guidance") or "")[:800]

    if pay is not None and pay.status != "consumed":
        row.payment_id = pay.id
        pay.status = "consumed"
        pay.consumed_at = datetime.utcnow()
        pay.reference_type = "vastu"
        pay.reference_id = str(row.id)
        session.add(pay)

    session.commit()
    session.refresh(row)
    return VastuOut.of(row)


@router.get("/list", response_model=list[VastuSummary])
async def list_vastu(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[VastuSummary]:
    rows = session.exec(
        select(VastuReading)
        .where(VastuReading.user_id == user.id)
        .order_by(VastuReading.created_at.desc())
    ).all()
    return [VastuSummary.of(r) for r in rows]


@router.get("/{vastu_id}", response_model=VastuOut)
async def get_vastu(
    vastu_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VastuOut:
    return VastuOut.of(_get_owned(session, user, vastu_id))


@router.delete("/{vastu_id}")
async def delete_vastu(
    vastu_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, vastu_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}
