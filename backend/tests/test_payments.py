"""Payments — the security-critical pure logic: signature verification.

No network, no razorpay SDK, no DB. Verifies that a tampered signature / body /
secret is rejected and a correct one passes, using the same HMAC construction
Razorpay documents.
"""

import hashlib
import hmac

import pytest

from app.services import payments


def _sig(msg: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


@pytest.fixture(autouse=True)
def _keys(monkeypatch):
    monkeypatch.setattr(payments.settings, "razorpay_key_secret", "test_secret_key", raising=False)
    monkeypatch.setattr(payments.settings, "razorpay_webhook_secret", "test_wh_secret", raising=False)


# --- checkout signature: HMAC_SHA256("<order_id>|<payment_id>", key_secret) ---

def test_checkout_signature_accepts_authentic():
    order, pay = "order_ABC", "pay_XYZ"
    good = _sig(f"{order}|{pay}".encode(), "test_secret_key")
    payments.verify_checkout_signature(order_id=order, payment_id=pay, signature=good)  # no raise


def test_checkout_signature_rejects_tampered():
    order, pay = "order_ABC", "pay_XYZ"
    good = _sig(f"{order}|{pay}".encode(), "test_secret_key")
    with pytest.raises(payments.PaymentError):
        payments.verify_checkout_signature(order_id=order, payment_id=pay, signature=good[:-1] + "0")
    with pytest.raises(payments.PaymentError):
        payments.verify_checkout_signature(order_id=order, payment_id="pay_OTHER", signature=good)
    with pytest.raises(payments.PaymentError):
        payments.verify_checkout_signature(order_id=order, payment_id=pay, signature="")


# --- webhook signature: HMAC_SHA256(raw_body, webhook_secret) ---

def test_webhook_accepts_authentic_and_returns_event():
    body = b'{"event":"order.paid","payload":{}}'
    good = _sig(body, "test_wh_secret")
    event = payments.verify_webhook(body=body, signature=good)
    assert event["event"] == "order.paid"


def test_webhook_rejects_wrong_secret_or_body():
    body = b'{"event":"order.paid"}'
    wrong = _sig(body, "not_the_secret")
    with pytest.raises(payments.PaymentError):
        payments.verify_webhook(body=body, signature=wrong)
    good = _sig(body, "test_wh_secret")
    with pytest.raises(payments.PaymentError):
        payments.verify_webhook(body=b'{"event":"tampered"}', signature=good)


def test_webhook_requires_configured_secret(monkeypatch):
    monkeypatch.setattr(payments.settings, "razorpay_webhook_secret", "", raising=False)
    with pytest.raises(payments.PaymentError):
        payments.verify_webhook(body=b"{}", signature="whatever")
