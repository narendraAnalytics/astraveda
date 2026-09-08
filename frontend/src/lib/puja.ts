// Temple & Puja booking API client (finalview.txt §25 — demo).
// Browse a seeded catalog, book a puja, pay via Razorpay, get a booking slip.
// Money is server-authoritative: amount = per-person price × devotees.
import { api } from './api';

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya',
  'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana',
  'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

export type PujaItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  benefits: string;
  price_per_person_paise: number;
  daily_capacity: number;
  booked_today: number;
  duration_note: string;
};

export type Temple = {
  id: string;
  slug: string;
  name: string;
  deity: string;
  city: string;
  state: string;
  image_url: string;
  about: string;
  pujas: PujaItem[];
};

export type Availability = { date: string; capacity: number; booked: number; remaining: number };

export type PujaCheckout = {
  payment_id: string;
  puja_order_id: string;
  order_id: string;
  key_id: string;
  amount_paise: number;
  currency: string;
};

export type PujaOrder = {
  id: string;
  booking_code: string;
  status: 'created' | 'confirmed' | 'cancelled';
  temple_name: string;
  temple_city: string;
  deity: string;
  puja_name: string;
  devotee_name: string;
  gotra: string | null;
  nakshatra: string | null;
  phone: string | null;
  num_devotees: number;
  preferred_date: string;
  amount_paise: number;
  created_at: string;
  confirmed_at: string | null;
};

export type CheckoutBody = {
  puja_id: string;
  devotee_name: string;
  gotra?: string | null;
  nakshatra?: string | null;
  phone?: string | null;
  num_devotees: number;
  preferred_date: string; // YYYY-MM-DD
};

// Public — no token needed (plain catalog browse).
export function listTemples() {
  return api<Temple[]>('/temples');
}

export function pujaAvailability(pujaId: string, date: string) {
  return api<Availability>(`/puja/availability?puja_id=${encodeURIComponent(pujaId)}&date=${date}`);
}

export function createPujaCheckout(body: CheckoutBody, token: string | null) {
  return api<PujaCheckout>('/puja/checkout', { method: 'POST', body, token });
}

export function confirmPuja(
  body: { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string },
  token: string | null,
) {
  return api<PujaOrder>('/puja/confirm', { method: 'POST', body, token });
}

export function pendingPujaCheckout(token: string | null) {
  return api<{ pending: null | { payment_id: string; puja_order_id: string } }>('/puja/checkout/pending', { token });
}

export function listPujaOrders(token: string | null) {
  return api<PujaOrder[]>('/puja/orders', { token });
}

export function getPujaOrder(id: string, token: string | null) {
  return api<PujaOrder>(`/puja/orders/${id}`, { token });
}
