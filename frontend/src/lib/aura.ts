// AR Aura & Energy Scan API client. Gemini reads the selfie's colour/light;
// the energy quiz steers the chakra map; Sarvam writes the narrative. The
// selfie never leaves the device beyond the one-shot scan.
import { api } from './api';

export const RELATIONS = ['Self', 'Spouse', 'Child', 'Mother', 'Father', 'Sibling', 'Friend', 'Other'] as const;
export type Relation = (typeof RELATIONS)[number];

export const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export const RELATIONSHIP_STATUS = ['Single', 'In a relationship', 'Married', 'Prefer not to say'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUS)[number];

export const AURA_COLORS = [
  'Red',
  'Orange',
  'Yellow',
  'Gold',
  'Green',
  'Teal',
  'Blue',
  'Indigo',
  'Violet',
  'Pink',
  'White',
] as const;
export type AuraColor = (typeof AURA_COLORS)[number];

// Display hex for each aura colour (glow + swatches).
export const AURA_HEX: Record<AuraColor, string> = {
  Red: '#e23b3b',
  Orange: '#f0862f',
  Yellow: '#f2c235',
  Gold: '#d9a521',
  Green: '#3fa66b',
  Teal: '#12a594',
  Blue: '#3b82d6',
  Indigo: '#5a4bd6',
  Violet: '#8b45d6',
  Pink: '#e0567f',
  White: '#e8e6f0',
};

export const AURA_MEANING: Record<AuraColor, string> = {
  Red: 'Passion, drive, vitality — a body full of fire.',
  Orange: 'Creativity, confidence, appetite for adventure.',
  Yellow: 'Optimism, quick intellect, an easy joy.',
  Gold: 'Wisdom, abundance, a protected and settled spirit.',
  Green: 'Healing, growth, a heart seeking balance.',
  Teal: 'Calm clarity — feeling and thought in step.',
  Blue: 'Truth, communication, a cool steady mind.',
  Indigo: 'Deep intuition, sensitivity, an inward gaze.',
  Violet: 'Spiritual vision, imagination, a bridge to the unseen.',
  Pink: 'Love, compassion, tenderness toward others.',
  White: 'Purity, clarity, a channel open to higher connection.',
};

export const CHAKRAS = [
  { key: 'root', label: 'Root', hex: '#e23b3b' },
  { key: 'sacral', label: 'Sacral', hex: '#f0862f' },
  { key: 'solar', label: 'Solar Plexus', hex: '#f2c235' },
  { key: 'heart', label: 'Heart', hex: '#3fa66b' },
  { key: 'throat', label: 'Throat', hex: '#3b82d6' },
  { key: 'thirdEye', label: 'Third Eye', hex: '#5a4bd6' },
  { key: 'crown', label: 'Crown', hex: '#8b45d6' },
] as const;

// The 4-question energy quiz. Keys match the backend (energy/focus/feeling/need).
export const AURA_QUIZ = [
  {
    key: 'energy',
    question: 'How is your energy today?',
    options: ['Restless', 'Steady', 'Low and tired', 'Buzzing'],
  },
  {
    key: 'focus',
    question: "What's mostly on your mind?",
    options: ['Love & people', 'Work & money', 'Health & body', 'Meaning & direction'],
  },
  {
    key: 'feeling',
    question: 'Which feels most true right now?',
    options: ["I'm holding something in", "I'm open and flowing", "I'm guarding myself", "I'm searching"],
  },
  {
    key: 'need',
    question: 'What would help most?',
    options: ['Rest', 'Courage', 'Clarity', 'Connection'],
  },
] as const;

export type QuizAnswers = Partial<Record<'energy' | 'focus' | 'feeling' | 'need', string>>;

export type AuraReading = {
  id: string;
  name: string;
  relation: Relation | null;
  dominant_color: AuraColor;
  secondary_colors: AuraColor[];
  features: { brightness?: string | null; warmth?: string | null; visual_notes?: string | null };
  quiz: QuizAnswers;
  profile: Record<string, unknown>;
  source: 'scan';
  reading_en: string | null;
  created_at: string;
};

export type AuraSummary = {
  id: string;
  name: string;
  relation: Relation | null;
  dominant_color: AuraColor;
  headline_trait: string;
  source: 'scan';
  has_reading: boolean;
  created_at: string;
};

export type PersonFields = {
  name: string;
  relation?: Relation | null;
  gender?: Gender | null;
  relationship_status?: RelationshipStatus | null;
  birth_date?: string | null;
};

export type AuraCheckout = {
  payment_id: string;
  order_id: string;
  key_id: string;
  amount_paise: number;
  method?: 'card' | 'wallet';
  currency: string;
};

export type PaymentProof = {
  payment_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export function createAuraCheckout(
  body: PersonFields,
  token: string | null,
  method: 'card' | 'wallet' = 'card',
) {
  return api<AuraCheckout>('/aura/checkout', { method: 'POST', body: { ...body, method }, token });
}

export function pendingAuraCheckout(token: string | null) {
  return api<{ pending: null | { payment_id: string; person: PersonFields } }>('/aura/checkout/pending', { token });
}

export function scanAura(
  body: PersonFields & { image: string; mime_type?: string; quiz: QuizAnswers },
  payment: PaymentProof | { payment_id: string } | null,
  token: string | null,
) {
  return api<AuraReading>('/aura/scan', {
    method: 'POST',
    body: { ...body, ...(payment ?? {}) },
    token,
  });
}

export function listAuras(token: string | null) {
  return api<AuraSummary[]>('/aura/list', { token });
}

export function getAura(id: string, token: string | null) {
  return api<AuraReading>(`/aura/${id}`, { token });
}

export function deleteAura(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/aura/${id}`, { method: 'DELETE', token });
}

export function getAuraReading(id: string, token: string | null) {
  return api<{ reading_en: string; cached: boolean }>(`/aura/${id}/reading`, { method: 'POST', token });
}
