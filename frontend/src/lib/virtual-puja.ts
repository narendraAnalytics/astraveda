// Virtual Puja — placeholder temple + sound config.
//
// v1 ships with gradient/Om shrine placeholders. Swap `image` on a temple once
// real deity art exists.
//
// AUDIO: the files in `frontend/assets/audio/` are SYNTHESIZED placeholder tones
// (a real bell strike, drone, etc. — audible, but obviously not a recording).
// To ship production sound, replace them with real royalty-free clips. Keep the
// filenames; if you switch format to .mp3, update the extensions in the two
// require() maps below. Good license-free sources: pixabay.com/sound-effects,
// mixkit.co, or Freesound (CC0 filter).
//
//   bell.wav    temple bell / ghanti      loop     3–6 s, seamless
//   aarti.wav   aarti bells + thali       loop     10–20 s
//   conch.wav   single shankh blow        one-shot 2–4 s
//   chime.wav   soft offering "ding"      one-shot 1–2 s
//   mantra.wav  low Om / chant drone      loop     20–40 s (optional)
//
// AMBIENCE: `frontend/assets/audio/ambient/{shiva,vishnu,ganesha,devi,krishna}.wav`
// is the devotional background track per temple. Placeholders are a synthesized
// rhythmic chant-loop (tanpura drone + gong + a syllabic melody line — no real
// words). For production, drop in a licensed recording of the actual chant
// (e.g. "Hara Hara Mahadeva" for Shiva), same filename. These play under the
// effects and duck while aarti runs.
//   ⚠ This is a paid product: the real tracks MUST be royalty-free / CC0 /
//   commercially licensed. Traditional bhajans are public-domain compositions
//   but specific *recordings* are copyrighted. Safe: instrumental temple
//   ambience or CC0 chant loops (Pixabay / Freesound CC0).

export type PujaTradition = 'shiva' | 'vishnu' | 'ganesha' | 'devi' | 'krishna';

export type VirtualTemple = {
  id: string;
  name: string;
  deity: string;
  place: string;
  mantra: string;
  /** Which devotional ambience track plays for this shrine. */
  tradition: PujaTradition;
  /** 3-stop background gradient for the shrine stage. */
  colors: readonly [string, string, string];
  /** Optional deity artwork (remote URL). Falls back to the Om placeholder. */
  image?: string;
};

export const VIRTUAL_TEMPLES: VirtualTemple[] = [
  {
    id: 'somnath',
    name: 'Somnath Jyotirlinga',
    deity: 'Lord Shiva',
    place: 'Prabhas Patan, Gujarat',
    mantra: 'ॐ नमः शिवाय',
    tradition: 'shiva',
    colors: ['#20263f', '#3a3c66', '#7d5aa6'],
  },
  {
    id: 'tirupati',
    name: 'Tirumala Venkateswara',
    deity: 'Lord Venkateswara',
    place: 'Tirupati, Andhra Pradesh',
    mantra: 'ॐ नमो वेङ्कटेशाय',
    tradition: 'vishnu',
    colors: ['#3a1414', '#7a1f2b', '#d1892f'],
  },
  {
    id: 'siddhivinayak',
    name: 'Shree Siddhivinayak',
    deity: 'Lord Ganesha',
    place: 'Prabhadevi, Mumbai',
    mantra: 'ॐ गं गणपतये नमः',
    tradition: 'ganesha',
    colors: ['#4a1d0e', '#a8451c', '#f0a94a'],
  },
  {
    id: 'vaishnodevi',
    name: 'Vaishno Devi',
    deity: 'Maa Vaishnavi',
    place: 'Trikuta Hills, Katra',
    mantra: 'ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे',
    tradition: 'devi',
    colors: ['#4a0f2a', '#911a4b', '#e0658f'],
  },
  {
    id: 'dwarka',
    name: 'Dwarkadhish',
    deity: 'Lord Krishna',
    place: 'Dwarka, Gujarat',
    mantra: 'ॐ नमो भगवते वासुदेवाय',
    tradition: 'krishna',
    colors: ['#0f2740', '#1f5a86', '#5ea8c9'],
  },
];

export const DEFAULT_TEMPLE_ID = VIRTUAL_TEMPLES[0].id;

export function getTemple(id: string | null | undefined): VirtualTemple {
  return VIRTUAL_TEMPLES.find((t) => t.id === id) ?? VIRTUAL_TEMPLES[0];
}

export type PujaSoundKey = 'bell' | 'aarti' | 'conch' | 'chime' | 'mantra';

/**
 * Bundled puja clips. `bell`, `aarti`, `mantra` are looped by the audio hook;
 * `conch` and `chime` are one-shots. Currently silent placeholders — overwrite
 * the files in `assets/audio/` to make them real.
 */
export const PUJA_SOUNDS: Record<PujaSoundKey, number> = {
  bell: require('../../assets/audio/bell.wav'),
  aarti: require('../../assets/audio/aarti.wav'),
  conch: require('../../assets/audio/conch.wav'),
  chime: require('../../assets/audio/chime.wav'),
  mantra: require('../../assets/audio/mantra.wav'),
};

/**
 * Devotional background track per deity tradition. Looped low under the effects
 * by the audio hook. Silent placeholders — overwrite in `assets/audio/ambient/`.
 */
export const PUJA_AMBIENCE: Record<PujaTradition, number> = {
  shiva: require('../../assets/audio/ambient/shiva.wav'),
  vishnu: require('../../assets/audio/ambient/vishnu.wav'),
  ganesha: require('../../assets/audio/ambient/ganesha.wav'),
  devi: require('../../assets/audio/ambient/devi.wav'),
  krishna: require('../../assets/audio/ambient/krishna.wav'),
};

export const VIRTUAL_TEMPLE_STORAGE_KEY = 'astraveda.virtualTemple';
export const PUJA_BHAJAN_STORAGE_KEY = 'astraveda.pujaBhajan';

export const AMBIENCE_VOLUME = 0.7;
export const AMBIENCE_DUCKED_VOLUME = 0.32;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
