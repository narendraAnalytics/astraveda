"use client";

import { useEffect, useState } from "react";
import PlaceAutocomplete from "./PlaceAutocomplete";
import { RELATIONS, type GenerateBody, type Place, type Relation } from "@/lib/kundali";

const STEPS = ["Who", "Born", "Where", "Review"] as const;

export default function BirthForm({
  defaultName,
  submitting,
  error,
  onSubmit,
}: {
  defaultName: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (body: GenerateBody) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [relation, setRelation] = useState<Relation>("Self");
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
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && birthDate.length > 0 && (unknownTime || birthTime.length > 0)) ||
    (step === 2 && place !== null) ||
    step === 3;

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    if (!place) return;
    onSubmit({
      name: name.trim(),
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
      <div className="flex gap-1.5 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-[3px] rounded-full transition-colors duration-300 ${
                i <= step ? "bg-[linear-gradient(90deg,#F7DDA2,#E9BE6C)]" : "bg-[#1B1730]/10"
              }`}
            />
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#8F29DD] focus:outline-none focus:ring-2 focus:ring-[#8F29DD]/15"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">
              Whose chart is this?
            </label>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRelation(r)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    relation === r
                      ? "bg-[#8F29DD] border-[#8F29DD] text-white"
                      : "bg-white border-[#1B1730]/14 text-[#5B5570] hover:border-[#8F29DD]/40"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">
              Date of birth
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={maxDate}
              className="w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#8F29DD] focus:outline-none focus:ring-2 focus:ring-[#8F29DD]/15"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">
              Time of birth
            </label>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              disabled={unknownTime}
              className="w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#8F29DD] focus:outline-none focus:ring-2 focus:ring-[#8F29DD]/15 disabled:opacity-50"
            />
            <label className="flex items-center gap-2 mt-2.5 text-[13px] text-[#5B5570]">
              <input
                type="checkbox"
                checked={unknownTime}
                onChange={(e) => setUnknownTime(e.target.checked)}
                className="accent-[#8F29DD]"
              />
              I don&apos;t know my exact birth time
            </label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <label className="block text-[12.5px] font-semibold text-[#1B1730] mb-2">
            Birthplace
          </label>
          <PlaceAutocomplete value={place} onSelect={setPlace} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <ReviewRow label="Name" value={name} />
          <ReviewRow label="For" value={relation} />
          <ReviewRow label="Born" value={`${birthDate}${unknownTime ? "" : ` at ${birthTime}`}${unknownTime ? " (time unknown)" : ""}`} />
          <ReviewRow label="Place" value={place?.label ?? "—"} />
          {error && (
            <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[10px] px-3.5 py-2.5">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mt-8">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="px-5 py-3 rounded-[100px] text-[14px] font-medium text-[#5B5570] border border-[#1B1730]/14 disabled:opacity-50"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-[#241505] bg-[linear-gradient(180deg,#F7DDA2,#E9BE6C)] disabled:opacity-40 transition-opacity"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-12 rounded-[100px] font-semibold text-[14.5px] text-[#241505] bg-[linear-gradient(180deg,#F7DDA2,#E9BE6C)] disabled:opacity-60 transition-opacity"
          >
            {submitting ? "Processing…" : "Pay ₹15 & Generate"}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[10px] bg-[#FFFAF2] border border-[#1B1730]/8 px-4 py-3">
      <span className="text-[12.5px] text-[#5B5570]">{label}</span>
      <span className="text-[13.5px] font-medium text-[#1B1730]">{value}</span>
    </div>
  );
}
