"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import OptionGroup, { type Option } from "./OptionGroup";
import {
  FINGER_LENGTHS,
  LINE_KEYS,
  LINE_OPTIONS,
  MARKS,
  MOUNTS,
  MOUNT_RULER,
  THUMB_FLEX,
  type HandShape,
  type LineKey,
  type Mount,
} from "@/lib/palm";

const STEPS = ["Your hand", "The major lines", "The mounts", "Marks"] as const;

const SHAPE_OPTIONS: Option[] = [
  { value: "Earth", label: "Earth", hint: "Square palm, short fingers · grounded, practical", glyph: "⛰️" },
  { value: "Air", label: "Air", hint: "Square palm, long fingers · curious, communicative", glyph: "🌬️" },
  { value: "Fire", label: "Fire", hint: "Long palm, short fingers · driven, expressive", glyph: "🔥" },
  { value: "Water", label: "Water", hint: "Long palm, long fingers · sensitive, intuitive", glyph: "💧" },
];
const FINGER_OPTIONS: Option[] = FINGER_LENGTHS.map((v) => ({ value: v, label: v }));
const THUMB_OPTIONS: Option[] = THUMB_FLEX.map((v) => ({
  value: v,
  label: v,
  hint: v === "Firm" ? "Barely bends back" : v === "Flexible" ? "Bends back easily" : "A little give",
}));
const MOUNT_OPTIONS: Option[] = MOUNTS.map((m) => ({ value: m, label: `${m} (${MOUNT_RULER[m]})` }));
const MARK_OPTIONS: Option[] = MARKS.map((m) => ({ value: m, label: m }));

const LINE_LABEL: Record<LineKey, string> = {
  heart: "Heart line · Hridaya",
  head: "Head line · Mastaka",
  life: "Life line · Jeevana",
  fate: "Fate line · Bhagya",
};

export type GuidedAnswers = {
  hand_shape: HandShape;
  finger_length: string | null;
  thumb_flex: string | null;
  lines: Partial<Record<LineKey, string>>;
  mounts: Mount[];
  marks: string[];
};

export default function GuidedForm({
  submitting,
  error,
  onSubmit,
  onExit,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: (answers: GuidedAnswers) => void;
  onExit?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [handShape, setHandShape] = useState<HandShape | null>(null);
  const [fingerLength, setFingerLength] = useState<string | null>(null);
  const [thumbFlex, setThumbFlex] = useState<string | null>(null);
  const [lines, setLines] = useState<Partial<Record<LineKey, string>>>({});
  const [mounts, setMounts] = useState<Mount[]>([]);
  const [marks, setMarks] = useState<string[]>([]);

  const canContinue = useMemo(() => {
    if (step === 0) return !!handShape;
    return true;
  }, [step, handShape]);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(next, STEPS.length - 1)));
  };

  const handleSubmit = () => {
    if (!handShape) return;
    onSubmit({ hand_shape: handShape, finger_length: fingerLength, thumb_flex: thumbFlex, lines, mounts, marks });
  };

  return (
    <div>
      <StepIndicator step={step} onJump={(i) => i < step && goTo(i)} />

      <div className="relative overflow-x-hidden overflow-y-visible">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {step === 0 && (
              <div className="space-y-5">
                <Field label="Hand shape">
                  <OptionGroup options={SHAPE_OPTIONS} value={handShape} onChange={(v) => setHandShape(v as HandShape)} />
                </Field>
                <Field label="Finger length (vs palm)">
                  <OptionGroup options={FINGER_OPTIONS} value={fingerLength} onChange={(v) => setFingerLength(v as string)} columns={3} />
                </Field>
                <Field label="Thumb">
                  <OptionGroup options={THUMB_OPTIONS} value={thumbFlex} onChange={(v) => setThumbFlex(v as string)} />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <p className="text-[13px] text-[#5B5570]">
                  Look at your dominant palm. Pick what best matches — or &ldquo;Not sure&rdquo;, and the
                  reading will speak to it gently.
                </p>
                {LINE_KEYS.map((k) => (
                  <Field key={k} label={LINE_LABEL[k]}>
                    <OptionGroup
                      options={LINE_OPTIONS[k].map((o) => ({ value: o, label: o }))}
                      value={lines[k] ?? null}
                      onChange={(v) => setLines((prev) => ({ ...prev, [k]: v as string }))}
                    />
                  </Field>
                ))}
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-[13px] text-[#5B5570] mb-4">
                  Which one or two areas of your palm look fullest or most raised? Each mount
                  carries a Vedic planet. You can also skip this.
                </p>
                <OptionGroup options={MOUNT_OPTIONS} value={mounts} onChange={(v) => setMounts(v as Mount[])} multi max={2} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-[13px] text-[#5B5570]">
                  Any auspicious marks you notice (optional) — a fish, star, triangle, or trident
                  shape formed by the lines.
                </p>
                <OptionGroup options={MARK_OPTIONS} value={marks} onChange={(v) => setMarks(v as string[])} multi columns={2} />
                {error && (
                  <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5">
                    {error}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 mt-8">
        {(step > 0 || onExit) && (
          <button
            type="button"
            onClick={() => (step > 0 ? goTo(step - 1) : onExit?.())}
            disabled={submitting}
            className="px-5 py-3 rounded-[100px] text-[14px] font-medium text-[#5B5570] border border-[#1B1730]/14 hover:border-[#1B1730]/28 transition-colors disabled:opacity-50"
          >
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            disabled={!canContinue}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-white bg-[linear-gradient(135deg,#7A1F5C,#C0356F,#E2745A)] shadow-[0_8px_22px_rgba(192,53,111,.32)] hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:shadow-none transition-all"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-white bg-[linear-gradient(135deg,#7A1F5C,#C0356F,#E2745A)] shadow-[0_8px_22px_rgba(192,53,111,.32)] hover:brightness-105 active:brightness-95 disabled:opacity-60 disabled:shadow-none transition-all"
          >
            {submitting ? "Processing…" : "Reveal my reading"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">{label}</label>
      {children}
    </div>
  );
}

function StepIndicator({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={i >= step}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-300 ${
                  done
                    ? "bg-[linear-gradient(135deg,#7A1F5C,#C0356F,#E2745A)] text-white"
                    : active
                      ? "bg-[linear-gradient(135deg,#7A1F5C,#C0356F,#E2745A)] text-white ring-4 ring-[#C0356F]/15"
                      : "bg-[#1B1730]/8 text-[#8A8398]"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 12 10" className="w-3 h-2.5" fill="none">
                    <path d="M1 5L4.3 8.3L11 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[10.5px] font-medium transition-colors ${active ? "text-[#1B1730]" : "text-[#8A8398]"}`}>
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-[2px] mx-1.5 -mt-4 rounded-full overflow-hidden bg-[#1B1730]/8">
                <div
                  className="h-full bg-[linear-gradient(90deg,#7A1F5C,#E2745A)] transition-all duration-500 ease-out"
                  style={{ width: done ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
