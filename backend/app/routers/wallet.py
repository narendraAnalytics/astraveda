"""Money wallet — balance, ledger, and Razorpay top-up (finalview.txt §12).

Top-up: POST /wallet/topup -> Razorpay order -> webview -> POST /wallet/topup/confirm
verifies the payment and credits the wallet (amount + any bonus). Paying for a
tool FROM the wallet is handled in each tool's /checkout (method="wallet").
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Payment, User
from app.services import payments, wallet as wallet_svc

router = APIRouter(prefix="/wallet", tags=["wallet"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TxnOut(BaseModel):
    id: str
    amount_paise: int
    kind: str
    balance_after: int
    description: str
    created_at: datetime


class WalletOut(BaseModel):
    balance_paise: int
    transactions: list[TxnOut]


class TopupIn(BaseModel):
    amount_paise: int = Field(ge=1)


class TopupCheckoutOut(BaseModel):
    payment_id: str
    order_id: str
    key_id: str
    amount_paise: int
    bonus_paise: int
    currency: str = "INR"


class TopupConfirmIn(BaseModel):
    payment_id: str
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None


class TopupConfirmOut(BaseModel):
    balance_paise: int
    credited_paise: int
    bonus_paise: int


def _txn(t) -> TxnOut:
    return TxnOut(
        id=str(t.id),
        amount_paise=t.amount_paise,
        kind=t.kind,
        balance_after=t.balance_after,
        description=t.description,
        created_at=t.created_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=WalletOut)
async def get_wallet(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WalletOut:
    w = wallet_svc.get_or_create_wallet(session, user)
    txns = wallet_svc.recent_transactions(session, user, limit=12)
    return WalletOut(balance_paise=w.balance_paise, transactions=[_txn(t) for t in txns])


@router.get("/transactions", response_model=list[TxnOut])
async def transactions(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[TxnOut]:
    return [_txn(t) for t in wallet_svc.recent_transactions(session, user, limit=60)]


@router.post("/topup", response_model=TopupCheckoutOut)
async def topup(
    body: TopupIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TopupCheckoutOut:
    settings = get_settings()
    if not payments.is_configured():
        raise HTTPException(status_code=503, detail="Payments are not configured")

    amount = body.amount_paise
    if amount < settings.wallet_min_topup_paise:
        raise HTTPException(
            status_code=422,
            detail=f"Minimum top-up is ₹{settings.wallet_min_topup_paise // 100}.",
        )
    if amount > settings.wallet_max_topup_paise:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum top-up is ₹{settings.wallet_max_topup_paise // 100}.",
        )
    amount = (amount // 100) * 100  # whole rupees only
    bonus = wallet_svc.bonus_for(amount)

    # Reuse an existing unconsumed top-up order for the same amount (double-tap).
    from sqlmodel import select

    pending = session.exec(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.purpose == "wallet_topup",
            Payment.status == "created",
            Payment.amount_paise == amount,
        )
    ).all()
    if pending:
        p = pending[0]
        return TopupCheckoutOut(
            payment_id=str(p.id),
            order_id=p.razorpay_order_id,
            key_id=settings.razorpay_key_id,
            amount_paise=amount,
            bonus_paise=(p.birth_snapshot or {}).get("bonus_paise", bonus),
        )

    payment_id = uuid4()
    try:
        order = await anyio.to_thread.run_sync(
            lambda: payments.create_order(
                amount_paise=amount,
                receipt=str(payment_id),
                notes={"user_id": str(user.id), "purpose": "wallet_topup"},
            )
        )
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    pay = Payment(
        id=payment_id,
        user_id=user.id,
        purpose="wallet_topup",
        amount_paise=amount,
        razorpay_order_id=order["id"],
        birth_snapshot={"amount_paise": amount, "bonus_paise": bonus},
    )
    session.add(pay)
    session.commit()
    return TopupCheckoutOut(
        payment_id=str(payment_id),
        order_id=order["id"],
        key_id=settings.razorpay_key_id,
        amount_paise=amount,
        bonus_paise=bonus,
    )


@router.get("/topup/pending")
async def topup_pending(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    from sqlmodel import select

    rows = session.exec(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.purpose == "wallet_topup",
            Payment.status.in_(("created", "paid")),
            Payment.consumed_at.is_(None),
        )
        .order_by(Payment.created_at.desc())
    ).all()
    for pay in rows:
        if pay.status == "paid":
            return {"pending": {"payment_id": str(pay.id), "amount_paise": pay.amount_paise}}
        try:
            if await anyio.to_thread.run_sync(lambda p=pay: payments.order_is_paid(p.razorpay_order_id)):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                session.add(pay)
                session.commit()
                return {"pending": {"payment_id": str(pay.id), "amount_paise": pay.amount_paise}}
        except payments.PaymentError:
            continue
    return {"pending": None}


@router.post("/topup/confirm", response_model=TopupConfirmOut)
async def topup_confirm(
    body: TopupConfirmIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TopupConfirmOut:
    try:
        pid = UUID(body.payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="Invalid payment reference") from exc
    pay = session.get(Payment, pid)
    if pay is None or pay.user_id != user.id or pay.purpose != "wallet_topup":
        raise HTTPException(status_code=402, detail="Payment not found")

    snapshot = pay.birth_snapshot or {}
    amount = int(snapshot.get("amount_paise", pay.amount_paise))
    bonus = int(snapshot.get("bonus_paise", 0))

    if pay.status == "consumed":
        w = wallet_svc.get_or_create_wallet(session, user)
        return TopupConfirmOut(balance_paise=w.balance_paise, credited_paise=amount, bonus_paise=bonus)

    if pay.status != "paid":
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

    # Atomically claim the paid->consumed transition. Only the request that wins
    # this UPDATE credits the wallet — a concurrent duplicate confirm gets 0 rows
    # and returns the current balance without double-crediting.
    from sqlalchemy import text

    claimed = session.execute(
        text(
            "UPDATE payments SET status='consumed', consumed_at=:now, "
            "reference_type='wallet_topup', reference_id=:rid "
            "WHERE id=:id AND status='paid' RETURNING id"
        ).bindparams(now=datetime.utcnow(), rid=str(pay.id), id=pay.id)
    ).first()
    session.commit()
    if claimed is None:
        w = wallet_svc.get_or_create_wallet(session, user)
        return TopupConfirmOut(balance_paise=w.balance_paise, credited_paise=amount, bonus_paise=bonus)

    wallet_svc.credit(
        session, user,
        amount_paise=amount, kind="topup",
        description=f"Wallet top-up ₹{amount // 100}",
        reference_type="wallet_topup", reference_id=str(pay.id),
    )
    if bonus > 0:
        wallet_svc.credit(
            session, user,
            amount_paise=bonus, kind="bonus",
            description=f"Top-up bonus ₹{bonus // 100}",
            reference_type="wallet_topup", reference_id=str(pay.id),
        )

    w = wallet_svc.get_or_create_wallet(session, user)
    return TopupConfirmOut(balance_paise=w.balance_paise, credited_paise=amount, bonus_paise=bonus)
