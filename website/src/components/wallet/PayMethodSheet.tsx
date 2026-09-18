"use client";

import { AnimatePresence, motion } from "framer-motion";
import { rupees } from "@/lib/wallet";

// The "pay by wallet or card" chooser shown before every tool checkout.
// Mirrors frontend/src/components/wallet/pay-method-sheet.tsx (mobile) as a
// centered web dialog instead of a bottom sheet. The wallet row disables
// itself (with an "Add money" shortcut to /wallet) when the balance is short.
export default function PayMethodSheet({
  open,
  amountPaise,
  balancePaise,
  onPick,
  onAddMoney,
  onClose,
}: {
  open: boolean;
  amountPaise: number;
  balancePaise: number | null;
  onPick: (method: "wallet" | "card") => void;
  onAddMoney: () => void;
  onClose: () => void;
}) {
  const enough = balancePaise !== null && balancePaise >= amountPaise;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-[#1B1730]/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full sm:max-w-[420px] bg-[#FFFAF2] rounded-t-[24px] sm:rounded-[24px] px-6 pt-5 pb-7 sm:pb-6"
          >
            <div className="w-9 h-1 rounded-full bg-[#1B1730]/12 mx-auto mb-5 sm:hidden" />
            <h3 className="font-[family-name:var(--font-display)] text-[19px] font-medium text-[#1B1730] mb-4">
              Pay {rupees(amountPaise)}
            </h3>

            <button
              type="button"
              disabled={!enough}
              onClick={() => enough && onPick("wallet")}
              className={`w-full flex items-center gap-3 rounded-[16px] border border-[#1B1730]/10 bg-white px-4 py-3.5 mb-2.5 text-left transition-opacity ${
                enough ? "hover:border-[#C18426]/40" : "opacity-70"
              }`}
            >
              <span className="w-10 h-10 rounded-[13px] bg-[#FDF1DD] flex items-center justify-center text-[18px] flex-shrink-0">
                👛
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-[#1B1730]">
                  AstraVeda Wallet
                </span>
                <span
                  className={`block text-[11.5px] mt-0.5 ${
                    enough ? "text-[#8A8398]" : "text-[#C0392B] font-medium"
                  }`}
                >
                  {balancePaise === null ? "—" : rupees(balancePaise)}
                  {!enough && balancePaise !== null ? " · not enough" : ""}
                </span>
              </span>
              {enough ? (
                <span className="text-[#C7AD97] text-[15px]">›</span>
              ) : (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddMoney();
                  }}
                  className="text-[11px] font-bold text-white bg-[#C18426] rounded-[9px] px-2.5 py-1.5"
                >
                  Add money
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onPick("card")}
              className="w-full flex items-center gap-3 rounded-[16px] border border-[#1B1730]/10 bg-white px-4 py-3.5 mb-4 text-left hover:border-[#D6336C]/40 transition-colors"
            >
              <span className="w-10 h-10 rounded-[13px] bg-[#F3E8FF] flex items-center justify-center text-[18px] flex-shrink-0">
                💳
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-[#1B1730]">Card / UPI</span>
                <span className="block text-[11.5px] text-[#8A8398] mt-0.5">
                  Pay securely via Razorpay
                </span>
              </span>
              <span className="text-[#C7AD97] text-[15px]">›</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-[13px] font-semibold text-[#5B5570] py-1"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
