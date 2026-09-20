"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { directionLabel, scoreBand, type VastuSummary } from "@/lib/vastu";

const ACCENT: [string, string] = ["#c2571f", "#e0932f"];

// Shared by /vastu/spaces and the /readings hub's "Spaces" segment: a soft
// terracotta mesh-gradient card with a mini score ring, room + facing chips.
export default function SpaceCard({
  item,
  deleting,
  onOpen,
  onDelete,
}: {
  item: VastuSummary;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [a, a2] = ACCENT;
  const band = scoreBand(item.score);
  const C = 2 * Math.PI * 18;

  return (
    <div
      className="rounded-[20px] p-5 group relative border transition-all hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(194,87,31,.22)]"
      style={{
        background: `linear-gradient(160deg, ${a}14 0%, ${a2}0a 50%, #FFFFFF 100%)`,
        borderColor: `${a}28`,
        boxShadow: `0 4px 18px ${a}14`,
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label={`Delete ${item.label}`}
        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8A8398] opacity-0 group-hover:opacity-100 hover:bg-white hover:text-[#C0392B] transition-all disabled:opacity-50 z-10"
      >
        <Trash2 size={15} />
      </button>

      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-3.5">
          <div className="relative w-[46px] h-[46px] flex-shrink-0">
            <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
              <circle cx="23" cy="23" r="18" fill="none" stroke="#efe3d3" strokeWidth="5" />
              <circle
                cx="23"
                cy="23"
                r="18"
                fill="none"
                stroke={band.color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={Math.round(C * 100) / 100}
                strokeDashoffset={Math.round(C * (1 - item.score / 100) * 100) / 100}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-black" style={{ color: band.color }}>
              {Math.round(item.score)}
            </span>
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-[14.5px] font-semibold text-[#1B1730] truncate">{item.label}</p>
            <p className="text-[11.5px] text-[#8A8398] mt-0.5 truncate">
              {item.room_type} · faces {directionLabel(item.direction)}
            </p>
          </div>
          <ChevronRight size={17} className="text-[#C7AD97] flex-shrink-0" />
        </div>

        {item.verdict && <p className="text-[12.5px] leading-[1.55] text-[#5B5570] mt-3.5 line-clamp-2">{item.verdict}</p>}

        <div className="flex flex-wrap gap-1.5 mt-3.5">
          <span
            className="text-[10.5px] font-bold rounded-[8px] px-2 py-1 text-white"
            style={{ background: band.color }}
          >
            {band.label}
          </span>
          <span
            className="text-[10.5px] font-bold rounded-[8px] px-2 py-1"
            style={{ background: `${a}0f`, border: `1px solid ${a}22`, color: a }}
          >
            {item.dosha_count === 0 ? "No doshas" : `${item.dosha_count} dosha${item.dosha_count === 1 ? "" : "s"}`}
          </span>
        </div>
      </button>
    </div>
  );
}
