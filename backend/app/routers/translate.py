import hashlib

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db import get_session
from app.models import Translation
from app.services import sarvam

router = APIRouter(prefix="/translate", tags=["translate"])


class TranslateIn(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    target_lang: str
    source_lang: str = "en"


class TranslateOut(BaseModel):
    translated_text: str
    cached: bool
    target_lang: str


class BatchIn(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=100)
    target_lang: str
    source_lang: str = "en"


def _hash(text: str, source_lang: str) -> str:
    return hashlib.sha256(f"{source_lang}:{text}".encode()).hexdigest()


async def _translate_one(text: str, target_lang: str, source_lang: str, db: Session) -> tuple[str, bool]:
    if target_lang == source_lang:
        return text, True

    source_hash = _hash(text, source_lang)
    row = db.exec(
        select(Translation).where(
            Translation.source_hash == source_hash, Translation.target_lang == target_lang
        )
    ).first()
    if row:
        return row.translated_text, True

    try:
        translated = await sarvam.translate(text, target_lang, source_lang)
    except sarvam.SarvamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    db.add(
        Translation(
            source_hash=source_hash,
            source_lang=source_lang,
            target_lang=target_lang,
            source_text=text,
            translated_text=translated,
        )
    )
    db.commit()
    return translated, False


@router.post("", response_model=TranslateOut)
async def translate_text(body: TranslateIn, db: Session = Depends(get_session)) -> TranslateOut:
    if body.target_lang not in sarvam.SUPPORTED:
        raise HTTPException(status_code=422, detail=f"Unsupported target language: {body.target_lang}")
    translated, cached = await _translate_one(body.text, body.target_lang, body.source_lang, db)
    return TranslateOut(translated_text=translated, cached=cached, target_lang=body.target_lang)


@router.post("/batch")
async def translate_batch(body: BatchIn, db: Session = Depends(get_session)) -> dict:
    if body.target_lang not in sarvam.SUPPORTED:
        raise HTTPException(status_code=422, detail=f"Unsupported target language: {body.target_lang}")
    items = []
    for text in body.texts:
        translated, cached = await _translate_one(text, body.target_lang, body.source_lang, db)
        items.append({"source_text": text, "translated_text": translated, "cached": cached})
    return {"target_lang": body.target_lang, "items": items}
