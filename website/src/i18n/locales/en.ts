// English — the source dictionary. Every other language file must satisfy `Dict`
// (same shape), so a missing key is a compile error, never a blank on the page.
//
// Non-English files are first-pass translations, FLAGGED FOR NATIVE-SPEAKER REVIEW
// (same status as the mobile app's locale files). Tool names reuse the mobile
// app's wording so the site and the app say the same thing.

export const en = {
  nav: {
    links: ["Home", "Toolkit", "How It Works", "Ask AstraVeda"],
    signIn: "Sign In",
    welcome: "Welcome, {name}",
    wallet: "Wallet",
  },
  lang: {
    label: "Language",
    title: "Choose your language",
    subtitle: "The whole site updates instantly",
    lockedHint: "Sign in to explore this language",
    unlockTitle: "Unlock all 7 languages",
    unlockBody: "Sign in to read AstraVeda in Hindi, Tamil, Telugu, Marathi and Kannada.",
    unlockCta: "Sign in",
  },
  hero: {
    badge: "Step into a Brighter 2026",
    titleA: "Your Journey,",
    titleB: "Written in the",
    titleStars: "Stars",
    titleC: "",
    tagline: "AI-Powered Astrology. Ancient Wisdom. A Better You.",
    body: "Discover your future, understand your karmas, and unlock life's opportunities with personalized AI-driven astrological insights and spiritual guidance.",
    cta: "Explore Your Horoscope",
    watch: "Watch Video",
    closeVideo: "Close video",
    statCharts: "Divisional Charts",
    statLanguages: "Languages",
    statConsult: "Live Consultation",
    features: [
      { title: "Kundli & Charts", sub: "16 Divisional Views" },
      { title: "Palmistry", sub: "AI Hand Analysis" },
      { title: "Face Reading", sub: "Personality Insights" },
      { title: "Vastu AI", sub: "Home Harmony" },
      { title: "Past Life", sub: "Karmic Decode" },
      { title: "Matchmaking", sub: "Soul Connections" },
      { title: "Puja & Temples", sub: "Live & Personalized" },
    ],
  },
  toolkit: {
    pill: "Your Complete Toolkit",
    titleA: "Every reading, one app,",
    titleAccent: "powered by real AI",
    body: "No third-party astrology API — every chart is computed on our own Swiss Ephemeris engine, then written into a natural-language reading by AI.",
    tools: [
      { title: "My Kundli", desc: "Self-hosted Vimshottari Dasha birth chart with 16 divisional views, computed with Swiss Ephemeris." },
      { title: "Palm Reading", desc: "Hasta Samudrika insights from a live camera scan or a guided 4-step questionnaire." },
      { title: "Face Reading", desc: "Mukha Samudrika personality insights from a selfie, read by AI vision." },
      { title: "Aura Scan", desc: "A selfie and a short energy quiz reveal your aura's colour palette and a 7-chakra reading." },
      { title: "Dream Interpreter", desc: "Describe a dream in your own words and get a structured Vedic interpretation." },
      { title: "Vastu AI", desc: "A room photo plus your 8-direction input returns a score, element balance, and non-demolition remedies." },
      { title: "Ask AstraVeda", desc: "A real outbound AI voice call — book now or schedule a slot for a live spoken reading." },
      { title: "Puja & Temples", desc: "Book real temples and puja types with live capacity tracking and a QR e-pass." },
    ],
    puja: "Virtual Puja — Free",
    pujaTag: "Try",
    horoscope: "Daily Horoscope — Free",
    horoscopeTag: "Read",
  },
  how: {
    pill: "How It Works",
    titleA: "From your details to a reading,",
    titleAccent: "in seconds",
    step: "STEP",
    steps: [
      { title: "Share your details", desc: "Enter your birth details, snap a selfie, or describe a dream — whatever the reading needs." },
      { title: "AI reads the signal", desc: "Gemini Vision extracts features from photos; our own Swiss Ephemeris engine computes your chart." },
      { title: "Sarvam writes it up", desc: "The computed facts become a natural, human-sounding reading — never a generic template." },
      { title: "Read it your way", desc: "Get your reading in one of 7 languages, or ask a follow-up on a live AI voice call." },
    ],
  },
  voice: {
    pill: "Ask AstraVeda",
    titleA: "A real phone call with your",
    titleB: "AI astrologer",
    body: "No chat window, no waiting room — AstraVeda places an actual outbound voice call, confirms your birth details, and delivers your reading live on the same call. Call now or schedule an IST time slot.",
    callNow: "Call Me Now",
    schedule: "Schedule a Time",
  },
  trust: {
    title: "Built to be trusted, not just tried",
    body: "Every payment, wallet balance, and order is verified server-side — never trusted from the client.",
    stats: [
      { label: "Third-party astrology APIs", sub: "Every chart is computed in-house — nothing outsourced" },
      { label: "Divisional charts", sub: "Full Vimshottari Dasha, computed on our own Swiss Ephemeris engine" },
      { label: "Languages", sub: "English, Hindi, Odia, Tamil, Telugu, Marathi & Kannada" },
      { label: "Real temples", sub: "13 puja types with live daily capacity tracking" },
    ],
  },
  download: {
    title: "Your stars are one tap away",
    body: "Download AstraVeda and get your first Kundli reading, daily horoscope, and cosmic guidance — free to start.",
  },
  footer: {
    desc: "AI-powered Vedic astrology, palmistry, face reading, Vastu and temple e-commerce — built on our own self-hosted astrology engine, no third-party APIs.",
    navigate: "NAVIGATE",
    availableIn: "AVAILABLE IN",
    rights: "All rights reserved.",
    tagline: "Cosmic intelligence for a better you.",
  },
};

export type Dict = typeof en;
