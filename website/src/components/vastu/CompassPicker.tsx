"use client";

import { Compass } from "lucide-react";
import type { Direction } from "@/lib/vastu";

// A 3×3 compass grid — N/NE/E/… around a centre "Not sure" tile. Pure CSS grid
// (no trig), so it can't hydration-mismatch, and every direction is a big,
// obvious tap target. `highlight` mode (read-only) is reused on the result hero.
const CELLS: { key: Direction; label: string; arrow: string }[] = [
  { key: "NW", label: "NW", arrow: "↖" },
  { key: "N", label: "N", arrow: "↑" },
  { key: "NE", label: "NE", arrow: "↗" },
  { key: "W", label: "W", arrow: "←" },
  { key: "Unknown", label: "Not sure", arrow: "" },
  { key: "E", label: "E", arrow: "→" },
  { key: "SW", label: "SW", arrow: "↙" },
  { key: "S", label: "S", arrow: "↓" },
  { key: "SE", label: "SE", arrow: "↘" },
];

export default function CompassPicker({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: Direction;
  onChange?: (d: Direction) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const small = size === "sm";
  return (
    <div
      className={`grid grid-cols-3 ${small ? "gap-1 w-[112px]" : "gap-2 w-full max-w-[280px]"} mx-auto`}
      role={readOnly ? "img" : "radiogroup"}
      aria-label="Facing direction"
    >
      {CELLS.map((c) => {
        const on = value === c.key;
        const centre = c.key === "Unknown";
        return (
          <button
            key={c.key}
            type="button"
            disabled={readOnly}
            role={readOnly ? undefined : "radio"}
            aria-checked={readOnly ? undefined : on}
            onClick={() => onChange?.(c.key)}
            className={`flex flex-col items-center justify-center rounded-[14px] border font-bold transition-all ${
              small ? "h-9 text-[10px] rounded-[9px]" : "aspect-square text-[13px]"
            } ${
              on
                ? "border-transparent text-white shadow-[0_8px_20px_rgba(194,87,31,.35)]"
                : centre
                  ? "border-dashed border-[#c2571f]/35 bg-[#fbeee2]/60 text-[#a4622f]"
                  : "bg-white border-[#4a2f20]/12 text-[#7a5a45] hover:border-[#c2571f]/50 hover:bg-[#fff7ef]"
            } ${readOnly ? "cursor-default" : ""}`}
            style={on ? { background: "linear-gradient(135deg,#7a2e0e,#c2571f,#e0932f)" } : undefined}
          >
            {centre ? (
              <>
                <Compass size={small ? 12 : 18} />
                {!small && <span className="text-[10px] font-semibold mt-0.5">Not sure</span>}
              </>
            ) : (
              <>
                <span className={small ? "text-[11px] leading-none" : "text-[18px] leading-none"}>{c.arrow}</span>
                <span className={small ? "hidden" : "mt-0.5"}>{c.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
