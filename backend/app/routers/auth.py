from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.auth import ClerkClaims, get_current_claims, get_or_create_user
from app.db import get_session
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class SyncIn(BaseModel):
    # Optional hints from the client (Clerk claims are the source of truth for identity).
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    image_url: str | None = None
    language: str | None = None


class UserOut(BaseModel):
    id: str
    clerk_user_id: str
    email: str | None
    first_name: str | None
    username: str | None
    image_url: str | None
    language: str

    @classmethod
    def of(cls, u: User) -> "UserOut":
        return cls(
            id=str(u.id),
            clerk_user_id=u.clerk_user_id,
            email=u.email,
            first_name=u.first_name,
            username=u.username,
            image_url=u.image_url,
            language=u.language,
        )


@router.post("/sync", response_model=UserOut)
async def sync_user(
    body: SyncIn,
    claims: ClerkClaims = Depends(get_current_claims),
    session: Session = Depends(get_session),
) -> UserOut:
    """Called by the app right after sign-in. Upserts the Neon user row from the
    verified Clerk id plus any client-provided profile fields."""
    user = get_or_create_user(
        session,
        claims.user_id,
        email=body.email or claims.get("email"),
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username,
        image_url=body.image_url,
        language=body.language,
    )
    return UserOut.of(user)


@router.get("/me", response_model=UserOut)
async def me(
    claims: ClerkClaims = Depends(get_current_claims),
    session: Session = Depends(get_session),
) -> UserOut:
    return UserOut.of(get_or_create_user(session, claims.user_id))
