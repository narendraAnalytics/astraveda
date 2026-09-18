"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlaceAutocomplete from "./PlaceAutocomplete";
import { RELATIONS, type GenerateBody, type Place, type Relation } from "@/lib/kundali";

const STEPS = ["For", "Born", "Where", "Review"] as const;

export default function BirthForm({
  userName,
  submitting,
  error,
  onSubmit,
  onExit,
}: {
  userName: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (body: GenerateBody) => void;
  // Called when Back is pressed on the very first step — leaves the form
  // entirely (goes to the previous page) since there's no earlier step to
  // return to.
  onExit?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [relation, setRelation] = useState<Relation>("Self");
  const [otherName, setOtherName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  // Computed post-mount only — computing "today" during render would give the
  // server and the client's hydration pass two different instants, which
  // React flags as a hydration mismatch on the `max` attribute below.
  const [maxDate, setMaxDate] = useState<string | undefined>(undefined);
  useEffect(() => setMaxDate(new Date().toISOString().slice(0, 10)), []);

  const canContinue =
    (step === 0 && (relation === "Self" || otherName.trim().length > 0)) ||
    (step === 1 && birthDate.length > 0 && (unknownTime || birthTime.length > 0)) ||
    (step === 2 && place !== null) ||
    step === 3;

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(next, STEPS.length - 1)));
  };
  const goNext = () => goTo(step + 1);
  const goBack = () => goTo(step - 1);

  const chartName = relation === "Self" ? userName : otherName.trim();

  const handleSubmit = () => {
    if (!place) return;
    onSubmit({
      name: chartName,
      relation,
      birth_date: birthDate,
      birth_time: unknownTime ? "12:00" : birthTime,
      unknown_time: unknownTime,
      birth_place: place.label,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
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
              <div className="space-y-6">
                <div>
                  <FieldLabel>Whose chart is this?</FieldLabel>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {RELATIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRelation(r)}
                        className={`h-11 rounded-[14px] text-[13px] font-medium border transition-all ${
                          relation === r
                            ? "bg-[linear-gradient(135deg,#D6336C,#FF5C8A)] border-transparent text-white shadow-[0_6px_16px_rgba(214,51,108,.28)]"
                            : "bg-white border-[#1B1730]/12 text-[#5B5570] hover:border-[#D6336C]/40 hover:text-[#1B1730]"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {relation === "Self" ? (
                  <p className="text-[13px] text-[#5B5570]">
                    Generating for{" "}
                    <span className="font-semibold text-[#1B1730]">{userName}</span>, the
                    account holder.
                  </p>
                ) : (
                  <div>
                    <FieldLabel>{relation}&apos;s name</FieldLabel>
                    <input
                      type="text"
                      value={otherName}
                      onChange={(e) => setOtherName(e.target.value)}
                      placeholder={`Your ${relation.toLowerCase()}'s full name`}
                      className={INPUT_CLASS}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <FieldLabel>Date of birth</FieldLabel>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={maxDate}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <FieldLabel>Time of birth</FieldLabel>
                  <input
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    disabled={unknownTime}
                    className={`${INPUT_CLASS} disabled:opacity-50`}
                  />
                  <label className="flex items-center gap-2 mt-3 text-[13px] text-[#5B5570] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={unknownTime}
                      onChange={(e) => setUnknownTime(e.target.checked)}
                      className="accent-[#D6336C] w-4 h-4"
                    />
                    I don&apos;t know the exact birth time
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <FieldLabel>Birthplace</FieldLabel>
                <PlaceAutocomplete value={place} onSelect={setPlace} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-[20px] border border-white/60 bg-white/55 backdrop-blur-xl shadow-[0_8px_32px_rgba(27,23,48,.08)] p-1.5">
                  <div className="rounded-[16px] bg-white/70 divide-y divide-[#1B1730]/6">
                    <ReviewRow label="Chart for" value={chartName} />
                    <ReviewRow
                      label="Born"
                      value={`${birthDate}${unknownTime ? " (time unknown)" : ` at ${birthTime}`}`}
                    />
                    <ReviewRow label="Place" value={place?.label ?? "—"} />
                  </div>
                </div>
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
            onClick={step > 0 ? goBack : onExit}
            disabled={submitting}
            className="px-5 py-3 rounded-[100px] text-[14px] font-medium text-[#5B5570] border border-[#1B1730]/14 hover:border-[#1B1730]/28 transition-colors disabled:opacity-50"
          >
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-white bg-[linear-gradient(135deg,#E8447A,#FF7A59)] shadow-[0_8px_22px_rgba(232,68,122,.35)] hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:shadow-none transition-all"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-white bg-[linear-gradient(135deg,#E8447A,#FF7A59)] shadow-[0_8px_22px_rgba(232,68,122,.35)] hover:brightness-105 active:brightness-95 disabled:opacity-60 disabled:shadow-none transition-all"
          >
            {submitting ? "Processing…" : "Continue to Pay · ₹15"}
          </button>
        )}
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#D6336C] focus:outline-none focus:ring-2 focus:ring-[#D6336C]/15";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">
      {children}
    </label>
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
                    ? "bg-[linear-gradient(135deg,#D6336C,#FF5C8A)] text-white"
                    : active
                      ? "bg-[linear-gradient(135deg,#D6336C,#FF5C8A)] text-white ring-4 ring-[#D6336C]/15"
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
              <span
                className={`text-[10.5px] font-medium transition-colors ${
                  active ? "text-[#1B1730]" : "text-[#8A8398]"
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-[2px] mx-1.5 -mt-4 rounded-full overflow-hidden bg-[#1B1730]/8">
                <div
                  className="h-full bg-[linear-gradient(90deg,#D6336C,#FF5C8A)] transition-all duration-500 ease-out"
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-[12.5px] text-[#5B5570]">{label}</span>
      <span className="text-[13.5px] font-medium text-[#1B1730] text-right">{value}</span>
    </div>
  );
}
