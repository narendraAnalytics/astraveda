// Bright pastel art per temple (the catalog has no photos yet — `image_url` is
// empty). Each tradition gets its own soft two-stop wash, a deep text/accent
// colour and a glyph. Keyed by slug, with a warm-saffron fallback.
export type Tradition = "Shiva" | "Vishnu" | "Ganesha" | "Devi";

export type TempleTheme = {
  tradition: Tradition;
  glyph: string;
  from: string; // pastel wash start
  to: string; // pastel wash end
  accent: string; // deep accent for text, chips, buttons
  accent2: string;
};

const THEMES: Record<string, TempleTheme> = {
  "kashi-vishwanath": { tradition: "Shiva", glyph: "🔱", from: "#E6F0FF", to: "#F3E8FF", accent: "#4F5BD5", accent2: "#8B5CF6" },
  somnath: { tradition: "Shiva", glyph: "🌊", from: "#E2F6FB", to: "#E6F0FF", accent: "#0E8AA8", accent2: "#4F7CE8" },
  mahakaleshwar: { tradition: "Shiva", glyph: "🕉️", from: "#F1E8FF", to: "#FFE8F1", accent: "#7C3AED", accent2: "#C026D3" },
  "tirumala-tirupati": { tradition: "Vishnu", glyph: "🐚", from: "#FFF3D6", to: "#FFE3C2", accent: "#C77A0A", accent2: "#E8A02F" },
  siddhivinayak: { tradition: "Ganesha", glyph: "🐘", from: "#FFE6D4", to: "#FFD9DC", accent: "#D4541F", accent2: "#F0793E" },
  "vaishno-devi": { tradition: "Devi", glyph: "🪷", from: "#FFE1EA", to: "#FFEAD6", accent: "#C0356F", accent2: "#E2745A" },
};

const FALLBACK: TempleTheme = {
  tradition: "Shiva",
  glyph: "🪔",
  from: "#FFF0D6",
  to: "#FFE0CC",
  accent: "#C2571F",
  accent2: "#E0932F",
};

export const themeFor = (slug: string): TempleTheme => THEMES[slug] ?? FALLBACK;

export const TRADITIONS: Tradition[] = ["Shiva", "Vishnu", "Ganesha", "Devi"];

// The site-wide accent for this section: warm marigold-saffron.
export const SAFFRON_GRADIENT = "linear-gradient(135deg,#E0932F,#F0793E,#E2574F)";
export const MAROON = "#7a1f2b";
