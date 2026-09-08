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


class PanchangCache(SQLModel, table=True):
    """Computed daily guidance ("Today's Cosmic Guidance") keyed by date + place.
    Not user data — the home-screen widget is the same for everyone at a given
    location. Recomputed at most once per day per rounded lat/lon."""

    __tablename__ = "panchang_cache"

    id: int | None = Field(default=None, primary_key=True)
    cache_key: str = Field(index=True, unique=True)  # "2026-09-07|28.614|77.209"
    payload: dict = Field(default_factory=dict, sa_type=JSON)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Payment(SQLModel, table=True):
    """One Razorpay payment. Immutable ledger (finalview.txt §7/§10): the row is
    only ever advanced created → paid → consumed (or → failed). Money logic is
    server-authoritative — `amount_paise` is set from config, never the client.
    """

    __tablename__ = "payments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")

    purpose: str = Field(default="kundali")  # kundali | face | aura | (later: wallet_topup …)
    amount_paise: int
    currency: str = Field(default="INR")

    razorpay_order_id: str = Field(index=True, unique=True)
    razorpay_payment_id: str | None = None

    status: str = Field(default="created")  # created | paid | consumed | failed

    # What the payment unlocked, once consumed.
    reference_type: str | None = None  # "kundali"
    reference_id: str | None = None    # kundali id (str) — plain, not a FK (avoids a cycle)

    # Birth details captured at checkout; generate trusts THIS, not a fresh
    # client payload, so a paid order can't be redirected to a different chart.
    birth_snapshot: dict = Field(default_factory=dict, sa_type=JSON)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: datetime | None = None
    consumed_at: datetime | None = None


class PaymentWebhook(SQLModel, table=True):
    """Raw Razorpay webhook events, deduped on the event id so a redelivery
    can't double-process (finalview.txt §10 / roadmap 1E)."""

    __tablename__ = "payment_webhooks"

    id: int | None = Field(default=None, primary_key=True)
    razorpay_event_id: str = Field(index=True, unique=True)
    event: str
    payload: dict = Field(default_factory=dict, sa_type=JSON)
    processed: bool = Field(default=False)
    received_at: datetime = Field(default_factory=datetime.utcnow)


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
    relation: str | None = None  # Self | Spouse | Child | Mother | Father | Sibling | Friend | Other
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

    # The ₹15 payment that unlocked this chart (null for charts created before
    # payments were switched on).
    payment_id: UUID | None = Field(default=None, foreign_key="payments.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class PalmReading(SQLModel, table=True):
    """One guided Vedic palm reading (Hasta Samudrika Shastra) for a user.

    v1 takes self-reported hand features only — no photo computer vision. The
    structured answers are persisted here and Sarvam turns them into the
    narrative, cached on `reading_en` so re-opening is instant.
    """

    __tablename__ = "palm_readings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")

    name: str
    relation: str | None = None  # Self | Spouse | Child | Mother | Father | Sibling | Friend | Other

    dominant_hand: str  # Left | Right
    hand_shape: str  # Earth | Air | Fire | Water
    finger_length: str | None = None  # Short | Balanced | Long
    thumb_flex: str | None = None  # Firm | Balanced | Flexible

    lines: dict = Field(default_factory=dict, sa_type=JSON)  # {heart, head, life, fate}
    mounts: list = Field(default_factory=list, sa_type=JSON)  # ["Jupiter", ...]
    marks: list = Field(default_factory=list, sa_type=JSON)  # ["Fish", ...]
    profile: dict = Field(default_factory=dict, sa_type=JSON)  # normalized facts fed to Sarvam

    source: str = Field(default="guided")  # guided | scan  (how the features were captured)

    reading_en: str | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class FaceReading(SQLModel, table=True):
    """One Vedic face reading (Mukha Samudrika Shastra) for a user.

    Gemini reads the selfie into structured features; Sarvam turns them into the
    narrative (cached on `reading_en`). The photo is never stored server-side —
    it lives only in the scan request and, as a keepsake, on the user's device.
    Every reading is a paid ₹45 Razorpay order (server-authoritative).
    """

    __tablename__ = "face_readings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")

    name: str
    relation: str | None = None  # Self | Spouse | Child | ...

    face_shape: str  # Oval | Round | Square | Oblong | Heart | Diamond | Unknown

    features: dict = Field(default_factory=dict, sa_type=JSON)  # forehead, eyes, nose, ...
    marks: list = Field(default_factory=list, sa_type=JSON)
    profile: dict = Field(default_factory=dict, sa_type=JSON)  # normalized facts fed to Sarvam

    source: str = Field(default="scan")  # scan | guided

    reading_en: str | None = None

    payment_id: UUID | None = Field(default=None, foreign_key="payments.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuraReading(SQLModel, table=True):
    """One AR Aura & Energy Scan for a user (finalview.txt §"AR Aura & Energy Scan").

    Gemini reads the selfie's colour/light into a suggested aura palette; the
    user's short energy quiz steers the chakra map; Sarvam writes the narrative
    (cached on `reading_en`). The selfie is never stored server-side. Every scan
    is a paid ₹60 Razorpay order (server-authoritative).
    """

    __tablename__ = "aura_readings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True, foreign_key="users.id")

    name: str
    relation: str | None = None

    dominant_color: str  # Red | Orange | Yellow | Gold | Green | Teal | Blue | Indigo | Violet | Pink | White
    secondary_colors: list = Field(default_factory=list, sa_type=JSON)

    features: dict = Field(default_factory=dict, sa_type=JSON)  # brightness, warmth, visual_notes
    quiz: dict = Field(default_factory=dict, sa_type=JSON)  # the 4 energy-quiz answers
    profile: dict = Field(default_factory=dict, sa_type=JSON)  # normalized facts fed to Sarvam

    source: str = Field(default="scan")

    reading_en: str | None = None

    payment_id: UUID | None = Field(default=None, foreign_key="payments.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
