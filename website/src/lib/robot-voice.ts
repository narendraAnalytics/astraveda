// Cloud narration for the welcome robot — web port of the mobile `robot-voice.ts` + `use-robot-voice.ts`.
// Same backend endpoint (POST /tts/speak → Sarvam Bulbul, base64 WAV), English only.
//
// AUDIO ISOLATION: the robot plays through its OWN `HTMLAudioElement` (one per line) and, as a
// fallback, `speechSynthesis`. It never touches the intro video's <video> element, so the intro's
// mute / sound toggle (which only flips `video.muted`) can never silence or trigger the robot.
import { api } from "./api";

// TEMPORARILY OFF: the Sarvam Bulbul cloud voice is disabled so we can test the browser's own
// voice (speechSynthesis) first. Every Sarvam call below is gated on this flag — set it back to
// `true` to re-enable the cloud voice (with the browser voice still as the failure fallback).
const USE_SARVAM = false;

type SpeakResponse = { audio_base64: string; format: string };

const TIMEOUT_MS = 10000;

// text → blob URL, in memory only (lines are short + repeat within a session).
const cache = new Map<string, Promise<string>>();

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("TTS request timed out")), ms));
}

function toBlobUrl(b64: string, format: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: `audio/${format || "wav"}` }));
}

function synthesize(text: string): Promise<string> {
  const hit = cache.get(text);
  if (hit) return hit;
  const p = Promise.race([
    api<SpeakResponse>("/tts/speak", { method: "POST", body: { text } }),
    timeout(TIMEOUT_MS),
  ]).then((r) => toBlobUrl(r.audio_base64, r.format));
  cache.set(text, p);
  p.catch(() => cache.delete(text)); // let a later attempt retry
  return p;
}

/** Start fetching a line early so playback has no gap. Never throws. */
export function prefetchRobotLine(text: string) {
  if (!USE_SARVAM) return;
  synthesize(text).catch(() => {});
}

export type SpeakCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
  /** Browser refused to play audio without a user gesture (autoplay policy). */
  onBlocked?: () => void;
};

const isBlocked = (e: unknown) => e instanceof DOMException && e.name === "NotAllowedError";

export function createRobotVoice() {
  let audio: HTMLAudioElement | null = null;
  let activeUtterance: SpeechSynthesisUtterance | null = null;

  const stop = () => {
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* unsupported */
    }
  };

  /** Returns a cancel function. */
  const speak = (text: string, cb: SpeakCallbacks) => {
    let cancelled = false;

    const fallback = () => {
      if (cancelled) return;
      try {
        const synth = window.speechSynthesis;
        if (!synth) return cb.onError?.();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-IN";
        u.rate = 0.95;
        u.onstart = () => !cancelled && cb.onStart?.();
        u.onend = () => !cancelled && cb.onDone?.();
        u.onerror = () => !cancelled && cb.onError?.();
        // Keep a reference (Chrome can GC a live utterance and never fire onend) and let a
        // preceding cancel() settle first (Chrome sometimes drops a speak() issued right after it).
        activeUtterance = u;
        setTimeout(() => {
          if (!cancelled) synth.speak(u);
        }, 80);
      } catch {
        cb.onError?.();
      }
    };

    if (!USE_SARVAM) {
      fallback(); // browser voice only — no Sarvam request is made
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const url = await synthesize(text);
        if (cancelled) return;
        const a = new Audio(url);
        audio = a;
        a.onended = () => !cancelled && cb.onDone?.();
        a.onerror = () => fallback();
        await a.play();
        if (!cancelled) cb.onStart?.();
      } catch (e) {
        if (cancelled) return;
        if (isBlocked(e)) cb.onBlocked?.();
        else fallback();
      }
    })();

    return () => {
      cancelled = true;
    };
  };

  return { speak, stop };
}
