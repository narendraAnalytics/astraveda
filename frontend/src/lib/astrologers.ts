// AstraVeda's astrologers — shown on the "Our Astrologers" screen behind the
// flower tab. Showcase only for now (no booking action). Add more people by
// appending to ASTROLOGERS; photos are hosted on Cloudinary (imagesurl.txt).
//
// NOTE: the bios / specialties / languages / experience below are first-pass
// placeholders — flagged for the product owner to replace with each
// astrologer's real details before launch.

export type Astrologer = {
  id: string;
  name: string;
  photo: string;
  title: string;
  location: string;
  experienceYears: number;
  languages: string[];
  specialties: string[];
  /** 2-3 sentence introduction, first person. */
  about: string;
  /** Bullet points for "What a reading covers". */
  covers: string[];
  /** Accent colour for this astrologer's card / detail hero. */
  accent: string;
};

export const ASTROLOGERS: Astrologer[] = [
  {
    id: 'meenakshi-sundaram',
    name: 'Meenakshi Sundaram',
    photo:
      'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788970362/meenkshisundaran_uv7nzk.png',
    title: 'Vedic Astrologer & Nadi Reader',
    location: 'Madurai, Tamil Nadu',
    experienceYears: 18,
    languages: ['Tamil', 'English'],
    specialties: ['Marriage', 'Career', 'Remedies', 'Nadi'],
    about:
      'I read charts in the Nadi and Parashari traditions I learned from my father and grandfather in Madurai. My focus is on practical guidance — timing, temple remedies, and the small changes that shift a difficult period.',
    covers: [
      'Marriage timing and compatibility (guna milan)',
      'Career direction and job-change windows',
      'Running dasha and what it asks of you',
      'Simple parihara / temple remedies',
    ],
    accent: '#e0a83c',
  },
  {
    id: 'rohan-sharma',
    name: 'Rohan Sharma',
    photo:
      'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788970528/rohansharma_iy2k0w.png',
    title: 'KP & Vedic Astrologer',
    location: 'Jaipur, Rajasthan',
    experienceYears: 12,
    languages: ['Hindi', 'English'],
    specialties: ['Finance', 'Business', 'Muhurta', 'KP System'],
    about:
      'I work primarily with the KP (Krishnamurti Paddhati) system for precise, yes-or-no answers, backed by classical Vedic analysis. Business owners and investors come to me for muhurta and money-flow questions.',
    covers: [
      'Money flow, investments and debt periods',
      'Business decisions and partnership timing',
      'Auspicious muhurta for launches and purchases',
      'Yearly outlook (varshphal)',
    ],
    accent: '#a78bff',
  },
];

export function astrologerById(id: string | undefined | null): Astrologer | null {
  if (!id) return null;
  return ASTROLOGERS.find((a) => a.id === id) ?? null;
}
