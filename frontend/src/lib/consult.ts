// Ask AstraVeda — voice consultation API client. The backend places an outbound
// phone call via Sarvam Voice Agents; money is server-authoritative (₹99/call).
import { api } from './api';

export const CONSULT_PRICE = 9900;

export const TOPICS = ['career', 'marriage', 'health', 'finance', 'general'] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABEL: Record<Topic, string> = {
  career: 'Career & work',
  marriage: 'Marriage & love',
  health: 'Health & wellbeing',
  finance: 'Money & finance',
  general: 'General life reading',
};

export type ConsultBody = {
  caller_name: string;
  phone_e164: string;
  consultation_topic: Topic;
  user_question: string;
  birth_date: string | null; // YYYY-MM-DD
  birth_time: string | null; // HH:MM
  unknown_time: boolean;
  birth_place: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  booking_type: 'now' | 'scheduled';
  slot: string | null; // ISO datetime with +05:30 offset
};

export type ConsultCheckout = {
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

export type TranscriptLine = { role: string | null; text: string };

export type Consultation = {
  id: string;
  caller_name: string;
  phone_e164: string;
  consultation_topic: Topic;
  user_question: string;
  birth_place: string;
  booking_type: 'now' | 'scheduled';
  slot_label: string;
  scheduled_at: string | null;
  status: 'created' | 'paid' | 'calling' | 'completed' | 'missed' | 'callback_requested' | 'failed';
  outcome: string | null;
  duration_sec: number | null;
  failure_reason: string | null;
  call_summary: string;
  transcript: TranscriptLine[];
  created_at: string;
};

export type ConsultSummary = {
  id: string;
  caller_name: string;
  consultation_topic: Topic;
  booking_type: 'now' | 'scheduled';
  slot_label: string;
  scheduled_at: string | null;
  status: Consultation['status'];
  outcome: string | null;
  created_at: string;
};

export type SlotDay = {
  label: string;
  date: string;
  slots: { iso: string; label: string }[];
};

// Public — hourly IST slots for the next few days.
export function getConsultSlots() {
  return api<SlotDay[]>('/consult/slots');
}

// Creates a ₹99 Razorpay order (card) or debits the wallet. 503 if voice isn't configured.
export function createConsultCheckout(
  body: ConsultBody,
  token: string | null,
  method: 'card' | 'wallet' = 'card',
) {
  return api<ConsultCheckout>('/consult/checkout', { method: 'POST', body: { ...body, method }, token });
}

export function pendingConsultCheckout(token: string | null) {
  return api<{ pending: null | { payment_id: string; booking: ConsultBody } }>(
    '/consult/checkout/pending',
    { token },
  );
}

// Confirms payment, creates the consultation, and places the call now (or books the slot).
export function confirmConsult(payment: PaymentProof | { payment_id: string }, token: string | null) {
  return api<Consultation>('/consult/confirm', { method: 'POST', body: payment, token });
}

export function listConsults(token: string | null) {
  return api<ConsultSummary[]>('/consult/list', { token });
}

export function getConsult(id: string, token: string | null) {
  return api<Consultation>(`/consult/${id}`, { token });
}

export function deleteConsult(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/consult/${id}`, { method: 'DELETE', token });
}
