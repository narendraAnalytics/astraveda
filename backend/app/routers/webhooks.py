"""Clerk -> Neon user sync via Svix-signed webhooks.

Configure in the Clerk dashboard: Webhooks -> add endpoint
  URL:     https://<your-render-url>/webhooks/clerk
  events:  user.created, user.updated, user.deleted
Copy the signing secret into CLERK_WEBHOOK_SECRET.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from svix.webhooks import Webhook, WebhookVerificationError

from app.auth import get_or_create_user
from app.config import get_settings
from app.db import get_session
from app.models import User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
settings = get_settings()


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
