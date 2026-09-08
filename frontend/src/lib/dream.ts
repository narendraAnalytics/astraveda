// AI Dream Interpreter API client. Text only — Sarvam returns a structured
// reading (title, feeling, symbols, theme, Vedic note, guidance). Single call.
import { api } from './api';

export const RELATIONS = ['Self', 'Spouse', 'Child', 'Mother', 'Father', 'Sibling', 'Friend', 'Other'] as const;
export type Relation = (typeof RELATIONS)[number];

export const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export const RELATIONSHIP_STATUS = ['Single', 'In a relationship', 'Married', 'Prefer not to say'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUS)[number];

// Optional 1-tap context that sharpens the reading. Keys match the backend.
export const DREAM_CONTEXT = [
  {
    key: 'feeling',
    question: 'How did the dream feel?',
    options: ['Peaceful', 'Anxious', 'Frightening', 'Joyful', 'Confusing', 'Sad'],
  },
  {
    key: 'when',
    question: 'When did you have it?',
    options: ['Last night', 'This week', 'A recurring dream', 'Long ago but vivid'],
  },
  {
    key: 'night',
    question: 'What time of night?',
    options: ['Early night', 'Middle of the night', 'Near waking', 'Not sure'],
  },
  {
    key: 'focus',
    question: "What's on your mind lately?",
    options: ['Love & people', 'Work & money', 'Health & body', 'Meaning & direction'],
  },
] as const;

export type DreamContext = Partial<Record<'feeling' | 'when' | 'night' | 'focus', string>>;

export type DreamSymbol = { symbol: string; meaning: string };

export type DreamReading = {
  id: string;
  name: string;
  relation: Relation | null;
  dream_text: string;
  context: DreamContext;
  title: string;
  feeling: string;
  symbols: DreamSymbol[];
  theme: string;
  vedic_note: string;
  guidance: string;
  created_at: string;
};

export type DreamSummary = {
  id: string;
  name: string;
  relation: Relation | null;
  title: string;
  feeling: string;
  symbols: string[];
  created_at: string;
};

export type PersonFields = {
  name: string;
  relation?: Relation | null;
  gender?: Gender | null;
  relationship_status?: RelationshipStatus | null;
  birth_date?: string | null;
};

export type DreamBody = PersonFields & { dream: string; context: DreamContext };

export type DreamCheckout = {
  payment_id: string;
  order_id: string;
  key_id: string;
  amount_paise: number;
  currency: string;
};

export type PaymentProof = {
  payment_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export function createDreamCheckout(body: DreamBody, token: string | null) {
  return api<DreamCheckout>('/dream/checkout', { method: 'POST', body, token });
}

export function pendingDreamCheckout(token: string | null) {
  return api<{ pending: null | { payment_id: string; dream: DreamBody } }>('/dream/checkout/pending', { token });
}

export function interpretDream(
  body: DreamBody,
  payment: PaymentProof | { payment_id: string } | null,
  token: string | null,
) {
  return api<DreamReading>('/dream/interpret', {
    method: 'POST',
    body: { ...body, ...(payment ?? {}) },
    token,
  });
}

export function listDreams(token: string | null) {
  return api<DreamSummary[]>('/dream/list', { token });
}

export function getDream(id: string, token: string | null) {
  return api<DreamReading>(`/dream/${id}`, { token });
}

export function deleteDream(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/dream/${id}`, { method: 'DELETE', token });
}
