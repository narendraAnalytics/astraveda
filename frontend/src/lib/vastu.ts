// Vastu AI API client. One Gemini call: room photo + facing direction + room
// type -> a Vastu score, elemental balance, doshas and non-demolition remedies.
// The photo never leaves the device beyond the one analyze call.
import { api } from './api';

export const ROOM_TYPES = [
  'Entrance',
  'Living',
  'Kitchen',
  'Bedroom',
  'Pooja',
  'Bathroom',
  'Study',
  'Other',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const DIRECTIONS = [
  { key: 'N', label: 'North' },
  { key: 'NE', label: 'North-East' },
  { key: 'E', label: 'East' },
  { key: 'SE', label: 'South-East' },
  { key: 'S', label: 'South' },
  { key: 'SW', label: 'South-West' },
  { key: 'W', label: 'West' },
  { key: 'NW', label: 'North-West' },
  { key: 'Unknown', label: 'Not sure' },
] as const;
export type Direction = (typeof DIRECTIONS)[number]['key'];

export const ELEMENTS = ['Fire', 'Water', 'Earth', 'Air', 'Space'] as const;
export type Element = (typeof ELEMENTS)[number];

export const ELEMENT_HEX: Record<Element, string> = {
  Fire: '#e23b3b',
  Water: '#3b82d6',
  Earth: '#a2660f',
  Air: '#12a594',
  Space: '#7c3aed',
};

export const ELEMENT_STATE_RANK: Record<string, number> = {
  strong: 1,
  balanced: 0.72,
  weak: 0.42,
  afflicted: 0.2,
};

export type VastuElement = { element: Element; state: string; note: string };
export type VastuDosha = { issue: string; severity: 'minor' | 'moderate' | 'major' };
export type VastuRemedy = { remedy: string; fixes: string; ease: 'easy' | 'moderate' };

export type VastuReading = {
  id: string;
  label: string;
  room_type: RoomType;
  direction: Direction;
  score: number;
  verdict: string;
  elements: VastuElement[];
  doshas: VastuDosha[];
  remedies: VastuRemedy[];
  summary: string;
  guidance: string;
  created_at: string;
};

export type VastuSummary = {
  id: string;
  label: string;
  room_type: RoomType;
  direction: Direction;
  score: number;
  verdict: string;
  dosha_count: number;
  created_at: string;
};

export type SpaceFields = { label: string; room_type: RoomType; direction: Direction };

export type VastuCheckout = {
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

export function createVastuCheckout(
  body: SpaceFields,
  token: string | null,
  method: 'card' | 'wallet' = 'card',
) {
  return api<VastuCheckout>('/vastu/checkout', { method: 'POST', body: { ...body, method }, token });
}

export function pendingVastuCheckout(token: string | null) {
  return api<{ pending: null | { payment_id: string; space: SpaceFields } }>('/vastu/checkout/pending', { token });
}

export function analyzeVastu(
  body: SpaceFields & { image: string; mime_type?: string },
  payment: PaymentProof | { payment_id: string } | null,
  token: string | null,
) {
  return api<VastuReading>('/vastu/analyze', {
    method: 'POST',
    body: { ...body, ...(payment ?? {}) },
    token,
  });
}

export function listVastu(token: string | null) {
  return api<VastuSummary[]>('/vastu/list', { token });
}

export function getVastu(id: string, token: string | null) {
  return api<VastuReading>(`/vastu/${id}`, { token });
}

export function deleteVastu(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/vastu/${id}`, { method: 'DELETE', token });
}
