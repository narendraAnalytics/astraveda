from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import _public_key
from app.config import get_settings
from app.db import init_db
from app.routers import auth, kundali, palm, translate, webhooks

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="AstraVeda API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translate.router)
app.include_router(auth.router)
app.include_router(webhooks.router)
app.include_router(kundali.router)
app.include_router(palm.router)


@app.get("/health")
def health() -> dict:
    # clerk_jwt_valid: does CLERK_JWT_KEY actually parse as a public key?
    # (bool(clerk_jwt_key) only tells you it's non-empty — a truncated paste
    # still shows configured but fails every token verification.)
    try:
        _public_key.cache_clear()
        clerk_jwt_valid = bool(_public_key())
        clerk_jwt_error = None
    except Exception as exc:  # noqa: BLE001
        clerk_jwt_valid = False
        clerk_jwt_error = getattr(exc, "detail", str(exc))

    return {
        "status": "ok",
        "sarvam_configured": bool(settings.sarvam_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
        "clerk_configured": bool(settings.clerk_jwt_key),
        "clerk_jwt_valid": clerk_jwt_valid,
        "clerk_jwt_error": clerk_jwt_error,
        "clerk_webhook_configured": bool(settings.clerk_webhook_secret),
    }
