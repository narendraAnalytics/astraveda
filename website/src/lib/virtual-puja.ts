// Virtual Puja — temple data + shared layout constants for the web shrine.
//
// Temples and deity art mirror the mobile app's `virtual-puja.ts` (same
// Cloudinary uploads). Free, public, no backend: everything here is client-side.

export type PujaTradition = "shiva" | "vishnu" | "ganesha" | "devi" | "krishna";

export type VirtualTemple = {
  id: string;
  name: string;
  deity: string;
  place: string;
  mantra: string;
  tradition: PujaTradition;
  /** 3-stop scene gradient (dark → light). */
  colors: readonly [string, string, string];
  /** Glow colour (r,g,b) used for the halo behind the deity. */
  glow: string;
  image: string;
};

const CDN = "https://res.cloudinary.com/dkqbzwicr/image/upload";

/** Re-size a Cloudinary deity URL (`w_820,f_auto,q_auto` is the mobile default). */
export function deityImage(temple: VirtualTemple, width = 900): string {
  return temple.image.replace("w_820", `w_${width}`);
}

export const VIRTUAL_TEMPLES: VirtualTemple[] = [
  {
    id: "somnath",
    name: "Somnath Jyotirlinga",
    deity: "Lord Shiva",
    place: "Prabhas Patan, Gujarat",
    mantra: "ॐ नमः शिवाय",
    tradition: "shiva",
    colors: ["#141a33", "#2c2f5c", "#7d5aa6"],
    glow: "150,120,255",
    image: `${CDN}/w_820,f_auto,q_auto/v1788882821/lordsiva_aezrgu.png`,
  },
  {
    id: "tirupati",
    name: "Tirumala Venkateswara",
    deity: "Lord Venkateswara",
    place: "Tirupati, Andhra Pradesh",
    mantra: "ॐ नमो वेङ्कटेशाय",
    tradition: "vishnu",
    colors: ["#2a0d0d", "#6a1a24", "#d1892f"],
    glow: "255,170,70",
    image: `${CDN}/w_820,f_auto,q_auto/v1788886391/lordvenkatwara_g1589s.png`,
  },
  {
    id: "siddhivinayak",
    name: "Shree Siddhivinayak",
    deity: "Lord Ganesha",
    place: "Prabhadevi, Mumbai",
    mantra: "ॐ गं गणपतये नमः",
    tradition: "ganesha",
    colors: ["#331508", "#93391a", "#f0a94a"],
    glow: "255,140,50",
    image: `${CDN}/w_820,f_auto,q_auto/v1788886643/lordganesh_ivfamn.png`,
  },
  {
    id: "vaishnodevi",
    name: "Vaishno Devi",
    deity: "Maa Vaishnavi",
    place: "Trikuta Hills, Katra",
    mantra: "ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे",
    tradition: "devi",
    colors: ["#33091d", "#7f1642", "#e0658f"],
    glow: "255,110,160",
    image: `${CDN}/w_820,f_auto,q_auto/v1788886931/mahavaishanvi_xmn7ud.png`,
  },
  {
    id: "dwarka",
    name: "Dwarkadhish",
    deity: "Lord Krishna",
    place: "Dwarka, Gujarat",
    mantra: "ॐ नमो भगवते वासुदेवाय",
    tradition: "krishna",
    colors: ["#0a1c30", "#194e78", "#5ea8c9"],
    glow: "110,190,255",
    image: `${CDN}/w_820,f_auto,q_auto/v1788887108/lordkrishna_emrnkq.png`,
  },
];

export const DEFAULT_TEMPLE_ID = VIRTUAL_TEMPLES[0].id;

export function getTemple(id: string | null | undefined): VirtualTemple {
  return VIRTUAL_TEMPLES.find((t) => t.id === id) ?? VIRTUAL_TEMPLES[0];
}

/** Tonic (Sa) per tradition for the tanpura drone, in Hz. */
export const SA_HZ: Record<PujaTradition, number> = {
  shiva: 130.81,
  vishnu: 146.83,
  ganesha: 138.59,
  devi: 155.56,
  krishna: 164.81,
};

// ── Scene layout ────────────────────────────────────────────────────────────
// The scene is laid out on a unit `u = min(42vw, 40vh)` so the DOM (CSS) and the
// WebGL layer (JS) can place things identically without measuring each other.
// `k` = horizontal offset in units of u from the stage centre; `y` = vertical
// position as a fraction of stage height (the flame's base / wick).

export const LAMPS = [
  { k: -0.98, y: 0.745, s: 0.85 },
  { k: -0.62, y: 0.725, s: 1 },
  { k: 0.62, y: 0.725, s: 1 },
  { k: 0.98, y: 0.745, s: 0.85 },
] as const;

// Kept well above the bottom action bar so nothing is hidden behind it.
export const INCENSE = { k: -0.26, y: 0.715 } as const;

export const sceneUnit = (w: number, h: number) => Math.min(w * 0.42, h * 0.4);

export const STORAGE = {
  temple: "astraveda.web.virtualTemple",
  muted: "astraveda.web.pujaMuted",
  ambient: "astraveda.web.pujaAmbient",
} as const;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
