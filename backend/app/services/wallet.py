"""Money wallet — atomic balance changes + a ledger (finalview.txt §12).

Every credit/debit updates `wallets.balance_paise` and appends an immutable
`wallet_transactions` row. Callers hold the DB session; the row lock via
`SELECT ... FOR UPDATE` (Postgres) keeps concurrent debits honest.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session, select

from app.models import Wallet, WalletTransaction, User


class InsufficientBalance(RuntimeError):
    def __init__(self, needed: int, available: int) -> None:
        self.needed = needed
        self.available = available
        super().__init__("Not enough wallet balance")


# Top-up bonus tiers (paise in -> bonus paise). Highest matching tier wins.
_BONUS_TIERS: list[tuple[int, int]] = [
    (200000, 30000),  # add ₹2000 -> +₹300
    (100000, 5000),   # add ₹1000 -> +₹50
    (50000, 1500),    # add  ₹500 -> +₹15
]


def bonus_for(topup_paise: int) -> int:
    for threshold, bonus in _BONUS_TIERS:
        if topup_paise >= threshold:
            return bonus
    return 0


def get_or_create_wallet(session: Session, user: User) -> Wallet:
    w = session.exec(select(Wallet).where(Wallet.user_id == user.id)).first()
    if w is None:
        w = Wallet(user_id=user.id, balance_paise=0)
        session.add(w)
        session.commit()
        session.refresh(w)
    return w


def _lock(session: Session, wallet_id: UUID) -> None:
    # Postgres row lock; harmless no-op on SQLite.
    try:
        session.exec(text("SELECT balance_paise FROM wallets WHERE id = :id FOR UPDATE").bindparams(id=str(wallet_id)))
    except Exception:  # noqa: BLE001
        pass


def credit(
    session: Session,
    user: User,
    *,
    amount_paise: int,
    kind: str,
    description: str = "",
    reference_type: str | None = None,
    reference_id: str | None = None,
) -> WalletTransaction:
    if amount_paise <= 0:
        raise ValueError("credit amount must be positive")
    w = get_or_create_wallet(session, user)
    _lock(session, w.id)
    w.balance_paise += amount_paise
    w.updated_at = datetime.utcnow()
    session.add(w)
    txn = WalletTransaction(
        user_id=user.id,
        amount_paise=amount_paise,
        kind=kind,
        balance_after=w.balance_paise,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    session.add(txn)
    session.commit()
    session.refresh(txn)
    return txn


def debit(
    session: Session,
    user: User,
    *,
    amount_paise: int,
    kind: str = "debit",
    description: str = "",
    reference_type: str | None = None,
    reference_id: str | None = None,
) -> WalletTransaction:
    if amount_paise <= 0:
        raise ValueError("debit amount must be positive")
    w = get_or_create_wallet(session, user)
    _lock(session, w.id)
    if w.balance_paise < amount_paise:
        raise InsufficientBalance(amount_paise, w.balance_paise)
    w.balance_paise -= amount_paise
    w.updated_at = datetime.utcnow()
    session.add(w)
    txn = WalletTransaction(
        user_id=user.id,
        amount_paise=-amount_paise,
        kind=kind,
        balance_after=w.balance_paise,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    session.add(txn)
    session.commit()
    session.refresh(txn)
    return txn


def recent_transactions(session: Session, user: User, limit: int = 30) -> list[WalletTransaction]:
    return session.exec(
        select(WalletTransaction)
        .where(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(limit)
    ).all()
