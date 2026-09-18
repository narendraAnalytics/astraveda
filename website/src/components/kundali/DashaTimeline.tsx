"use client";

import { useMemo } from "react";
import type { Chart, DashaPeriod } from "@/lib/kundali";

// Traditional graha colour associations — grounds the palette in the subject
// matter rather than an arbitrary categorical scheme.
const PLANET_COLOR: Record<string, string> = {
  Sun: "#E9A23B",
  Moon: "#E8A9C0",
  Mars: "#D0473E",
  Mercury: "#4FAE7A",
  Jupiter: "#D9A62E",
  Venus: "#E37FB0",
  Saturn: "#6E5A72",
  Rahu: "#7C5CBF",
  Ketu: "#8C5A3C",
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function timeLeft(endIso: string) {
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return "ending";
  const days = ms / 86_400_000;
  const years = Math.floor(days / 365.25);
  const months = Math.round((days - years * 365.25) / 30.44);
  if (years > 0) return `${years}y ${months}m left`;
  return `${Math.max(months, 1)}m left`;
}

function pctThrough(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return ((now - s) / (e - s)) * 100;
}

export default function DashaTimeline({ chart }: { chart: Chart }) {
  const { current, mahadasha, antardasha } = chart.vimshottari;

  const segments = useMemo(() => {
    if (mahadasha.length === 0) return [];
    const rangeStart = new Date(mahadasha[0].start).getTime();
    const rangeEnd = new Date(mahadasha[mahadasha.length - 1].end).getTime();
    const total = rangeEnd - rangeStart || 1;
    return mahadasha.map((p) => ({
      ...p,
      widthPct: ((new Date(p.end).getTime() - new Date(p.start).getTime()) / total) * 100,
    }));
  }, [mahadasha]);

  const nowPct = useMemo(() => {
    if (mahadasha.length === 0) return 0;
    return pctThrough(mahadasha[0].start, mahadasha[mahadasha.length - 1].end);
  }, [mahadasha]);

  const currentMaha = mahadasha.find((p) => p.lord === current.mahadasha);
  const currentPct = currentMaha ? pctThrough(currentMaha.start, currentMaha.end) : 0;

  return (
    <div>
      {/* Life timeline — proportional bar across the full Vimshottari cycle */}
      <div className="relative mb-2">
        <div className="flex h-3 rounded-full overflow-hidden">
          {segments.map((p) => (
            <div
              key={`${p.lord}-${p.start}`}
              style={{ width: `${p.widthPct}%`, background: PLANET_COLOR[p.lord] ?? "#D6336C" }}
              className={p.lord === current.mahadasha ? "opacity-100" : "opacity-55"}
              title={`${p.lord} · ${fmt(p.start)} – ${fmt(p.end)}`}
            />
          ))}
        </div>
        <div
          className="absolute -top-1.5 flex flex-col items-center -translate-x-1/2"
          style={{ left: `${nowPct}%` }}
        >
          <span className="w-[2px] h-[18px] bg-[#1B1730]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-7">
        {mahadasha.map((p) => (
          <span key={p.lord} className="inline-flex items-center gap-1.5 text-[11px] text-[#5B5570]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: PLANET_COLOR[p.lord] ?? "#D6336C" }}
            />
            {p.lord}
          </span>
        ))}
      </div>

      {/* Current period spotlight */}
      <div className="rounded-[18px] bg-[linear-gradient(135deg,#D6336C0F,#FF5C8A10)] border border-[#D6336C]/18 p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] text-[#5B5570] mb-1">Currently running</div>
            <div className="text-[19px] font-semibold text-[#1B1730]">
              {current.mahadasha ?? "—"} Mahadasha
              {current.antardasha ? (
                <span className="text-[#D6336C]"> / {current.antardasha}</span>
              ) : null}
            </div>
            {currentMaha && (
              <div className="text-[12.5px] text-[#5B5570] mt-1">
                {fmt(currentMaha.start)} – {fmt(currentMaha.end)} · {timeLeft(currentMaha.end)}
              </div>
            )}
          </div>
          {currentMaha && (
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="#D6336C1A" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  fill="none"
                  stroke={PLANET_COLOR[current.mahadasha ?? ""] ?? "#D6336C"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(currentPct / 100) * 2 * Math.PI * 27} ${2 * Math.PI * 27}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-[#1B1730]">
                {Math.round(currentPct)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Antardasha sub-periods — a grid, not a long scroll */}
      {antardasha.length > 0 && (
        <>
          <div className="text-[12px] text-[#5B5570] mb-2.5">
            Antardasha within {current.mahadasha}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {antardasha.map((p: DashaPeriod) => {
              const isCurrent = p.lord === current.antardasha;
              return (
                <div
                  key={`${p.lord}-${p.start}`}
                  className={`rounded-[12px] px-3 py-2.5 text-[12.5px] ${
                    isCurrent
                      ? "bg-[linear-gradient(135deg,#D6336C,#FF5C8A)] text-white font-semibold"
                      : "bg-white border border-[#1B1730]/8 text-[#5B5570]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isCurrent ? "#fff" : PLANET_COLOR[p.lord] ?? "#D6336C" }}
                    />
                    {p.lord}
                  </div>
                  <div className={isCurrent ? "text-white/80" : "text-[#8A8398]"}>
                    {fmt(p.start)} – {fmt(p.end)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
