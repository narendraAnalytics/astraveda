// Money wallet — balance, ledger, Razorpay top-up (finalview.txt §12).
import { api } from './api';

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

// Top-up presets, in paise. ₹100 minimum.
export const TOPUP_PRESETS = [10000, 25000, 50000, 100000, 200000] as const;

// Mirrors backend services/wallet._BONUS_TIERS.
export function bonusFor(topupPaise: number): number {
  if (topupPaise >= 200000) return 30000;
  if (topupPaise >= 100000) return 5000;
  if (topupPaise >= 50000) return 1500;
  return 0;
}

export type WalletTxn = {
  id: string;
  amount_paise: number; // signed
  kind: 'topup' | 'bonus' | 'debit' | 'refund';
  balance_after: number;
  description: string;
  created_at: string;
};

export type WalletState = { balance_paise: number; transactions: WalletTxn[] };

export type TopupCheckout = {
  payment_id: string;
  order_id: string;
  key_id: string;
  amount_paise: number;
  bonus_paise: number;
  currency: string;
};

export function getWallet(token: string | null) {
  return api<WalletState>('/wallet', { token });
}

export function listWalletTransactions(token: string | null) {
  return api<WalletTxn[]>('/wallet/transactions', { token });
}

export function topupWallet(amountPaise: number, token: string | null) {
  return api<TopupCheckout>('/wallet/topup', { method: 'POST', body: { amount_paise: amountPaise }, token });
}

export function pendingTopup(token: string | null) {
  return api<{ pending: null | { payment_id: string; amount_paise: number } }>('/wallet/topup/pending', { token });
}

export function confirmTopup(
  body: { payment_id: string; razorpay_payment_id?: string; razorpay_signature?: string },
  token: string | null,
) {
  return api<{ balance_paise: number; credited_paise: number; bonus_paise: number }>('/wallet/topup/confirm', {
    method: 'POST',
    body,
    token,
  });
}

// Shared shape for every tool's checkout response (they all gained `method`).
export type ToolCheckout = {
  payment_id: string;
  order_id: string;
  key_id: string;
  amount_paise: number;
  method: 'card' | 'wallet';
  currency: string;
};
