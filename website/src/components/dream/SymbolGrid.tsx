"use client";

import { motion } from "framer-motion";
import { glyphFor, type DreamSymbol } from "@/lib/dream";

// Symbol-by-symbol cards — the pattern every 2026 dream app leads with. Each
// symbol is a soft indigo-glass tile with a glyph chip; they stagger in.
export default function SymbolGrid({ symbols }: { symbols: DreamSymbol[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {symbols.map((s, i) => (
        <motion.div
          key={`${s.symbol}-${i}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 + i * 0.06, ease: "easeOut" }}
          className="flex items-start gap-3 rounded-[16px] p-3.5 border"
          style={{
            background: "linear-gradient(160deg, rgba(79,70,229,.09), rgba(109,40,217,.04) 60%, #fff)",
            borderColor: "rgba(79,70,229,.16)",
          }}
        >
          <span
            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[19px] flex-shrink-0 shadow-[0_6px_14px_rgba(79,70,229,.3)]"
            style={{ background: "linear-gradient(135deg,#4f46e5,#6d28d9)" }}
          >
            {glyphFor(s.symbol)}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[#2b2a45] capitalize">{s.symbol}</p>
            {s.meaning && <p className="text-[13px] leading-[1.55] text-[#575572] mt-0.5">{s.meaning}</p>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
