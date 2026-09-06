# AstraVeda backend

FastAPI service for the AstraVeda mobile app.

- **Auth** — verifies Clerk session JWTs (networkless, `CLERK_JWT_KEY`) and upserts
  users into Neon (`POST /auth/sync`, `GET /auth/me`).
- **Clerk webhook** — `POST /webhooks/clerk` (Svix-signed) syncs `user.created/updated/deleted`.
- **Translation** — `POST /translate` / `/translate/batch` proxy Sarvam `sarvam-translate:v1`,
  cached in Neon.

## Run locally

```bash
uv sync
cp .env.example .env      # fill SARVAM_API_KEY, DATABASE_URL, CLERK_JWT_KEY, CLERK_WEBHOOK_SECRET
uv run uvicorn app.main:app --reload
```

Leave `DATABASE_URL` blank to use a local SQLite file.

## Deploy

Render blueprint: `render.yaml`. Set `SARVAM_API_KEY`, `DATABASE_URL`, `CLERK_JWT_KEY`,
`CLERK_ISSUER`, `CLERK_WEBHOOK_SECRET` as environment variables in the Render dashboard.

## Tests

```bash
uv run pytest
```
