# Chants & Mantras Library — Design

Status: approved by product owner (chat, 2026-09-11)
Author: Claude (session 0147bLh8BWNMYPQ1eGs7dYLA)

## Problem

The app's only devotional audio today is Virtual Puja's synthesized placeholder
ambience tracks (per `frontend/src/lib/virtual-puja.ts`) — audible but not real
chanting. The product owner wants **real chants** (Bhagavad Gita, "Govinda
Namalu"-style devotional recitations) added to the app as a standalone,
browsable feature — not just a background loop.

## Licensing constraint (the hard part)

This is a paying commercial product (`CLAUDE.md`), so every audio file must be
under a license that actually permits commercial use — not just "free to
stream on some site." Internet Archive's per-item "Usage" field is
**uploader-self-declared, not verified by Archive.org**, so it cannot be
trusted at face value. During research for this spec:

- One popular-looking item (`archive.org/details/hanuman-chalisa-full-audio-…`,
  a 2023 professionally produced track credited to named film composers
  Shankar Mahadevan / Ajay-Atul) was tagged "Public Domain Mark 1.0" by an
  unrelated individual uploader — almost certainly a mistaken/false tag for a
  still-in-copyright commercial release. **Rejected.**
- Another (`archive.org/details/bhagavad-gita-chanting`) turned out to state
  outright: *"Copyright Akshara Vidya Trust ... Should not be used for
  commercial purposes."* **Rejected** — this is exactly the kind of item a
  naive "has a Public Domain tag" filter would have missed if it only checked
  the summary tag and not the actual page text.
- Several others (`HinduSlokasAndMantras`, `GayatriMantra_201801`,
  `022BGAD18`) had **no license field stated at all** — default copyright, not
  usable.
- Pixabay Music's devotional catalog was evaluated as a more reliable
  alternative (platform-wide Content License, not self-declared) but requires
  downloading + self-hosting, not hotlinking — the product owner chose to
  stay with Archive.org for v1 rather than take on the hosting step now.

**One item cleared the bar with hard evidence, not just a search-result
label:** `archive.org/details/GitaHindi` — its machine-readable metadata
(`https://archive.org/metadata/GitaHindi`) has
`"licenseurl": "http://creativecommons.org/publicdomain/mark/1.0/"`, uploaded
by an individual (not a commercial rights holder or named artist), titled
*"Bhagvad Gita As It Is (Hindi Audio)"* — the well-known Prabhupada/ISKCON
Hindi edition, 18 chapter files (`hindi1.mp3` … `hindi18.mp3`) plus 2 intro
tracks. Direct-file URLs
(`https://archive.org/download/GitaHindi/hindi<N>.mp3`) resolve with a 302 to
a permanent Archive.org CDN node and are freely embeddable (`Access-Control-
Allow-Origin: *`).

**Rule going forward:** a chant is only added to `CHANTS` if its
`archive.org/metadata/<id>` JSON has an explicit `licenseurl` pointing to a
public-domain or CC0/CC-BY deed, AND the item page's own text contains no
contradicting "non-commercial only" restriction. Anything short of that is
excluded, no matter what a search result summary claims.

## Scope (v1)

One standalone screen, frontend-only, no backend/auth/payment — same tier as
Virtual Puja. Content: all 18 Bhagavad Gita chapters from the verified
`GitaHindi` item (Hindi audio). More traditions/chants added later, one at a
time, each individually re-verified the same way.

## Content model

`frontend/src/lib/chants.ts`:

```ts
export type Chant = {
  id: string;                 // 'gita-ch-1' .. 'gita-ch-18'
  title: string;              // 'Chapter 1 — Arjuna Vishada Yoga'
  collection: 'bhagavad-gita';// future traditions add new collection values
  language: string;           // 'Hindi'
  url: string;                // https://archive.org/download/GitaHindi/hindi1.mp3
  sourceUrl: string;          // https://archive.org/details/GitaHindi (attribution link)
  license: string;            // 'Public Domain Mark 1.0'
};

export const CHANTS: Chant[] = [ /* 18 entries */ ];
```

Standard traditional chapter names (public-domain names, not tied to any
specific copyrighted edition) are used for `title`.

## Screen

New root Stack screen `frontend/src/app/chants.tsx`. **Light, modern style —
explicitly not the dark night-sky treatment used for Horoscope/Astrologers.**
Cream `#fffaf2` background, warm gold/saffron accents (matching the home
screen and Kundali forms). A scrollable list of cards, one per chapter: title,
language tag, a play/pause button. A sticky "Now Playing" bar at the bottom
while something is playing (title + play/pause + a simple progress bar, no
scrubbing in v1). An attribution line ("Source: Internet Archive · Public
Domain") shown once, near the top of the screen.

## Player

`frontend/src/hooks/use-chant-player.ts` — wraps `expo-audio`'s
`createAudioPlayer(remoteUrl)`. Only one chant plays at a time: starting a new
one stops/removes the previous player. Listens to `playbackStatusUpdate` for
progress + `didJustFinish` (auto-stop, clear "now playing" state). No
background-audio/lock-screen integration in v1 (YAGNI — this isn't a
long-form podcast player).

## Error handling

If a track fails to load/stream (network issue, Archive.org hiccup), that
card shows an inline "Couldn't load — tap to retry" state. Nothing else on
the screen is affected; no crash, no fallback content (there's nothing to
substitute a chant with).

## Home entry point

A new banner card on the home screen (`src/app/(tabs)/index.tsx`), visually
at the same tier as the existing Virtual Puja banner, light/warm styled →
routes to `/chants`.

## Out of scope for v1

- Additional traditions/deities beyond Bhagavad Gita (add later, one
  verified item at a time).
- Background playback / lock-screen controls / scrubbing.
- Offline download/caching of chant audio.
- Any backend, auth, or payment — this is a free, frontend-only feature.
- Self-hosting on Cloudinary (revisit if Archive.org availability becomes a
  problem, or when a Pixabay-sourced set is added later).

## Testing

No backend to verify. Manual verification on the Android dev build:
navigate home → Chants banner → screen loads the 18-chapter list → play a
chapter → audio streams and plays → progress bar advances → switching to
another chapter stops the first → simulate airplane mode to confirm the
per-card retry state appears instead of a crash.
