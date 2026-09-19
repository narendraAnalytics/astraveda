"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import OptionGroup, { type Option } from "@/components/palm/OptionGroup";
import { FACE_SHAPES, type FaceShape } from "@/lib/face";

const STEPS = ["Face shape", "Forehead", "Chin & jaw"] as const;

const SHAPE_OPTIONS: Option[] = FACE_SHAPES.map((s) => ({ value: s, label: s }));
const FOREHEAD_OPTIONS: Option[] = [
  { value: "Broad and high", label: "Broad & high" },
  { value: "Narrow", label: "Narrow" },
  { value: "Rounded", label: "Rounded" },
  { value: "Sloping back", label: "Sloping back" },
  { value: "Not sure", label: "Not sure" },
];
const CHIN_OPTIONS: Option[] = [
  { value: "Firm and rounded", label: "Firm & rounded" },
  { value: "Pointed", label: "Pointed" },
  { value: "Square, strong jaw", label: "Square, strong jaw" },
  { value: "Soft, receding", label: "Soft, receding" },
  { value: "Not sure", label: "Not sure" },
];

export type GuidedAnswers = {
  face_shape: FaceShape;
  forehead: string | null;
  chin_jaw: string | null;
};

const GRADIENT = "linear-gradient(135deg,#0c5f57,#0f8a7e,#3fa66b)";

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
  const [faceShape, setFaceShape] = useState<FaceShape | null>(null);
  const [forehead, setForehead] = useState<string | null>(null);
  const [chin, setChin] = useState<string | null>(null);

  const canContinue = useMemo(() => {
    if (step === 0) return !!faceShape;
    return true;
  }, [step, faceShape]);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(next, STEPS.length - 1)));
  };

  const handleSubmit = () => {
    if (!faceShape) return;
    onSubmit({
      face_shape: faceShape,
      forehead: forehead && forehead !== "Not sure" ? forehead : null,
      chin_jaw: chin && chin !== "Not sure" ? chin : null,
    });
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
                <p className="text-[13px] text-[#5B5570]">
                  Look in a mirror and pick what best matches.
                </p>
                <Field label="Face shape">
                  <OptionGroup options={SHAPE_OPTIONS} value={faceShape} onChange={(v) => setFaceShape(v as FaceShape)} />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Field label="Forehead">
                  <OptionGroup options={FOREHEAD_OPTIONS} value={forehead} onChange={(v) => setForehead(v as string)} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <Field label="Chin & jaw">
                  <OptionGroup options={CHIN_OPTIONS} value={chin} onChange={(v) => setChin(v as string)} />
                </Field>
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
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(15,138,126,.32)] hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:shadow-none transition-all"
            style={{ background: GRADIENT }}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-white shadow-[0_8px_22px_rgba(15,138,126,.32)] hover:brightness-105 active:brightness-95 disabled:opacity-60 disabled:shadow-none transition-all"
            style={{ background: GRADIENT }}
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
                  done || active
                    ? "text-white"
                    : "bg-[#1B1730]/8 text-[#8A8398]"
                }`}
                style={done || active ? { background: GRADIENT, boxShadow: active ? "0 0 0 4px rgba(15,138,126,.15)" : undefined } : undefined}
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
                  className="h-full transition-all duration-500 ease-out"
                  style={{ width: done ? "100%" : "0%", background: "linear-gradient(90deg,#0c5f57,#3fa66b)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
