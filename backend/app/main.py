from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import auth, kundali, translate, webhooks

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


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "sarvam_configured": bool(settings.sarvam_api_key),
        "clerk_configured": bool(settings.clerk_jwt_key),
        "clerk_webhook_configured": bool(settings.clerk_webhook_secret),
    }
