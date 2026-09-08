"""Temple & Puja e-commerce (finalview.txt §25) — demo booking.

Browse a seeded catalog of temples and pujas, fill a devotee form, pay via
Razorpay, and receive a booking slip (booking code + QR) to show at the temple.
No priest ops / live video / prasad logistics in this version.

Money is server-authoritative: amount = the puja's per-person price × devotees,
computed here — the client never sends a price.
"""

from __future__ import annotations

import secrets
from datetime import date, datetime
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Payment, Puja, PujaOrder, Temple, User
from app.services import payments, wallet_pay

router = APIRouter(tags=["puja"])

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PujaOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    benefits: str
    price_per_person_paise: int
    daily_capacity: int
    booked_today: int
    duration_note: str


class TempleOut(BaseModel):
    id: str
    slug: str
    name: str
    deity: str
    city: str
    state: str
    image_url: str
    about: str
    pujas: list[PujaOut]


class AvailabilityOut(BaseModel):
    date: date
    capacity: int
    booked: int
    remaining: int


class CheckoutIn(BaseModel):
    puja_id: str
    devotee_name: str = Field(min_length=1, max_length=120)
    gotra: str | None = Field(default=None, max_length=80)
    nakshatra: str | None = Field(default=None, max_length=40)
    phone: str | None = Field(default=None, max_length=20)
    num_devotees: int = Field(default=1, ge=1, le=20)
    preferred_date: date
    method: str = "card"  # card | wallet


class CheckoutOut(BaseModel):
    payment_id: str
    puja_order_id: str
    order_id: str = ""
    key_id: str = ""
    amount_paise: int
    method: str = "card"
    currency: str = "INR"


class ConfirmIn(BaseModel):
    payment_id: str
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None


class OrderOut(BaseModel):
    id: str
    booking_code: str = ""
    status: str
    temple_name: str
    temple_city: str
    deity: str
    puja_name: str
    devotee_name: str
    gotra: str | None
    nakshatra: str | None
    phone: str | None
    num_devotees: int
    preferred_date: date
    amount_paise: int
    created_at: datetime
    confirmed_at: datetime | None

    @classmethod
    def of(cls, o: PujaOrder, temple: Temple, puja: Puja) -> "OrderOut":
        return cls(
            id=str(o.id),
            booking_code=o.booking_code or "",
            status=o.status,
            temple_name=temple.name,
            temple_city=temple.city,
            deity=temple.deity,
            puja_name=puja.name,
            devotee_name=o.devotee_name,
            gotra=o.gotra,
            nakshatra=o.nakshatra,
            phone=o.phone,
            num_devotees=o.num_devotees,
            preferred_date=o.preferred_date,
            amount_paise=o.amount_paise,
            created_at=o.created_at,
            confirmed_at=o.confirmed_at,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _booking_code() -> str:
    body = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
    return f"AV-{body[:4]}-{body[4:]}"


def _booked_on(session: Session, puja_id: UUID, on: date) -> int:
    rows = session.exec(
        select(PujaOrder).where(
            PujaOrder.puja_id == puja_id,
            PujaOrder.preferred_date == on,
            PujaOrder.status == "confirmed",
        )
    ).all()
    return sum(r.num_devotees for r in rows)


def _load_order(session: Session, user: User, order_id: str) -> tuple[PujaOrder, Temple, Puja]:
    try:
        oid = UUID(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Booking not found") from exc
    o = session.get(PujaOrder, oid)
    if o is None or o.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    temple = session.get(Temple, o.temple_id)
    puja = session.get(Puja, o.puja_id)
    if temple is None or puja is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return o, temple, puja


# ---------------------------------------------------------------------------
# Catalog (public)
# ---------------------------------------------------------------------------

@router.get("/temples", response_model=list[TempleOut])
async def list_temples(session: Session = Depends(get_session)) -> list[TempleOut]:
    temples = session.exec(
        select(Temple).where(Temple.active == True).order_by(Temple.sort_order)  # noqa: E712
    ).all()
    today = date.today()
    out: list[TempleOut] = []
    for t in temples:
        pujas = session.exec(
            select(Puja).where(Puja.temple_id == t.id, Puja.active == True).order_by(Puja.sort_order)  # noqa: E712
        ).all()
        out.append(
            TempleOut(
                id=str(t.id),
                slug=t.slug,
                name=t.name,
                deity=t.deity,
                city=t.city,
                state=t.state,
                image_url=t.image_url,
                about=t.about,
                pujas=[
                    PujaOut(
                        id=str(p.id),
                        slug=p.slug,
                        name=p.name,
                        description=p.description,
                        benefits=p.benefits,
                        price_per_person_paise=p.price_per_person_paise,
                        daily_capacity=p.daily_capacity,
                        booked_today=_booked_on(session, p.id, today),
                        duration_note=p.duration_note,
                    )
                    for p in pujas
                ],
            )
        )
    return out


@router.get("/puja/availability", response_model=AvailabilityOut)
async def availability(
    puja_id: str = Query(...),
    on: date = Query(..., alias="date"),
    session: Session = Depends(get_session),
) -> AvailabilityOut:
    try:
        pid = UUID(puja_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Puja not found") from exc
    puja = session.get(Puja, pid)
    if puja is None or not puja.active:
        raise HTTPException(status_code=404, detail="Puja not found")
    booked = _booked_on(session, pid, on)
    return AvailabilityOut(
        date=on,
        capacity=puja.daily_capacity,
        booked=booked,
        remaining=max(0, puja.daily_capacity - booked),
    )


# ---------------------------------------------------------------------------
# Booking (auth)
# ---------------------------------------------------------------------------

@router.post("/puja/checkout", response_model=CheckoutOut)
async def puja_checkout(
    body: CheckoutIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheckoutOut:
    settings = get_settings()

    try:
        pid = UUID(body.puja_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Puja not found") from exc
    puja = session.get(Puja, pid)
    if puja is None or not puja.active:
        raise HTTPException(status_code=404, detail="Puja not found")
    temple = session.get(Temple, puja.temple_id)
    if temple is None:
        raise HTTPException(status_code=404, detail="Temple not found")

    if body.preferred_date < date.today():
        raise HTTPException(status_code=422, detail="Choose today or a future date.")

    booked = _booked_on(session, puja.id, body.preferred_date)
    remaining = puja.daily_capacity - booked
    if body.num_devotees > remaining:
        raise HTTPException(
            status_code=409,
            detail=f"Only {max(0, remaining)} place(s) left for that date. Try another date or fewer devotees.",
        )

    amount_paise = puja.price_per_person_paise * body.num_devotees

    snapshot = {
        "puja_id": str(puja.id),
        "temple_id": str(temple.id),
        "devotee_name": body.devotee_name.strip(),
        "gotra": (body.gotra or "").strip() or None,
        "nakshatra": (body.nakshatra or "").strip() or None,
        "phone": (body.phone or "").strip() or None,
        "num_devotees": body.num_devotees,
        "preferred_date": body.preferred_date.isoformat(),
        "amount_paise": amount_paise,
    }

    start = await wallet_pay.start_payment(
        session, user,
        method=body.method, purpose="puja", amount_paise=amount_paise,
        snapshot=snapshot, description=f"{puja.name} · {temple.name}",
    )
    payment_id = start.payment.id

    puja_order = PujaOrder(
        user_id=user.id,
        puja_id=puja.id,
        temple_id=temple.id,
        devotee_name=snapshot["devotee_name"],
        gotra=snapshot["gotra"],
        nakshatra=snapshot["nakshatra"],
        phone=snapshot["phone"],
        num_devotees=body.num_devotees,
        preferred_date=body.preferred_date,
        amount_paise=amount_paise,
        payment_id=payment_id,
        status="created",
    )
    session.add(puja_order)
    session.commit()

    return CheckoutOut(
        payment_id=str(payment_id),
        puja_order_id=str(puja_order.id),
        order_id=start.order_id,
        key_id=start.key_id,
        amount_paise=amount_paise,
        method=start.method,
    )


@router.get("/puja/checkout/pending")
async def pending_checkout(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """A paid-but-unconfirmed puja order (app died right after paying)."""
    orders = session.exec(
        select(PujaOrder)
        .where(PujaOrder.user_id == user.id, PujaOrder.status == "created")
        .order_by(PujaOrder.created_at.desc())
    ).all()
    for o in orders:
        if o.payment_id is None:
            continue
        pay = session.get(Payment, o.payment_id)
        if pay is None:
            continue
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "puja_order_id": str(o.id)}}
        try:
            if await anyio.to_thread.run_sync(lambda p=pay: payments.order_is_paid(p.razorpay_order_id)):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "puja_order_id": str(o.id)}}
        except payments.PaymentError:
            continue
    return {"pending": None}


@router.post("/puja/confirm", response_model=OrderOut)
async def puja_confirm(
    body: ConfirmIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrderOut:
    try:
        pid = UUID(body.payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc
    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "puja":
        raise HTTPException(status_code=402, detail="Payment not found")

    puja_order = session.exec(
        select(PujaOrder).where(PujaOrder.payment_id == pay.id, PujaOrder.user_id == user.id)
    ).first()
    if puja_order is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    temple = session.get(Temple, puja_order.temple_id)
    puja = session.get(Puja, puja_order.puja_id)
    if temple is None or puja is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    if puja_order.status == "confirmed":
        return OrderOut.of(puja_order, temple, puja)

    # Verify the payment (Checkout signature + a live order fetch).
    if pay.status not in ("paid", "consumed"):
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

    pay.status = "consumed"
    pay.consumed_at = datetime.utcnow()
    pay.reference_type = "puja"
    pay.reference_id = str(puja_order.id)
    session.add(pay)

    puja_order.status = "confirmed"
    puja_order.confirmed_at = datetime.utcnow()
    if not puja_order.booking_code:
        code = _booking_code()
        while session.exec(select(PujaOrder).where(PujaOrder.booking_code == code)).first() is not None:
            code = _booking_code()
        puja_order.booking_code = code
    session.add(puja_order)
    session.commit()
    session.refresh(puja_order)
    return OrderOut.of(puja_order, temple, puja)


@router.get("/puja/orders", response_model=list[OrderOut])
async def list_orders(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[OrderOut]:
    orders = session.exec(
        select(PujaOrder)
        .where(PujaOrder.user_id == user.id, PujaOrder.status == "confirmed")
        .order_by(PujaOrder.created_at.desc())
    ).all()
    out = []
    for o in orders:
        temple = session.get(Temple, o.temple_id)
        puja = session.get(Puja, o.puja_id)
        if temple and puja:
            out.append(OrderOut.of(o, temple, puja))
    return out


@router.get("/puja/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> OrderOut:
    o, temple, puja = _load_order(session, user, order_id)
    return OrderOut.of(o, temple, puja)
