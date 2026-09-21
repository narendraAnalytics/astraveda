"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { en } from "@/i18n/locales/en";
import { hi } from "@/i18n/locales/hi";
import { od } from "@/i18n/locales/od";
import { ta } from "@/i18n/locales/ta";
import { te } from "@/i18n/locales/te";
import { mr } from "@/i18n/locales/mr";
import { kn } from "@/i18n/locales/kn";

// "Enter" typed out in every language, one bright colour each. Words come from the locale
// dictionaries (single source of truth). `html` is the BCP-47 tag so the browser picks the right
// script font for each word (Odia is `or`, not `od`).
const WORDS = [
  { html: "en", text: en.intro.enter, color: "#FFC93C" }, // gold
  { html: "hi", text: hi.intro.enter, color: "#FF6B6B" }, // coral
  { html: "or", text: od.intro.enter, color: "#B983FF" }, // violet
  { html: "ta", text: ta.intro.enter, color: "#3DDC97" }, // mint
  { html: "te", text: te.intro.enter, color: "#4CC9F0" }, // sky
  { html: "mr", text: mr.intro.enter, color: "#FF9F45" }, // orange
  { html: "kn", text: kn.intro.enter, color: "#FF5FA2" }, // pink
] as const;

const TYPE_MS = 95;
const DELETE_MS = 55;
const HOLD_MS = 1400;
const GAP_MS = 280;

// Split into whole letters (grapheme clusters) so Indic conjuncts/vowel signs are typed and
// deleted as units instead of breaking mid-glyph.
function graphemes(s: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(s), (x) => x.segment);
  }
  return Array.from(s);
}

export default function IntroEnterButton({
  onEnter,
  label,
}: {
  onEnter: () => void;
  /** Static accessible label (page language). */
  label: string;
}) {
  const reduce = useReducedMotion();
  const letters = useMemo(() => WORDS.map((w) => graphemes(w.text)), []);
  const [idx, setIdx] = useState(0);
  const [n, setN] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // type → hold → backspace → next language → … forever
  useEffect(() => {
    if (reduce) return;
    const len = letters[idx].length;
    let t: ReturnType<typeof setTimeout>;
    if (!deleting) {
      t =
        n < len
          ? setTimeout(() => setN(n + 1), TYPE_MS)
          : setTimeout(() => setDeleting(true), HOLD_MS);
    } else if (n > 0) {
      t = setTimeout(() => setN(n - 1), DELETE_MS);
    } else {
      t = setTimeout(() => {
        setIdx((idx + 1) % WORDS.length);
        setDeleting(false);
      }, GAP_MS);
    }
    return () => clearTimeout(t);
  }, [idx, n, deleting, reduce, letters]);

  const word = reduce ? { html: "en", text: label, color: WORDS[0].color } : WORDS[idx];
  const shown = reduce ? label : letters[idx].slice(0, n).join("");
  const c = word.color;

  return (
    <motion.button
      type="button"
      autoFocus
      onClick={onEnter}
      aria-label={label}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      className="group relative inline-flex w-[268px] items-center justify-between gap-3 rounded-full border-2 py-3 pl-8 pr-3 backdrop-blur-xl transition-[border-color,box-shadow] duration-500 sm:w-[310px]"
      style={{
        background: "rgba(12,8,30,.55)",
        borderColor: c,
        boxShadow: `0 0 34px ${c}66, inset 0 0 20px ${c}26`,
      }}
    >
      {!reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border transition-colors duration-500"
          style={{ borderColor: c }}
          animate={{ scale: [1, 1.3], opacity: [0.7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {/* Typed word — decorative; the button's aria-label carries the real name */}
      <span
        aria-hidden
        lang={word.html}
        className="flex min-h-[34px] flex-1 items-center whitespace-nowrap text-left text-[22px] font-semibold leading-none transition-colors duration-500 sm:text-[24px]"
        style={{ color: c, textShadow: `0 0 18px ${c}99`, letterSpacing: "normal" }}
      >
        {shown}
        {!reduce && (
          <motion.span
            className="ml-1 inline-block h-[1.15em] w-[3px] rounded-sm"
            style={{ background: c }}
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
          />
        )}
      </span>

      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#140c24] transition-colors duration-500"
        style={{ background: c, boxShadow: `0 6px 18px ${c}80` }}
      >
        <ArrowRight
          size={20}
          strokeWidth={2.6}
          className="transition-transform duration-300 group-hover:translate-x-0.5"
        />
      </span>
    </motion.button>
  );
}
