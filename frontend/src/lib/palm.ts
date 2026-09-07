// Palm Reading API client. The reading is server-authoritative (Sarvam); the app
// only renders what the backend returns. The optional palm photo never leaves
// the device — it is not part of this payload.
import { api } from './api';

export const RELATIONS = ['Self', 'Spouse', 'Child', 'Mother', 'Father', 'Sibling', 'Friend', 'Other'] as const;
export type Relation = (typeof RELATIONS)[number];

export const HANDS = ['Left', 'Right'] as const;
export type Hand = (typeof HANDS)[number];

export const HAND_SHAPES = ['Earth', 'Air', 'Fire', 'Water'] as const;
export type HandShape = (typeof HAND_SHAPES)[number];

export const FINGER_LENGTHS = ['Short', 'Balanced', 'Long'] as const;
export const THUMB_FLEX = ['Firm', 'Balanced', 'Flexible'] as const;

export const LINE_KEYS = ['heart', 'head', 'life', 'fate'] as const;
export type LineKey = (typeof LINE_KEYS)[number];

export const LINE_OPTIONS: Record<LineKey, string[]> = {
  heart: ['Deep & long', 'Curved & short', 'Chained or faint', 'Not sure'],
  head: ['Long & straight', 'Long & curved', 'Short', 'Forked at end', 'Not sure'],
  life: ['Wide arc', 'Close to thumb', 'Broken or faint', 'Not sure'],
  fate: ['Strong & unbroken', 'Faint', 'Multiple', 'Absent', 'Not sure'],
};

export const MOUNTS = ['Jupiter', 'Saturn', 'Sun', 'Mercury', 'Venus', 'Moon', 'Mars'] as const;
export type Mount = (typeof MOUNTS)[number];

// planetary ruler (Vedic) shown alongside each mount
export const MOUNT_RULER: Record<Mount, string> = {
  Jupiter: 'Guru',
  Saturn: 'Shani',
  Sun: 'Surya',
  Mercury: 'Budha',
  Venus: 'Shukra',
  Moon: 'Chandra',
  Mars: 'Mangala',
};

export const MARKS = [
  'Fish (Matsya)',
  'Conch (Shankha)',
  'Lotus (Kamala)',
  'Trident (Trishula)',
  'Flag (Dhwaja)',
  'Temple (Mandir)',
  'Star',
  'Triangle',
  'None',
] as const;

export type PalmReading = {
  id: string;
  name: string;
  relation: Relation | null;
  dominant_hand: Hand;
  hand_shape: HandShape;
  finger_length: string | null;
  thumb_flex: string | null;
  lines: Partial<Record<LineKey, string>>;
  mounts: Mount[];
  marks: string[];
  profile: Record<string, unknown>;
  reading_en: string | null;
  created_at: string;
};

export type PalmSummary = {
  id: string;
  name: string;
  relation: Relation | null;
  dominant_hand: Hand;
  hand_shape: HandShape;
  headline_trait: string;
  has_reading: boolean;
  created_at: string;
};

export type GenerateBody = {
  name: string;
  relation?: Relation | null;
  dominant_hand: Hand;
  hand_shape: HandShape;
  finger_length?: string | null;
  thumb_flex?: string | null;
  lines: Partial<Record<LineKey, string>>;
  mounts: Mount[];
  marks: string[];
};

export function generatePalm(body: GenerateBody, token: string | null) {
  return api<PalmReading>('/palm/generate', { method: 'POST', body, token });
}

export function getLatestPalm(token: string | null) {
  return api<PalmReading>('/palm', { token });
}

export function listPalms(token: string | null) {
  return api<PalmSummary[]>('/palm/list', { token });
}

export function getPalm(id: string, token: string | null) {
  return api<PalmReading>(`/palm/${id}`, { token });
}

export function deletePalm(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/palm/${id}`, { method: 'DELETE', token });
}

export function getPalmReading(id: string, token: string | null) {
  return api<{ reading_en: string; cached: boolean }>(`/palm/${id}/reading`, {
    method: 'POST',
    token,
  });
}
