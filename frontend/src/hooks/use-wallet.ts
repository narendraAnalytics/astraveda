import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';

import { getWallet, type WalletState } from '../lib/wallet';

/** The signed-in user's wallet balance + recent transactions. */
export function useWallet() {
  const { isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setWallet(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getTokenRef.current();
        const w = await getWallet(token);
        if (!cancelled) setWallet(w);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your wallet');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, nonce]);

  return { wallet, balance: wallet?.balance_paise ?? 0, loading, error, refresh };
}
