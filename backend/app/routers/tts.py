from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import tts

router = APIRouter(prefix="/tts", tags=["tts"])


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=2500)


class SpeakOut(BaseModel):
    audio_base64: str
    format: str = "wav"


@router.post("/speak", response_model=SpeakOut)
async def speak(body: SpeakIn) -> SpeakOut:
    try:
        audio_base64 = await tts.synthesize(body.text)
    except tts.TtsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SpeakOut(audio_base64=audio_base64)
