"""Palm Reading (Hasta Samudrika Shastra) — guided questionnaire + AI reading.

Two-phase, mirroring the Kundali router: `POST /palm/generate` persists the
answers and returns immediately; the app renders the result and then calls
`POST /palm/{id}/reading` for the (slower) Sarvam narrative. Everything is
persisted so re-opening is instant. No photo computer vision in v1 — the
optional palm photo stays on the user's device.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_current_user
from app.db import get_session
from app.models import PalmReading, User
from app.services import palm_reading, palm_vision

router = APIRouter(prefix="/palm", tags=["palm"])

RELATIONS = {"Self", "Spouse", "Child", "Mother", "Father", "Sibling", "Friend", "Other"}
HANDS = {"Left", "Right"}
SHAPES = {"Earth", "Air", "Fire", "Water"}
FINGER_LENGTHS = {"Short", "Balanced", "Long"}
THUMB_FLEX = {"Firm", "Balanced", "Flexible"}
LINE_KEYS = {"heart", "head", "life", "fate"}
MOUNTS = {"Jupiter", "Saturn", "Sun", "Mercury", "Venus", "Moon", "Mars"}

_HAND_SHAPE_TRAIT = {
    "Earth": "grounded, practical",
    "Air": "curious, communicative",
    "Fire": "driven, expressive",
    "Water": "sensitive, intuitive",
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GenerateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    dominant_hand: str
    hand_shape: str
    finger_length: str | None = None
    thumb_flex: str | None = None
    lines: dict[str, str] = Field(default_factory=dict)
    mounts: list[str] = Field(default_factory=list)
    marks: list[str] = Field(default_factory=list)


class ScanIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relation: str | None = None
    dominant_hand: str | None = None  # user tells us which hand they photographed
    image: str = Field(min_length=32)  # base64 (no data: prefix)
    mime_type: str = "image/jpeg"


class PalmOut(BaseModel):
    id: str
    name: str
    relation: str | None
    dominant_hand: str
    hand_shape: str
    finger_length: str | None
    thumb_flex: str | None
    lines: dict
    mounts: list
    marks: list
    profile: dict
    source: str
    reading_en: str | None
    created_at: datetime

    @classmethod
    def of(cls, r: PalmReading) -> "PalmOut":
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_hand=r.dominant_hand,
            hand_shape=r.hand_shape,
            finger_length=r.finger_length,
            thumb_flex=r.thumb_flex,
            lines=r.lines or {},
            mounts=r.mounts or [],
            marks=r.marks or [],
            profile=r.profile or {},
            source=r.source or "guided",
            reading_en=r.reading_en,
            created_at=r.created_at,
        )


class PalmSummary(BaseModel):
    """Lightweight row for the "your palms" gallery."""

    id: str
    name: str
    relation: str | None
    dominant_hand: str
    hand_shape: str
    headline_trait: str
    source: str
    has_reading: bool
    created_at: datetime

    @classmethod
    def of(cls, r: PalmReading) -> "PalmSummary":
        heart = (r.lines or {}).get("heart")
        bits = []
        if r.hand_shape and r.hand_shape != "Unknown":
            bits.append(f"{r.hand_shape} hand")
        if heart and heart not in ("Not sure", "not visible"):
            bits.append(f"{heart.lower()} heart line")
        if not bits:
            bits.append("Palm reading")
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_hand=r.dominant_hand,
            hand_shape=r.hand_shape,
            headline_trait=" · ".join(bits),
            source=r.source or "guided",
            has_reading=bool(r.reading_en),
            created_at=r.created_at,
        )


class ReadingOut(BaseModel):
    reading_en: str
    cached: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_lines(raw: dict[str, str]) -> dict[str, str]:
    return {k: str(v)[:80] for k, v in raw.items() if k in LINE_KEYS and v}


class Features(BaseModel):
    name: str
    relation: str | None = None
    dominant_hand: str
    hand_shape: str
    finger_length: str | None = None
    thumb_flex: str | None = None
    lines: dict[str, str] = Field(default_factory=dict)
    mounts: list[str] = Field(default_factory=list)
    marks: list[str] = Field(default_factory=list)
    source: str = "guided"
    observations: str | None = None


def _signature(f: Features) -> str:
    blob = json.dumps(
        {
            "hand": f.dominant_hand,
            "shape": f.hand_shape,
            "fingers": f.finger_length,
            "thumb": f.thumb_flex,
            "lines": f.lines,
            "mounts": sorted(f.mounts),
        },
        sort_keys=True,
    )
    return hashlib.sha1(blob.encode()).hexdigest()


def _build_profile(f: Features) -> dict:
    return {
        "name": f.name.strip(),
        "dominant_hand": f.dominant_hand,
        "hand_shape": f.hand_shape,
        "hand_shape_trait": _HAND_SHAPE_TRAIT.get(f.hand_shape, ""),
        "finger_length": f.finger_length,
        "thumb_flex": f.thumb_flex,
        "lines": f.lines,
        "mounts": f.mounts,
        "marks": f.marks,
        "observations": f.observations,
        "source": f.source,
        "signature": _signature(f),
    }


def _upsert(session: Session, user: User, f: Features) -> PalmReading:
    """Insert a new palm reading, or update the matching one in place (same
    person + same feature signature) so regenerating doesn't pile up copies."""
    profile = _build_profile(f)
    name = f.name.strip()
    existing = session.exec(select(PalmReading).where(PalmReading.user_id == user.id)).all()
    row = next(
        (
            r
            for r in existing
            if r.name.strip().lower() == name.lower()
            and (r.relation or None) == f.relation
            and (r.profile or {}).get("signature") == profile["signature"]
        ),
        None,
    )
    if row is None:
        row = PalmReading(user_id=user.id)
        session.add(row)

    row.name = name
    row.relation = f.relation or row.relation
    row.dominant_hand = f.dominant_hand
    row.hand_shape = f.hand_shape
    row.finger_length = f.finger_length
    row.thumb_flex = f.thumb_flex
    row.lines = f.lines
    row.mounts = f.mounts
    row.marks = f.marks
    row.profile = profile
    row.source = f.source

    session.commit()
    session.refresh(row)
    return row


def _get_owned(session: Session, user: User, palm_id: str) -> PalmReading:
    try:
        pid = UUID(palm_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Palm reading not found") from exc
    row = session.get(PalmReading, pid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Palm reading not found")
    return row


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=PalmOut)
async def generate_palm(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    if body.dominant_hand not in HANDS:
        raise HTTPException(status_code=422, detail="dominant_hand must be Left or Right")
    if body.hand_shape not in SHAPES:
        raise HTTPException(status_code=422, detail="hand_shape must be Earth, Air, Fire or Water")

    f = Features(
        name=body.name.strip(),
        relation=body.relation if body.relation in RELATIONS else None,
        dominant_hand=body.dominant_hand,
        hand_shape=body.hand_shape,
        finger_length=body.finger_length if body.finger_length in FINGER_LENGTHS else None,
        thumb_flex=body.thumb_flex if body.thumb_flex in THUMB_FLEX else None,
        lines=_clean_lines(body.lines),
        mounts=[m for m in body.mounts if m in MOUNTS][:2],
        marks=[str(m)[:40] for m in body.marks if m][:8],
        source="guided",
    )
    return PalmOut.of(_upsert(session, user, f))


@router.post("/scan", response_model=PalmOut)
async def scan_palm(
    body: ScanIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    """Analyse a palm photo with Gemini Vision, then persist the derived features
    (same shape as /generate). The narrative reading still comes from Sarvam via
    POST /palm/{id}/reading. The image is not stored."""
    raw = body.image.split(",", 1)[-1].strip()  # tolerate a data: URI prefix
    try:
        base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="image is not valid base64") from exc

    try:
        v = await palm_vision.analyze_palm(raw, body.mime_type or "image/jpeg")
    except palm_vision.VisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Palm scan failed: {exc}") from exc

    if not v.get("is_hand", False):
        raise HTTPException(status_code=422, detail="That doesn't look like an open palm — please retake the photo.")
    if v.get("image_quality") == "poor":
        reason = v.get("retake_reason") or "the lines aren't clear enough"
        raise HTTPException(status_code=422, detail=f"Please retake the photo — {reason}.")

    def _enum(val, allowed):
        return val if val in allowed else None

    hand_shape = _enum(v.get("hand_shape"), SHAPES) or "Unknown"
    dominant = (
        body.dominant_hand
        if body.dominant_hand in HANDS
        else _enum(v.get("dominant_hand_guess"), HANDS) or "Right"
    )
    lines = _clean_lines(
        {k: val for k, val in (v.get("lines") or {}).items() if val and val != "not visible"}
    )

    f = Features(
        name=body.name.strip(),
        relation=body.relation if body.relation in RELATIONS else None,
        dominant_hand=dominant,
        hand_shape=hand_shape,
        finger_length=_enum(v.get("finger_length"), FINGER_LENGTHS),
        thumb_flex=_enum(v.get("thumb_flex"), THUMB_FLEX),
        lines=lines,
        mounts=[m for m in (v.get("mounts") or []) if m in MOUNTS][:3],
        marks=[str(m)[:60] for m in (v.get("marks") or []) if m][:8],
        source="scan",
        observations=(str(v.get("observations"))[:600] if v.get("observations") else None),
    )
    return PalmOut.of(_upsert(session, user, f))


@router.get("", response_model=PalmOut)
async def latest_palm(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    row = session.exec(
        select(PalmReading)
        .where(PalmReading.user_id == user.id)
        .order_by(PalmReading.created_at.desc())
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="No palm reading yet")
    return PalmOut.of(row)


@router.get("/list", response_model=list[PalmSummary])
async def list_palms(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[PalmSummary]:
    rows = session.exec(
        select(PalmReading)
        .where(PalmReading.user_id == user.id)
        .order_by(PalmReading.created_at.desc())
    ).all()
    return [PalmSummary.of(r) for r in rows]


@router.get("/{palm_id}", response_model=PalmOut)
async def get_palm(
    palm_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PalmOut:
    return PalmOut.of(_get_owned(session, user, palm_id))


@router.delete("/{palm_id}")
async def delete_palm(
    palm_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    row = _get_owned(session, user, palm_id)
    session.delete(row)
    session.commit()
    return {"deleted": True}


@router.post("/{palm_id}/reading", response_model=ReadingOut)
async def palm_reading_route(
    palm_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ReadingOut:
    row = _get_owned(session, user, palm_id)
    if row.reading_en:
        return ReadingOut(reading_en=row.reading_en, cached=True)

    try:
        text = await palm_reading.generate_reading(row)
    except palm_reading.ReadingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - never leak a bare 500 to the app
        raise HTTPException(status_code=502, detail=f"Reading failed: {exc}") from exc

    row.reading_en = text
    session.add(row)
    session.commit()
    return ReadingOut(reading_en=text, cached=False)
