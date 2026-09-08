"""Shared checkout helper — pay a tool fee by card (Razorpay) or from the wallet.

Every paid tool's /checkout calls `start_payment()`. For method="card" it creates
a Razorpay order + a `created` Payment (the existing flow). For method="wallet" it
debits the wallet and creates an already-`paid` Payment with a synthetic order id,
so the tool's normal `_resolve_payment` (which passes `paid` through) needs no
change. Raises HTTPException(402) with a friendly message on low balance.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

import anyio
from fastapi import HTTPException
from sqlmodel import Session

from app.config import get_settings
from app.models import Payment, User
from app.services import payments, wallet as wallet_svc


class PaymentStart:
    def __init__(self, *, method: str, payment: Payment, order_id: str, key_id: str) -> None:
        self.method = method
        self.payment = payment
        self.order_id = order_id
        self.key_id = key_id


async def start_payment(
    session: Session,
    user: User,
    *,
    method: str,
    purpose: str,
    amount_paise: int,
    snapshot: dict,
    description: str,
) -> PaymentStart:
    settings = get_settings()
    payment_id = uuid4()

    if method == "wallet":
        try:
            wallet_svc.debit(
                session, user,
                amount_paise=amount_paise, kind="debit",
                description=description,
                reference_type=purpose, reference_id=str(payment_id),
            )
        except wallet_svc.InsufficientBalance as exc:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"Not enough wallet balance — you have ₹{exc.available / 100:.0f}, "
                    f"this costs ₹{exc.needed / 100:.0f}. Add money or pay by card."
                ),
            ) from exc
        pay = Payment(
            id=payment_id,
            user_id=user.id,
            purpose=purpose,
            amount_paise=amount_paise,
            razorpay_order_id=f"wallet_{payment_id}",
            razorpay_payment_id=f"wallet_{payment_id}",
            status="paid",
            paid_at=datetime.utcnow(),
            birth_snapshot=snapshot,
        )
        session.add(pay)
        session.commit()
        session.refresh(pay)
        return PaymentStart(method="wallet", payment=pay, order_id="", key_id="")

    # method == "card"
    if not payments.is_configured():
        raise HTTPException(status_code=503, detail="Payments are not configured")
    try:
        order = await anyio.to_thread.run_sync(
            lambda: payments.create_order(
                amount_paise=amount_paise,
                receipt=str(payment_id),
                notes={"user_id": str(user.id), "purpose": purpose},
            )
        )
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    pay = Payment(
        id=payment_id,
        user_id=user.id,
        purpose=purpose,
        amount_paise=amount_paise,
        razorpay_order_id=order["id"],
        birth_snapshot=snapshot,
    )
    session.add(pay)
    session.commit()
    session.refresh(pay)
    return PaymentStart(method="card", payment=pay, order_id=order["id"], key_id=settings.razorpay_key_id)


def refund_if_wallet(session: Session, user: User, pay: Payment, *, reason: str) -> None:
    """Return a wallet-paid, not-yet-consumed payment's money to the wallet.
    Call this when a tool generation fails after payment."""
    if pay.status == "consumed" or not pay.razorpay_order_id.startswith("wallet_"):
        return
    wallet_svc.credit(
        session, user,
        amount_paise=pay.amount_paise, kind="refund",
        description=f"Refund — {reason}",
        reference_type=pay.purpose, reference_id=str(pay.id),
    )
    pay.status = "failed"
    session.add(pay)
    session.commit()
