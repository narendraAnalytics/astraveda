// Kundali API client. Chart math + reading are server-authoritative; the app
// only renders what the backend returns.
import { api } from './api';

export type Place = {
  label: string;
  name?: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type Planet = {
  name: string;
  longitude: number;
  sign: string;
  sign_index: number;
  degree: string;
  house: number;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
};

export type House = {
  house: number;
  sign: string;
  sign_index: number;
  planets: string[];
};

export type DashaPeriod = {
  lord: string;
  start: string;
  end: string;
  years?: number;
};

export type Chart = {
  meta: { ayanamsa: number; ayanamsa_name: string; house_system: string };
  lagna: { sign: string; sign_index: number; degree: string; nakshatra: string };
  avakhada: {
    varna: string;
    rashi: string;
    rashi_lord: string;
    nakshatra: string;
    nakshatra_pada: number;
    nakshatra_lord: string;
    tithi: string;
    sun_sign: string;
    moon_sign: string;
  };
  panchanga: { vaara: string; tithi: string; nakshatra: string };
  planets: Planet[];
  houses: House[];
  vimshottari: {
    balance_at_birth: { lord: string; years: number };
    mahadasha: DashaPeriod[];
    current: { mahadasha: string | null; antardasha: string | null };
    antardasha: DashaPeriod[];
  };
};

export const RELATIONS = ['Self', 'Spouse', 'Child', 'Mother', 'Father', 'Sibling', 'Friend', 'Other'] as const;
export type Relation = (typeof RELATIONS)[number];

export type Kundali = {
  id: string;
  name: string;
  relation: Relation | null;
  birth_date: string;
  birth_time: string;
  unknown_time: boolean;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone: string;
  chart: Chart;
  reading_en: string | null;
  created_at: string;
};

export type KundaliSummary = {
  id: string;
  name: string;
  relation: Relation | null;
  birth_date: string;
  birth_time: string;
  unknown_time: boolean;
  birth_place: string;
  lagna: string | null;
  moon_sign: string | null;
  nakshatra: string | null;
  current_mahadasha: string | null;
  has_reading: boolean;
  created_at: string;
};

export type GenerateBody = {
  name: string;
  relation?: Relation | null;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM
  unknown_time: boolean;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

// Public endpoint — no token needed (plain city lookup, no user data).
export function searchPlaces(q: string) {
  return api<Place[]>(`/kundali/geocode?q=${encodeURIComponent(q)}`);
}

export function generateKundali(body: GenerateBody, token: string | null) {
  return api<Kundali>('/kundali/generate', { method: 'POST', body, token });
}

export function getLatestKundali(token: string | null) {
  return api<Kundali>('/kundali', { token });
}

export function listKundalis(token: string | null) {
  return api<KundaliSummary[]>('/kundali/list', { token });
}

export function getKundali(id: string, token: string | null) {
  return api<Kundali>(`/kundali/${id}`, { token });
}

export function deleteKundali(id: string, token: string | null) {
  return api<{ deleted: boolean }>(`/kundali/${id}`, { method: 'DELETE', token });
}

export function getKundaliReading(id: string, token: string | null) {
  return api<{ reading_en: string; cached: boolean }>(`/kundali/${id}/reading`, {
    method: 'POST',
    token,
  });
}
