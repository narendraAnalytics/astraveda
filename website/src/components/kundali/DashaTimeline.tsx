import type { Chart } from "@/lib/kundali";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function DashaTimeline({ chart }: { chart: Chart }) {
  const { current, mahadasha, antardasha } = chart.vimshottari;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12px] text-[#5B5570]">Currently running</span>
        <span className="text-[13px] font-semibold text-white px-3 py-1 rounded-full bg-[linear-gradient(90deg,#8F29DD,#A72BE6)]">
          {current.mahadasha ?? "—"} {current.antardasha ? `/ ${current.antardasha}` : ""}
        </span>
      </div>

      <div className="space-y-2 mb-6">
        {mahadasha.map((p) => {
          const isCurrent = p.lord === current.mahadasha;
          return (
            <div
              key={`${p.lord}-${p.start}`}
              className={`flex items-center justify-between rounded-[12px] px-4 py-2.5 text-[13px] ${
                isCurrent
                  ? "bg-[#8F29DD]/10 border border-[#8F29DD]/30 font-semibold text-[#1B1730]"
                  : "bg-[#FFFAF2] border border-[#1B1730]/8 text-[#5B5570]"
              }`}
            >
              <span>{p.lord} Mahadasha</span>
              <span>{formatDate(p.start)} – {formatDate(p.end)}</span>
            </div>
          );
        })}
      </div>

      {antardasha.length > 0 && (
        <>
          <div className="text-[12px] text-[#5B5570] mb-2">
            Antardasha within {current.mahadasha}
          </div>
          <div className="space-y-2">
            {antardasha.map((p) => {
              const isCurrent = p.lord === current.antardasha;
              return (
                <div
                  key={`${p.lord}-${p.start}`}
                  className={`flex items-center justify-between rounded-[10px] px-3.5 py-2 text-[12.5px] ${
                    isCurrent
                      ? "bg-[#F4D28A]/25 border border-[#C18426]/30 font-semibold text-[#1B1730]"
                      : "bg-white border border-[#1B1730]/8 text-[#5B5570]"
                  }`}
                >
                  <span>{p.lord}</span>
                  <span>{formatDate(p.start)} – {formatDate(p.end)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
