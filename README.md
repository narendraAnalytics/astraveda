# AstraVeda

AI-powered Vedic astrology & spiritual platform — Kundli, AI chat, palmistry, face reading,
Vastu, live consultations, and puja / temple e-commerce.

## Repo layout

```
astroveda/
├── website/     Marketing landing page — static HTML/CSS/JS, mobile-first
└── frontend/    Expo / React Native mobile app (Expo SDK 57, Expo Router, TypeScript)
```

## Landing page (`website/`)

Static site, no build step.

```bash
npx serve -l 5500 website
```

Then open http://localhost:5500.

### Deployment

Deployed on **Vercel** as a static site with the **root directory** set to `website/`
(no build command, output directory `.`). Coolify is planned for later self-hosting.

## Mobile app (`frontend/`)

```bash
cd frontend
npm install
npx expo start
```

## License

See [`frontend/LICENSE`](frontend/LICENSE).
