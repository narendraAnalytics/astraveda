"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, MapPin, X } from "lucide-react";
import { VIRTUAL_TEMPLES, deityImage } from "@/lib/virtual-puja";

export default function TempleSheet({
  open,
  activeId,
  onClose,
  onPick,
}: {
  open: boolean;
  activeId: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Choose a temple"
            className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#15101f]/95 p-5 sm:p-7 shadow-2xl"
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#F6E3B4]">
                  Choose your shrine
                </h2>
                <p className="text-[12.5px] text-white/50">Each temple has its own ambience.</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[62svh] overflow-y-auto pr-1">
              {VIRTUAL_TEMPLES.map((t, i) => {
                const active = t.id === activeId;
                return (
                  <motion.button
                    key={t.id}
                    onClick={() => onPick(t.id)}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    whileHover={{ y: -3 }}
                    className="group relative overflow-hidden rounded-2xl text-left border"
                    style={{
                      borderColor: active ? `rgba(${t.glow},.9)` : "rgba(255,255,255,.1)",
                      boxShadow: active ? `0 0 26px rgba(${t.glow},.35)` : undefined,
                    }}
                  >
                    <div
                      className="aspect-[3/4] w-full"
                      style={{
                        background: `linear-gradient(160deg, ${t.colors[0]}, ${t.colors[1]} 60%, ${t.colors[2]})`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={deityImage(t, 400)}
                        alt={t.deity}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10">
                      <div className="text-[13px] font-semibold text-white leading-tight">{t.deity}</div>
                      <div className="flex items-center gap-1 text-[11px] text-white/65 mt-0.5">
                        <MapPin size={10} /> {t.place}
                      </div>
                    </div>
                    {active && (
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#F4D28A] text-[#3a1f00]">
                        <Check size={14} />
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
