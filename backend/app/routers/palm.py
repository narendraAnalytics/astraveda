"""Palm Reading (Hasta Samudrika Shastra) — guided questionnaire + AI reading.

Two-phase, mirroring the Kundali router: `POST /palm/generate` persists the
answers and returns immediately; the app renders the result and then calls
`POST /palm/{id}/reading` for the (slower) Sarvam narrative. Everything is
persisted so re-opening is instant. No photo computer vision in v1 — the
optional palm photo stays on the user's device.
"""

from __future__ import annotations

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
from app.services import palm_reading

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
    has_reading: bool
    created_at: datetime

    @classmethod
    def of(cls, r: PalmReading) -> "PalmSummary":
        heart = (r.lines or {}).get("heart")
        bits = [f"{r.hand_shape} hand"]
        if heart and heart != "Not sure":
            bits.append(f"{heart.lower()} heart line")
        return cls(
            id=str(r.id),
            name=r.name,
            relation=r.relation,
            dominant_hand=r.dominant_hand,
            hand_shape=r.hand_shape,
            headline_trait=" · ".join(bits),
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
    return {k: str(v)[:60] for k, v in raw.items() if k in LINE_KEYS and v}


def _signature(payload: GenerateIn, lines: dict[str, str], mounts: list[str]) -> str:
    blob = json.dumps(
        {
            "hand": payload.dominant_hand,
            "shape": payload.hand_shape,
            "fingers": payload.finger_length,
            "thumb": payload.thumb_flex,
            "lines": lines,
            "mounts": sorted(mounts),
        },
        sort_keys=True,
    )
    return hashlib.sha1(blob.encode()).hexdigest()


def _build_profile(payload: GenerateIn, lines: dict[str, str], mounts: list[str], marks: list[str]) -> dict:
    return {
        "name": payload.name.strip(),
        "dominant_hand": payload.dominant_hand,
        "hand_shape": payload.hand_shape,
        "hand_shape_trait": _HAND_SHAPE_TRAIT.get(payload.hand_shape, ""),
        "finger_length": payload.finger_length,
        "thumb_flex": payload.thumb_flex,
        "lines": lines,
        "mounts": mounts,
        "marks": marks,
        "signature": _signature(payload, lines, mounts),
    }


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

    finger_length = body.finger_length if body.finger_length in FINGER_LENGTHS else None
    thumb_flex = body.thumb_flex if body.thumb_flex in THUMB_FLEX else None
    lines = _clean_lines(body.lines)
    mounts = [m for m in body.mounts if m in MOUNTS][:2]
    marks = [str(m)[:40] for m in body.marks if m][:8]
    relation = body.relation if body.relation in RELATIONS else None
    name = body.name.strip()

    payload = GenerateIn(
        name=name,
        relation=relation,
        dominant_hand=body.dominant_hand,
        hand_shape=body.hand_shape,
        finger_length=finger_length,
        thumb_flex=thumb_flex,
        lines=lines,
        mounts=mounts,
        marks=marks,
    )
    profile = _build_profile(payload, lines, mounts, marks)

    # De-dupe: regenerating the same person + same answers updates their row
    # instead of piling up copies.
    existing = session.exec(
        select(PalmReading).where(PalmReading.user_id == user.id)
    ).all()
    row = next(
        (
            r
            for r in existing
            if r.name.strip().lower() == name.lower()
            and (r.relation or None) == relation
            and (r.profile or {}).get("signature") == profile["signature"]
        ),
        None,
    )

    if row is None:
        row = PalmReading(user_id=user.id)
        session.add(row)
    else:
        # Answers changed enough to matter? signature already matched, so keep
        # any existing reading; otherwise it is a fresh row above.
        pass

    row.name = name
    row.relation = relation or row.relation
    row.dominant_hand = body.dominant_hand
    row.hand_shape = body.hand_shape
    row.finger_length = finger_length
    row.thumb_flex = thumb_flex
    row.lines = lines
    row.mounts = mounts
    row.marks = marks
    row.profile = profile

    session.commit()
    session.refresh(row)
    return PalmOut.of(row)


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
