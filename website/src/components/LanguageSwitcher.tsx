"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Globe, Lock, LogIn } from "lucide-react";
import { LANGUAGES, type LangCode } from "@/i18n/languages";
import { useI18n } from "@/i18n/I18nProvider";

// Inline SVG — flag emoji don't render on Windows browsers (they show "IN").
function IndiaFlag() {
  return (
    <span className="inline-block h-[15px] w-[22px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15">
      <svg viewBox="0 0 24 16" width="22" height="15" aria-hidden className="block">
        <rect width="24" height="5.34" fill="#FF9933" />
        <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
        <rect y="10.66" width="24" height="5.34" fill="#138808" />
        <g stroke="#000080" strokeWidth="0.35" fill="none">
          <circle cx="12" cy="8" r="2.1" strokeWidth="0.5" />
          <line x1="9.9" y1="8" x2="14.1" y2="8" />
          <line x1="12" y1="5.9" x2="12" y2="10.1" />
          <line x1="10.515" y1="6.515" x2="13.485" y2="9.485" />
          <line x1="13.485" y1="6.515" x2="10.515" y2="9.485" />
        </g>
      </svg>
    </span>
  );
}

// Navbar language picker. Guests can use English + Odia; the other five stay visible
// but locked behind sign-in (same rule as the mobile app). Signed-in users get all 7.
export default function LanguageSwitcher({ isLight }: { isLight: boolean }) {
  const { lang, d, signedIn, isLocked, setLang } = useI18n();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [nudged, setNudged] = useState<LangCode | null>(null);
  const [tick, setTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setNudged(null);
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // move focus into the list for keyboard users
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("[data-row][aria-selected='true']")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: LangCode) => {
    if (isLocked(code)) {
      setNudged(code);
      setTick((t) => t + 1);
      return;
    }
    setLang(code);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const rows = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? []);
    const i = rows.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
    rows[next]?.focus();
  };

  const triggerCls = isLight
    ? "border-black/10 bg-white/70 text-[#1B1730] hover:bg-white"
    : "border-white/25 bg-white/10 text-[#FFF7E6] hover:bg-white/20";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${d.lang.label}: ${LANGUAGES.find((l) => l.code === lang)?.endonym}`}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[7px] text-[12.5px] font-semibold backdrop-blur-md transition-colors duration-300 ${triggerCls}`}
      >
        <IndiaFlag />
        <span className="tracking-[.04em]">{lang.toUpperCase()}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="listbox"
            aria-label={d.lang.title}
            onKeyDown={onListKey}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", damping: 24, stiffness: 340 }}
            style={{ transformOrigin: "top right" }}
            className="fixed inset-x-3 top-[70px] z-[60] flex max-h-[calc(100dvh-84px)] flex-col overflow-hidden rounded-2xl border border-black/[.07] bg-[#FFFDF8]/95 p-2 shadow-[0_24px_60px_rgba(40,20,80,.22)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[330px]"
          >
            <div className="flex shrink-0 items-center gap-3 px-3 pb-2 pt-1.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#FFE6BF] to-[#FFC98A] text-[#9A5A0E]">
                <Globe size={18} />
              </span>
              <div>
                <div className="text-[15px] font-semibold leading-tight text-[#1B1730]">{d.lang.title}</div>
                <div className="text-[11.5px] text-[#7a7390]">{d.lang.subtitle}</div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
              {LANGUAGES.map((l, i) => {
                const selected = l.code === lang;
                const locked = isLocked(l.code);
                const hinting = locked && nudged === l.code;
                return (
                  <motion.button
                    key={l.code}
                    type="button"
                    role="option"
                    data-row
                    aria-selected={selected}
                    aria-disabled={locked}
                    onClick={() => pick(l.code)}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * i }}
                    className={`block w-full rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8F29DD]/40 ${
                      selected ? "bg-[#8F29DD]/[.08]" : hinting ? "bg-[#FFF1DC]" : locked ? "hover:bg-black/[.03]" : "hover:bg-[#8F29DD]/[.05]"
                    }`}
                  >
                    {/* inner wrapper re-mounts on every locked tap so the shake replays */}
                    <motion.span
                      key={hinting ? `shake-${tick}` : "idle"}
                      className="flex items-center gap-3 px-3 py-1.5"
                      initial={{ x: 0 }}
                      animate={hinting && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-semibold text-[#3a2a1a] ${locked ? "opacity-50 saturate-50" : ""}`}
                        style={{ background: `linear-gradient(135deg, ${l.tint[0]}, ${l.tint[1]})` }}
                      >
                        {l.badge}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[15px] font-semibold leading-tight ${locked ? "text-[#8b849c]" : "text-[#1B1730]"}`}>
                          {l.endonym}
                        </span>
                        <span className={`block text-[11.5px] ${hinting ? "font-medium text-[#B26A1C]" : "text-[#8b849c]"}`}>
                          {hinting ? d.lang.lockedHint : l.english}
                        </span>
                      </span>
                      {locked ? (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-black/[.05] text-[#b0895b]">
                          <Lock size={13} />
                        </span>
                      ) : selected ? (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#A72BE6] to-[#8F29DD] text-white">
                          <Check size={14} />
                        </span>
                      ) : null}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>

            {!signedIn && (
              <motion.div
                key={tick}
                animate={tick && !reduced ? { scale: [1, 1.035, 1] } : undefined}
                transition={{ duration: 0.28 }}
                className="mt-1.5 shrink-0 rounded-xl bg-gradient-to-br from-[#FFF3D6] to-[#FFE3EC] p-2.5"
              >
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[#5a3a00]">
                  <Lock size={14} /> {d.lang.unlockTitle}
                </div>
                <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[#7a5a2a]">{d.lang.unlockBody}</p>
                <a
                  href="/sign-in"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold text-[#241505] shadow-[0_4px_14px_rgba(244,210,138,.45)]"
                  style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
                >
                  <LogIn size={14} /> {d.lang.unlockCta}
                </a>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
