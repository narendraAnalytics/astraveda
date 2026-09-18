"use client";

// A row/grid of selectable chips — single or multi-select. Used across every
// step of the guided palm form (hand shape, lines, mounts, marks).
export type Option = { value: string; label: string; hint?: string; glyph?: string };

export default function OptionGroup({
  options,
  value,
  onChange,
  columns = 2,
  multi = false,
  max,
}: {
  options: Option[];
  value: string | string[] | null;
  onChange: (v: string | string[]) => void;
  columns?: number;
  multi?: boolean;
  max?: number;
}) {
  const selected = multi ? ((value as string[]) ?? []) : value;

  const toggle = (v: string) => {
    if (!multi) {
      onChange(v);
      return;
    }
    const arr = (selected as string[]) ?? [];
    if (arr.includes(v)) {
      onChange(arr.filter((x) => x !== v));
    } else if (!max || arr.length < max) {
      onChange([...arr, v]);
    }
  };

  const isOn = (v: string) => (multi ? (selected as string[]).includes(v) : selected === v);

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const on = isOn(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`text-left rounded-[14px] border px-3.5 py-2.5 transition-all ${
              on
                ? "bg-[linear-gradient(135deg,#7A1F5C,#C0356F,#E2745A)] border-transparent text-white shadow-[0_6px_16px_rgba(192,53,111,.3)]"
                : "bg-white border-[#1B1730]/12 text-[#5B5570] hover:border-[#C0356F]/40 hover:text-[#1B1730]"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              {opt.glyph && <span aria-hidden>{opt.glyph}</span>}
              {opt.label}
            </span>
            {opt.hint && (
              <span
                className={`block text-[10.5px] mt-0.5 leading-[1.4] ${
                  on ? "text-white/85" : "text-[#8A8398]"
                }`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
