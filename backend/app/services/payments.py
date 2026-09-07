"""Razorpay — order creation and signature verification.

Server-authoritative money (finalview.txt §10): the client never sends an
amount and the backend never trusts a raw "payment succeeded" from the app.
Trust comes from either
  * `verify_checkout_signature()` — the HMAC Razorpay Checkout returns, plus an
    `order_fetch()` that the order really is paid  (synchronous fast path), or
  * the `order.paid` webhook, HMAC-verified over the raw body  (source of truth).
"""

from __future__ import annotations

import hashlib
import hmac
import json
from functools import lru_cache

from app.config import get_settings

settings = get_settings()


class PaymentError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


@lru_cache
def _client():
    if not is_configured():
        raise PaymentError("Razorpay keys are not configured")
    import razorpay  # lazy: a missing dep only breaks payments, not the whole API

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    try:
        client.set_app_details({"title": "AstraVeda", "version": "1.0"})
    except Exception:  # noqa: BLE001 - cosmetic only
        pass
    return client


def create_order(*, amount_paise: int, receipt: str, notes: dict) -> dict:
    try:
        return _client().order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": notes,
                "payment_capture": 1,
            }
        )
    except PaymentError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise PaymentError(f"Could not create payment order: {exc}") from exc


def verify_checkout_signature(*, order_id: str, payment_id: str, signature: str) -> None:
    """Raise PaymentError unless the three fields Razorpay Checkout handed the
    client are an authentic `HMAC_SHA256(order_id|payment_id, key_secret)`."""
    expected = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature or ""):
        raise PaymentError("Payment signature verification failed")


def order_is_paid(order_id: str) -> bool:
    try:
        order = _client().order.fetch(order_id)
    except PaymentError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise PaymentError(f"Could not fetch order: {exc}") from exc
    return order.get("status") == "paid"


def verify_webhook(*, body: bytes, signature: str) -> dict:
    """Verify the `X-Razorpay-Signature` HMAC over the raw request body and
    return the parsed event. Raises PaymentError on any mismatch."""
    secret = settings.razorpay_webhook_secret
    if not secret:
        raise PaymentError("RAZORPAY_WEBHOOK_SECRET is not configured")
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature or ""):
        raise PaymentError("Webhook signature verification failed")
    try:
        return json.loads(body.decode("utf-8"))
    except ValueError as exc:
        raise PaymentError("Webhook body is not valid JSON") from exc
