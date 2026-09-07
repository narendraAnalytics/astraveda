"""Clerk session-token verification for FastAPI.

The app sends the Clerk session JWT as `Authorization: Bearer <token>`. We verify
it locally against Clerk's PEM public key (no network call) and return the Clerk
user id (`sub`). `get_or_create_user` is the request-time safety net that
guarantees a Neon row exists even if the Clerk webhook was slow or dropped.
"""

from __future__ import annotations

import re
import textwrap
from datetime import datetime
from functools import lru_cache

import jwt
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_session
from app.models import User

settings = get_settings()


class ClerkClaims(dict):
    @property
    def user_id(self) -> str:
        return self["sub"]


@lru_cache
def _public_key() -> str:
    """Return a canonical PEM public key from CLERK_JWT_KEY, tolerating every way
    it gets mangled in an env var: real newlines, literal ``\\n``, one line with
    spaces, a truncated ``-----END PUBLIC KEY-`` footer, or the bare base64 body.
    We keep only base64 characters, then re-wrap into a clean 64-column PEM and
    verify it actually loads."""
    raw = settings.clerk_jwt_key.strip()
    if not raw:
        raise HTTPException(status_code=500, detail="CLERK_JWT_KEY is not configured")

    raw = raw.replace("\\n", "\n")
    # Drop any PEM armor, however mangled ("-----BEGIN PUBLIC KEY-----",
    # "-----END PUBLIC KEY-", "BEGIN RSA PUBLIC KEY", ...).
    body = re.sub(r"-*\s*(BEGIN|END)[A-Z0-9 ]*KEY\s*-*", "", raw, flags=re.IGNORECASE)
    # Keep only the base64 alphabet.
    body = re.sub(r"[^A-Za-z0-9+/=]", "", body)
    if len(body) < 100:
        raise HTTPException(status_code=500, detail="CLERK_JWT_KEY is malformed or truncated")

    pem = "-----BEGIN PUBLIC KEY-----\n" + "\n".join(textwrap.wrap(body, 64)) + "\n-----END PUBLIC KEY-----\n"
    try:
        load_pem_public_key(pem.encode())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=(
                "CLERK_JWT_KEY could not be parsed as a public key. Paste the full "
                "PEM from the Clerk dashboard (API Keys -> Show JWT public key), "
                f"including the BEGIN/END lines. ({exc})"
            ),
        ) from exc
    return pem


def verify_token(token: str) -> ClerkClaims:
    try:
        payload = jwt.decode(
            token,
            _public_key(),
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={"verify_aud": False},
            leeway=5,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid session token: {exc}",
        ) from exc
    if "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub claim")
    return ClerkClaims(payload)


async def get_current_claims(authorization: str | None = Header(default=None)) -> ClerkClaims:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return verify_token(authorization.split(" ", 1)[1].strip())


def get_or_create_user(session: Session, clerk_user_id: str, **fields) -> User:
    user = session.exec(select(User).where(User.clerk_user_id == clerk_user_id)).first()
    now = datetime.utcnow()
    if user is None:
        user = User(clerk_user_id=clerk_user_id, **_clean(fields))
        session.add(user)
    else:
        for key, value in _clean(fields).items():
            setattr(user, key, value)
        user.updated_at = now
    user.last_seen_at = now
    session.commit()
    session.refresh(user)
    return user


def _clean(fields: dict) -> dict:
    return {k: v for k, v in fields.items() if v is not None}


async def get_current_user(
    claims: ClerkClaims = Depends(get_current_claims),
    session: Session = Depends(get_session),
) -> User:
    return get_or_create_user(session, claims.user_id)
