from datetime import date, datetime, time
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel, UniqueConstraint


class Translation(SQLModel, table=True):
    __tablename__ = "translations"
    __table_args__ = (UniqueConstraint("source_hash", "target_lang", name="uq_translation"),)

    id: int | None = Field(default=None, primary_key=True)
    source_hash: str = Field(index=True)
    source_lang: str = Field(default="en")
    target_lang: str
    source_text: str
    translated_text: str
    model: str = Field(default="sarvam-translate:v1")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    """AstraVeda account. Clerk owns identity (email, auth, sessions); this row
    holds the app-specific profile and the permanent link via clerk_user_id.
    """

    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    clerk_user_id: str = Field(index=True, unique=True)

    # Mirrored from Clerk for convenience/display only — Clerk stays authoritative.
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    image_url: str | None = None

    # App-owned data.
    language: str = Field(default="en")
    date_of_birth: date | None = None
    birth_time: time | None = None
    birth_place: str | None = None
    timezone: str | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None
