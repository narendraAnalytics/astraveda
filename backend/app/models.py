from datetime import date, datetime, time
from uuid import UUID, uuid4

from sqlalchemy import JSON
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


class Kundali(SQLModel, table=True):
    """One generated Vedic birth chart for a user. Chart math is computed
    server-side (jyotishyamitra / Swiss Ephemeris) and cached here so opening
    "My Kundli" again is instant — no recompute, no re-call to Sarvam."""

    __tablename__ = "kundalis"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")

    # Birth details as entered.
    name: str
    birth_date: date
    birth_time: time
    unknown_time: bool = False
    birth_place: str
    latitude: float
    longitude: float
    timezone: str  # IANA name, e.g. "Asia/Kolkata"
    tz_offset: float  # decimal hours at the birth instant (historical DST resolved)

    # Normalized chart the app renders (Lagna, Rashi, Nakshatra, panchanga,
    # D1 houses/planets, Vimshottari timeline). `raw` keeps the full engine
    # output for later phases (D2–D60, shadbala, ashtakavarga).
    chart: dict = Field(default_factory=dict, sa_type=JSON)
    raw: dict | None = Field(default=None, sa_type=JSON)

    reading_en: str | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
