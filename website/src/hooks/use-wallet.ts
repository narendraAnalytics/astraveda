"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getWallet, type WalletState } from "@/lib/wallet";

export function useWallet(enabled: boolean = true) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    try {
      const w = await getWallet(token);
      setWallet(w);
    } catch {
      // leave the previous balance in place; callers can retry
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !enabled || !isSignedIn) {
      setLoading(false);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, enabled, isSignedIn]);

  return { wallet, loading, refresh };
}
