"""Sarvam Voice Agents (Samvaad) — place the outbound "Ask AstraVeda" call.

Runbook: sarvamvoice.txt. The essentials that bite:
  * auth header is  X-API-Key  (NOT api-subscription-key)
  * host is  apps.sarvam.ai  (NOT api.sarvam.ai)
  * app_version is an INTEGER and must be a COMMITTED version
  * every key in agent_variables must be declared on that committed version,
    else Sarvam 422s and names it
  * instant outbound has no on-start webhook — pass all context up front;
    webhook_config.metadata is echoed back verbatim on the end-of-call webhook.

This service is stateless and synchronous (httpx.Client). Callers in async
routes wrap it with anyio.to_thread.run_sync.
"""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

settings = get_settings()
log = logging.getLogger("astraveda.voice")


class VoiceError(RuntimeError):
    pass


# Input agent_variables declared on the committed agent (app_version 1). Sending
# a key that is NOT on this list makes Sarvam 422. `app_language` is deliberately
# absent — the committed agent does not declare it (English only for v1).
_INPUT_KEYS = (
    "caller_name",
    "user_name",
    "birth_date",
    "birth_time",
    "birth_place",
    "consultation_topic",
    "user_question",
    "booking_type",
    "slot_label",
    "has_saved_kundali",
)


def is_configured() -> bool:
    s = settings
    return bool(
        s.sarvam_voice_api_key
        and s.sarvam_voice_org_id
        and s.sarvam_voice_workspace_id
        and s.sarvam_voice_app_id
        and s.sarvam_voice_connection_id
        and s.sarvam_voice_agent_phone_number
    )


def _outbounds_url() -> str:
    s = settings
    return (
        f"{s.sarvam_voice_base_url}/api/outbounds/v1"
        f"/orgs/{s.sarvam_voice_org_id}/workspaces/{s.sarvam_voice_workspace_id}/outbounds"
    )


def agent_variables(c) -> dict:
    """Build the agent_variables block from a Consultation row. Only keys the
    committed agent declares; every value coerced to a non-empty string."""
    raw = {
        "caller_name": c.caller_name,
        "user_name": c.caller_name,
        "birth_date": c.birth_date.isoformat() if c.birth_date else "unknown",
        "birth_time": (
            "unknown" if (c.unknown_time or not c.birth_time)
            else c.birth_time.strftime("%H:%M")
        ),
        "birth_place": c.birth_place or "unknown",
        "consultation_topic": c.consultation_topic or "general",
        "user_question": c.user_question or "a general life reading",
        "booking_type": c.booking_type,
        "slot_label": c.slot_label or "now",
        "has_saved_kundali": "yes" if c.latitude is not None else "no",
    }
    return {k: (str(raw.get(k)) or "unknown") for k in _INPUT_KEYS}


def place_call(c) -> str:
    """Place the outbound call for Consultation `c`. Returns the Sarvam
    attempt_id. Raises VoiceError with the raw provider body on any failure."""
    if not is_configured():
        raise VoiceError("Sarvam Voice is not configured on the server")

    payload = {
        "app_config": {
            "app_id": settings.sarvam_voice_app_id,
            "app_version": int(settings.sarvam_voice_app_version),
            "app_type": "agent",
            "connection_config": {
                "connection_id": settings.sarvam_voice_connection_id,
                "agent_phone_number": settings.sarvam_voice_agent_phone_number,
            },
            "agent_variables": agent_variables(c),
            # Keep overrides minimal — the committed agent owns its greeting and
            # entry state. initial_bot_message here can break call start if the
            # agent has no matching state. Language only.
            "app_overrides": {"initial_language_name": "English"},
        },
        "user_config": {"user_phone_number": c.phone_e164},
        "webhook_config": {
            "url": f"{settings.public_base_url.rstrip('/')}/webhooks/sarvam",
            "metadata": {
                "consultation_id": str(c.id),
                "secret": settings.sarvam_voice_webhook_secret,
            },
        },
    }
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": settings.sarvam_voice_api_key,
    }

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(_outbounds_url(), json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise VoiceError(f"Sarvam request failed: {exc}") from exc

    if resp.status_code not in (200, 201, 202):
        # Keep the provider's raw body flowing (sarvamvoice.txt §7 lesson 1).
        raise VoiceError(f"Sarvam {resp.status_code}: {resp.text[:800]}")

    try:
        data = resp.json()
    except ValueError as exc:
        raise VoiceError(f"Sarvam returned a non-JSON response: {resp.text[:300]}") from exc

    attempt_id = data.get("attempt_id") or data.get("id")
    if not attempt_id:
        raise VoiceError(f"Sarvam response had no attempt_id: {str(data)[:300]}")
    return str(attempt_id)


def derive_outcome(status: str | None, final_vars: dict | None) -> tuple[str, str]:
    """Map (call status, extracted output vars) -> (Consultation.status, outcome).

    Consultation.status stays one of: completed | missed | callback_requested.
    """
    fv = final_vars or {}
    if (status or "").lower() != "connected":
        return "missed", (status or "no_answer")
    if str(fv.get("callback_window") or "").strip():
        return "callback_requested", "callback_requested"
    if fv.get("consultation_completed") == "yes":
        return "completed", "completed"
    if fv.get("follow_up_requested") == "yes":
        return "completed", "follow_up_requested"
    return "completed", "completed_unclear"
