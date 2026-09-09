from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    sarvam_api_key: str = ""
    # Blank -> local SQLite file (dev on a machine without Postgres).
    database_url: str = ""
    allowed_origins: str = "*"

    # Clerk. JWT verification is networkless — paste the PEM public key from the
    # Clerk dashboard (API Keys -> Show JWT public key / "PEM public key").
    clerk_jwt_key: str = ""
    clerk_issuer: str = "https://nearby-buck-5233.clerk.accounts.dev"
    # Svix signing secret for the /webhooks/clerk endpoint (Clerk dashboard -> Webhooks).
    clerk_webhook_secret: str = ""

    sarvam_base_url: str = "https://api.sarvam.ai"
    sarvam_translate_model: str = "sarvam-translate:v1"
    # Sarvam hard limit is 2000 chars/request; stay under it.
    sarvam_max_chars: int = 1800
    # Chat model used to turn a computed chart into a plain-language reading.
    sarvam_chat_model: str = "sarvam-105b"
    # sarvam-105b reasons by default and can burn the whole token budget thinking
    # (-> content=null). "" / "none" disables it (cheapest, fine for this task);
    # or set "low" / "medium" / "high".
    sarvam_reasoning_effort: str = ""

    # Open-Meteo geocoding — free, no key. Resolves a city to lat/lon/timezone.
    geocoding_url: str = "https://geocoding-api.open-meteo.com/v1/search"

    # Gemini (Google AI Studio) — used only for palm/face IMAGE analysis. The
    # narrative reading still comes from Sarvam. Free-tier key is fine.
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    # gemini-2.5-flash is deprecated (retires 2026-10-16). gemini-3.6-flash is
    # the current stable multimodal Flash model with a free tier.
    gemini_vision_model: str = "gemini-3.6-flash"

    # Razorpay — payments. Test-mode keys locally; live keys in the same vars on
    # Render. Webhook secret is generated in the Razorpay dashboard when you add
    # the endpoint (https://<render-url>/webhooks/razorpay, event order.paid).
    # Money is server-authoritative: the client never sends an amount and never
    # asserts payment success (finalview.txt §10).
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    # Price of one Kundali, in paise. ₹15 = 1500. Server-set, never from client.
    kundali_price_paise: int = 1500
    # Price of one Face Reading, in paise. ₹45 = 4500. Server-set, never from client.
    face_price_paise: int = 4500
    # Price of one Palm Reading, in paise. ₹40 = 4000. Server-set, never from client.
    palm_price_paise: int = 4000
    # Price of one Aura Scan, in paise. ₹60 = 6000. Server-set, never from client.
    aura_price_paise: int = 6000
    # Price of one Dream Interpretation, in paise. ₹30 = 3000. Server-set, never from client.
    dream_price_paise: int = 3000
    # Price of one Vastu analysis, in paise. ₹150 = 15000. Server-set, never from client.
    vastu_price_paise: int = 15000
    # Minimum wallet top-up, in paise. ₹100 = 10000.
    wallet_min_topup_paise: int = 10000
    wallet_max_topup_paise: int = 5000000  # ₹50,000

    # ---- Sarvam Voice Agents (Samvaad) — "Ask AstraVeda" voice consultation ----
    # A SEPARATE key from sarvam_api_key: the voice API uses the sk_samvaad_ key,
    # the X-API-Key header, and the apps.sarvam.ai host (not api.sarvam.ai).
    sarvam_voice_api_key: str = ""
    sarvam_voice_base_url: str = "https://apps.sarvam.ai"
    sarvam_voice_org_id: str = ""
    sarvam_voice_workspace_id: str = ""
    sarvam_voice_app_id: str = ""
    # INTEGER of a COMMITTED agent version (never a Draft) — see sarvamvoice.txt §4.
    sarvam_voice_app_version: int = 1
    sarvam_voice_connection_id: str = ""
    sarvam_voice_agent_phone_number: str = ""  # E.164 outbound caller id
    # Shared secret echoed back on the end-of-call webhook (webhook_config.metadata).
    sarvam_voice_webhook_secret: str = ""
    # Guards POST /consult/tick, which the Render cron job hits to place due calls.
    consult_tick_secret: str = ""
    # Public https base of THIS backend — Sarvam posts the end-of-call webhook here.
    public_base_url: str = "https://astraveda-8sqc.onrender.com"
    # Price of one voice consultation, in paise. ₹99 = 9900. Server-set, never client.
    consult_price_paise: int = 9900

    @property
    def sqlalchemy_url(self) -> str:
        if not self.database_url:
            return "sqlite:///./astraveda_dev.db"
        # SQLModel/SQLAlchemy wants the psycopg v3 driver spelled out.
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
