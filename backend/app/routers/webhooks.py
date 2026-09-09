"""Clerk -> Neon user sync via Svix-signed webhooks.

Configure in the Clerk dashboard: Webhooks -> add endpoint
  URL:     https://<your-render-url>/webhooks/clerk
  events:  user.created, user.updated, user.deleted
Copy the signing secret into CLERK_WEBHOOK_SECRET.
"""

from __future__ import annotations

import hmac
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from svix.webhooks import Webhook, WebhookVerificationError

from app.auth import get_or_create_user
from app.config import get_settings
from app.db import get_session
from app.models import Consultation, Payment, PaymentWebhook, User
from app.services import payments, voice

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
settings = get_settings()
log = logging.getLogger("astraveda.webhooks")


def _primary_email(data: dict) -> str | None:
    pid = data.get("primary_email_address_id")
    for addr in data.get("email_addresses", []):
        if addr.get("id") == pid:
            return addr.get("email_address")
    addrs = data.get("email_addresses", [])
    return addrs[0].get("email_address") if addrs else None


@router.post("/clerk")
async def clerk_webhook(request: Request, session: Session = Depends(get_session)) -> dict:
    if not settings.clerk_webhook_secret:
        raise HTTPException(status_code=500, detail="CLERK_WEBHOOK_SECRET is not configured")

    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    try:
        event = Webhook(settings.clerk_webhook_secret).verify(payload, headers)
    except WebhookVerificationError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc

    event_type = event.get("type")
    data = event.get("data", {})
    clerk_id = data.get("id")
    if not clerk_id:
        return {"ok": True, "skipped": "no id"}

    if event_type in ("user.created", "user.updated"):
        get_or_create_user(
            session,
            clerk_id,
            email=_primary_email(data),
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            username=data.get("username"),
            image_url=data.get("image_url"),
        )
    elif event_type == "user.deleted":
        user = session.exec(select(User).where(User.clerk_user_id == clerk_id)).first()
        if user:
            user.deleted_at = datetime.utcnow()
            session.add(user)
            session.commit()

    return {"ok": True, "type": event_type}


@router.post("/razorpay")
async def razorpay_webhook(request: Request, session: Session = Depends(get_session)) -> dict:
    """Razorpay events — the source of truth for payment status.

    Configure in the Razorpay dashboard: Settings -> Webhooks -> add
      URL:     https://<your-render-url>/webhooks/razorpay
      events:  order.paid, payment.failed
    Copy the secret into RAZORPAY_WEBHOOK_SECRET. Idempotent on the event id.
    """
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    try:
        event = payments.verify_webhook(body=body, signature=signature)
    except payments.PaymentError as exc:
        log.warning(
            "razorpay webhook rejected: %s (sig_present=%s, secret_configured=%s, body_len=%d)",
            exc,
            bool(signature),
            bool(settings.razorpay_webhook_secret),
            len(body),
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    event_id = request.headers.get("x-razorpay-event-id", "")
    event_type = event.get("event", "")

    if event_id:
        seen = session.exec(
            select(PaymentWebhook).where(PaymentWebhook.razorpay_event_id == event_id)
        ).first()
        if seen is not None:
            return {"ok": True, "duplicate": True}
        session.add(
            PaymentWebhook(razorpay_event_id=event_id, event=event_type, payload=event)
        )
        session.commit()

    entities = event.get("payload") or {}
    order_ent = (entities.get("order") or {}).get("entity") or {}
    payment_ent = (entities.get("payment") or {}).get("entity") or {}
    order_id = order_ent.get("id") or payment_ent.get("order_id")

    if order_id:
        pay = session.exec(
            select(Payment).where(Payment.razorpay_order_id == order_id)
        ).first()
        if pay is not None and pay.status == "created":
            if event_type in ("order.paid", "payment.captured"):
                pay.status = "paid"
                pay.paid_at = datetime.utcnow()
                pay.razorpay_payment_id = pay.razorpay_payment_id or payment_ent.get("id")
                session.add(pay)
                session.commit()
            elif event_type == "payment.failed":
                pay.status = "failed"
                session.add(pay)
                session.commit()

    if event_id:
        wh = session.exec(
            select(PaymentWebhook).where(PaymentWebhook.razorpay_event_id == event_id)
        ).first()
        if wh is not None:
            wh.processed = True
            session.add(wh)
            session.commit()

    return {"ok": True, "event": event_type}


@router.post("/sarvam")
async def sarvam_voice_webhook(
    request: Request, session: Session = Depends(get_session)
) -> dict:
    """End-of-call webhook for Ask AstraVeda voice consultations.

    Sarvam POSTs here after EVERY attempt (connected or not). Auth is the shared
    secret we put in webhook_config.metadata when placing the call — Sarvam
    echoes metadata back verbatim (sarvamvoice.txt §6). Idempotent on the
    consultation id.
    """
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Body is not valid JSON") from exc

    meta = (payload.get("webhook_config") or {}).get("metadata") or {}
    secret = str(meta.get("secret") or "")
    if not settings.sarvam_voice_webhook_secret or not hmac.compare_digest(
        secret, settings.sarvam_voice_webhook_secret
    ):
        raise HTTPException(status_code=401, detail="bad secret")

    cid = meta.get("consultation_id")
    if not cid:
        return {"ok": True, "skipped": "no consultation id"}
    try:
        row = session.get(Consultation, UUID(str(cid)))
    except ValueError:
        row = None
    if row is None:
        return {"ok": True, "skipped": "unknown consultation"}
    if row.status in ("completed", "missed", "callback_requested"):
        return {"ok": True, "duplicate": True}

    final_vars = payload.get("final_agent_variables") or {}
    new_status, outcome = voice.derive_outcome(payload.get("status"), final_vars)

    dur = payload.get("duration")
    row.status = new_status
    row.outcome = outcome
    row.duration_sec = int(dur) if isinstance(dur, (int, float)) else None
    row.interaction_id = payload.get("interaction_id") or row.interaction_id
    row.failure_reason = payload.get("failure_reason") or row.failure_reason
    row.final_vars = final_vars
    row.call_summary = str(final_vars.get("call_summary") or "")
    row.transcript = [
        {"role": t.get("role"), "text": t.get("en_text") or t.get("text") or ""}
        for t in (payload.get("interaction_transcript") or [])
        if isinstance(t, dict)
    ]
    row.completed_at = datetime.utcnow()
    session.add(row)
    session.commit()
    return {"ok": True, "status": new_status}
