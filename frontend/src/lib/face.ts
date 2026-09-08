// Face Reading (Mukha Samudrika Shastra) API client. The reading is
// server-authoritative (Gemini features + Sarvam narrative); the app only
// renders what the backend returns. The selfie never leaves the device — it is
// not part of any payload beyond the one-shot scan.
import { api } from './api';

export const RELATIONS = ['Self', 'Spouse', 'Child', 'Mother', 'Father', 'Sibling', 'Friend', 'Other'] as const;
export type Relation = (typeof RELATIONS)[number];

export const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export const RELATIONSHIP_STATUS = ['Single', 'In a relationship', 'Married', 'Prefer not to say'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUS)[number];

export const FACE_SHAPES = ['Oval', 'Round', 'Square', 'Oblong', 'Heart', 'Diamond'] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

export const FEATURE_KEYS = [
  'forehead',
  'eyebrows',
  'eyes',
  'nose',
  'lips',
  'cheeks',
  'chin_jaw',
  'ears',
  'three_zones',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  forehead: 'Forehead',
  eyebrows: 'Eyebrows',
  eyes: 'Eyes',
  nose: 'Nose',
  lips: 'Lips',
  cheeks: 'Cheeks',
  chin_jaw: 'Chin & jaw',
  ears: 'Ears',
  three_zones: 'The three zones',
};

export type FaceReading = {
  id: string;
  name: string;
  relation: Relation | null;
  face_shape: FaceShape | 'Unknown';
  features: Partial<Record<FeatureKey, string>>;
  marks: string[];
  profile: Record<string, unknown>;
  source: 'scan' | 'guided';
  reading_en: string | null;
  created_at: string;
};

export type FaceSummary = {
  id: string;
  name: string;
  relation: Relation | null;
  face_shape: FaceShape | 'Unknown';
  headline_trait: string;
  source: 'scan' | 'guided';
  has_reading: boolean;
  created_at: string;
};

export type PersonFields = {
  name: string;
  relation?: Relation | null;
  gender?: Gender | null;
  relationship_status?: RelationshipStatus | null;
  birth_date?: string | null; // YYYY-MM-DD
};

export type FaceCheckout = {
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

// Creates a ₹45 Razorpay order for one face reading. Throws ApiError 503 if
// payments aren't configured.
export function createFaceCheckout(
  body: PersonFields,
  token: string | null,
  method: 'card' | 'wallet' = 'card',
) {
  return api<FaceCheckout>('/face/checkout', { method: 'POST', body: { ...body, method }, token });
}

export function pendingFaceCheckout(token: string | null) {
  return api<{ pending: null | { payment_id: string; person: PersonFields } }>(
    '/face/checkout/pending',
    { token },
  );
}

/**
 * Analyse a selfie with Gemini Vision. A 422 means "retake the photo" —
 * `ApiError.message` carries the reason. `payment` proves the ₹45 order.
 */
export function scanFace(
  body: PersonFields & { image: string; mime_type?: string },
  payment: PaymentProof | { payment_id: string } | null,
  token: string | null,
) {
  return api<FaceReading>('/face/scan', {
    method: 'POST',
    body: { ...body, ...(payment ?? {}) },
    token,
  });
}

/** Camera-denied fallback: 3 self-reported features. */
export function generateFace(
  body: PersonFields & { face_shape: FaceShape; forehead?: string | null; chin_jaw?: string | null },
  payment: PaymentProof | { payment_id: string } | null,
  token: string | null,
) {
  return api<FaceReading>('/face/generate', {
    method: 'POST',
    body: { ...body, ...(payment ?? {}) },
    token,
  });
}

export function listFaces(token: string | null) {
  return api<FaceSummary[]>('/face/list', { token });
}

export function getFace(id: string, token: string | null) {
  return api<FaceReading>(`/face/${id}`, { token });
}

export function deleteFace(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/face/${id}`, { method: 'DELETE', token });
}

export function getFaceReading(id: string, token: string | null) {
  return api<{ reading_en: string; cached: boolean }>(`/face/${id}/reading`, {
    method: 'POST',
    token,
  });
}
