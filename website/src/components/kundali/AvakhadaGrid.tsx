import type { Chart } from "@/lib/kundali";

export default function AvakhadaGrid({ chart }: { chart: Chart }) {
  const a = chart.avakhada;
  const rows: [string, string][] = [
    ["Varna", a.varna],
    ["Rashi", a.rashi],
    ["Rashi Lord", a.rashi_lord],
    ["Nakshatra", `${a.nakshatra} · Pada ${a.nakshatra_pada}`],
    ["Nakshatra Lord", a.nakshatra_lord],
    ["Tithi", a.tithi],
    ["Sun Sign", a.sun_sign],
    ["Moon Sign", a.moon_sign],
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[14px] border border-[#8F29DD]/15 bg-[#8F29DD]/[.04] px-3.5 py-3"
        >
          <div className="text-[11px] text-[#5B5570]">{label}</div>
          <div className="text-[13.5px] font-semibold text-[#1B1730] mt-0.5">{value}</div>
        </div>
      ))}
    </div>
  );
}
