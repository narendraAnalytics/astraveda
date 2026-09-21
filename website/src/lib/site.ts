export const LOGO_URL =
  "https://res.cloudinary.com/dkqbzwicr/image/upload/v1789538457/logo_uvmwxb.png";
export const VIDEO_URL =
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1789539143/astrovedawebvideo_q5y6iu.webm";

// Full-screen welcome video shown once per browser session (IntroOverlay).
export const INTRO_VIDEO =
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1789988964/introvideo_yrsezz.webm";

export const HERO_VIDEOS = [
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1789566448/Create_an_second_cinematic_v_oixgya.webm",
  VIDEO_URL,
];

export const TOOL_IMAGES = {
  kundli:
    "https://res.cloudinary.com/dkqbzwicr/image/upload/v1788625500/kundali_ia4oaj.png",
  palm: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1788625851/palmreading_q10d1o.png",
  face: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1788626138/facereading_ry0e2s.png",
  aura: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1788627733/aurasign_ctimto.png",
  dream:
    "https://res.cloudinary.com/dkqbzwicr/image/upload/v1788628611/dreamintrupter_tmbxvi.png",
  ask: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1789564330/askastrevada_lyryed.png",
  puja: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1789564527/pujasandtemples_ytgvpk.png",
  vastu: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1788627479/houseai_fus43o.png",
} as const;

// "Explore AstraVeda" 3D ring — order matches `d.hero.features` (title/sub per slot).
// Live tools link to their web page; Past Life / Matchmaking have no page yet.
const showcaseImg = (path: string) =>
  `https://res.cloudinary.com/dkqbzwicr/image/upload/w_640,f_auto,q_auto/${path}`;

export const SHOWCASE: ReadonlyArray<{ img: string; href?: string }> = [
  { img: showcaseImg("v1789975051/Kundli_Charts_Astrology_yt6koi.png"), href: "/kundali" },
  { img: showcaseImg("v1789975054/Mystical_Palmistry_AI_hcxdno.png"), href: "/palm" },
  { img: showcaseImg("v1789975055/Face_Reading_AI_Card_oljhml.png"), href: "/face" },
  { img: showcaseImg("v1789975054/Vastu_AI_uyuxcy.png"), href: "/vastu" },
  { img: showcaseImg("v1789975052/pastliveai_q6toan.png") },
  { img: showcaseImg("v1789975054/soloconnections_unx83v.png") },
  { img: showcaseImg("v1789975051/pujasandtemples_lxz6hx.png"), href: "/puja" },
];

export const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Toolkit", href: "#toolkit" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Ask AstraVeda", href: "#ask-astraveda" },
];
