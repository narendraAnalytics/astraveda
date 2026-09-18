"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";

import { useWallet } from "@/hooks/use-wallet";
import {
  TOPUP_PRESETS,
  bonusFor,
  confirmTopup,
  pendingTopup,
  rupees,
  topupWallet,
  type WalletTxn,
} from "@/lib/wallet";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { ApiError } from "@/lib/api";

type Stage = "idle" | "paying" | "confirming";

export default function WalletApp() {
  const { getToken } = useAuth();
  const { wallet, loading, refresh } = useWallet();

  const [customAmount, setCustomAmount] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkedResume, setCheckedResume] = useState(false);

  // If the browser closed right after paying (before /topup/confirm ran),
  // finish crediting the wallet on next visit instead of losing the payment.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      try {
        const { pending } = await pendingTopup(token);
        if (pending) {
          setStage("confirming");
          const res = await confirmTopup({ payment_id: pending.payment_id }, token);
          setError(null);
          setStage("idle");
          void res;
          await refresh();
        }
      } catch {
        // no pending top-up, or it wasn't actually paid yet — ignore
      } finally {
        setCheckedResume(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTopup = useCallback(
    async (amountPaise: number) => {
      setError(null);
      setStage("paying");
      const token = await getToken();
      try {
        const checkout = await topupWallet(amountPaise, token);
        await openRazorpayCheckout({
          keyId: checkout.key_id,
          orderId: checkout.order_id,
          amountPaise: checkout.amount_paise,
          name: "AstraVeda Wallet",
          description: `Add ${rupees(checkout.amount_paise)} to your wallet`,
          onSuccess: async (r) => {
            setStage("confirming");
            try {
              await confirmTopup(
                {
                  payment_id: checkout.payment_id,
                  razorpay_payment_id: r.razorpay_payment_id,
                  razorpay_signature: r.razorpay_signature,
                },
                token,
              );
              await refresh();
              setStage("idle");
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Couldn't confirm the top-up.");
              setStage("idle");
            }
          },
          onDismiss: () => setStage("idle"),
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start the top-up.");
        setStage("idle");
      }
    },
    [getToken, refresh],
  );

  const customPaise = Math.round(parseFloat(customAmount || "0") * 100);
  const customValid = customPaise >= 10000 && customPaise <= 5000000;
  const busy = stage !== "idle";

  return (
    <div className="space-y-8">
      <BalanceHero balancePaise={wallet?.balance_paise ?? null} loading={loading && !checkedResume} />

      {error && (
        <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[12px] px-4 py-3">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-[14px] font-semibold text-[#1B1730] mb-3">Add money</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {TOPUP_PRESETS.map((paise) => {
            const bonus = bonusFor(paise);
            return (
              <button
                key={paise}
                type="button"
                disabled={busy}
                onClick={() => startTopup(paise)}
                className="rounded-[16px] border border-[#C18426]/20 bg-white px-3 py-3.5 text-center hover:border-[#C18426]/50 hover:shadow-[0_6px_16px_rgba(193,132,38,.12)] transition-all disabled:opacity-50"
              >
                <div className="text-[15px] font-bold text-[#1B1730]">{rupees(paise)}</div>
                {bonus > 0 && (
                  <div className="text-[10px] font-semibold text-[#0D9488] mt-1">
                    +{rupees(bonus)} bonus
                  </div>
                )}
              </button>
            );
          })}
          <div className="rounded-[16px] border border-[#1B1730]/10 bg-white px-2.5 py-2 flex items-center gap-1.5">
            <span className="text-[13px] text-[#8A8398] pl-1">₹</span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Custom"
              min={100}
              max={50000}
              className="w-full min-w-0 text-[14px] font-semibold text-[#1B1730] outline-none bg-transparent"
            />
          </div>
        </div>
        {customAmount && (
          <button
            type="button"
            disabled={!customValid || busy}
            onClick={() => startTopup(customPaise)}
            className="mt-2.5 w-full h-11 rounded-[100px] font-semibold text-[13.5px] text-white bg-[linear-gradient(135deg,#C18426,#E9BE6C)] disabled:opacity-40 transition-opacity"
          >
            {customValid ? `Add ${rupees(customPaise)}` : "₹100 min · ₹50,000 max"}
          </button>
        )}
      </section>

      <section>
        <h2 className="text-[14px] font-semibold text-[#1B1730] mb-3">Recent activity</h2>
        {wallet && wallet.transactions.length > 0 ? (
          <div className="rounded-[18px] border border-[#1B1730]/8 bg-white divide-y divide-[#1B1730]/6 overflow-hidden">
            {wallet.transactions.map((t) => (
              <TxnRow key={t.id} txn={t} />
            ))}
          </div>
        ) : (
          !loading && (
            <p className="text-[13px] text-[#8A8398] text-center py-8">
              No transactions yet — top up to get started.
            </p>
          )
        )}
      </section>
    </div>
  );
}

function BalanceHero({
  balancePaise,
  loading,
}: {
  balancePaise: number | null;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-[28px] p-8 text-center bg-[linear-gradient(160deg,#2A1B08,#4A2F0C)] shadow-[0_20px_50px_rgba(74,47,12,.25)]"
    >
      <div className="text-[12px] font-medium tracking-[.06em] uppercase text-[#E9BE6C]/70 mb-2">
        Wallet Balance
      </div>
      <div className="font-[family-name:var(--font-display)] text-[44px] leading-none font-medium text-[#FFF7E6]">
        {loading || balancePaise === null ? "—" : rupees(balancePaise)}
      </div>
      <p className="text-[12px] text-[#FFF7E6]/55 mt-3">
        Pay for any AstraVeda chart or reading straight from this balance.
      </p>
    </motion.div>
  );
}

function TxnRow({ txn }: { txn: WalletTxn }) {
  const positive = txn.amount_paise > 0;
  const icon = { topup: "➕", bonus: "🎁", debit: "✦", refund: "↩" }[txn.kind] ?? "•";
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-9 h-9 rounded-full bg-[#FFFAF2] flex items-center justify-center text-[15px] flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-[#1B1730] truncate">
          {txn.description || txn.kind}
        </div>
        <div className="text-[11px] text-[#8A8398] mt-0.5">
          {new Date(txn.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      </div>
      <div
        className={`text-[13.5px] font-semibold flex-shrink-0 ${
          positive ? "text-[#0D9488]" : "text-[#1B1730]"
        }`}
      >
        {positive ? "+" : "−"}
        {rupees(Math.abs(txn.amount_paise))}
      </div>
    </div>
  );
}
