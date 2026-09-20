"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import type { DreamSummary } from "@/lib/dream";

const INDIGO: [string, string] = ["#4f46e5", "#6d28d9"];

const prettyDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

// Shared by the dream journal and the /readings hub's "Dreams" segment —
// a soft indigo mesh-gradient card, moon avatar, title + feeling line, and
// the dream's symbols as small chips.
export default function DreamCard({
  item,
  deleting,
  onOpen,
  onDelete,
}: {
  item: DreamSummary;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [a, a2] = INDIGO;
  return (
    <div
      className="rounded-[20px] p-5 group relative border transition-all hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(79,70,229,.22)]"
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
        aria-label={`Delete “${item.title}”`}
        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8A8398] opacity-0 group-hover:opacity-100 hover:bg-white hover:text-[#C0392B] transition-all disabled:opacity-50 z-10"
      >
        <Trash2 size={15} />
      </button>

      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-[19px] flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${a}, ${a2})`, boxShadow: `0 6px 16px ${a}50` }}
          >
            🌙
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-[14.5px] font-semibold text-[#1B1730] line-clamp-2 leading-snug">{item.title}</p>
            <p className="text-[11.5px] text-[#8A8398] mt-0.5 truncate">
              {item.name}
              {item.relation ? ` · ${item.relation}` : ""} · {prettyDate(item.created_at)}
            </p>
          </div>
          <ChevronRight size={17} className="text-[#C7AD97] flex-shrink-0" />
        </div>

        {item.feeling && <p className="text-[12.5px] leading-[1.55] text-[#5B5570] mt-3.5 line-clamp-2 italic">{item.feeling}</p>}

        {item.symbols.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3.5">
            {item.symbols.slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-[10.5px] font-bold rounded-[8px] px-2 py-1 capitalize"
                style={{ background: `${a}0f`, border: `1px solid ${a}22`, color: a }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
