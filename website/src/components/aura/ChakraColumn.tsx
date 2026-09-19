import { CHAKRAS } from "@/lib/aura";

// The seven chakras, root → crown. State is parsed loosely from the Sarvam
// reading text (open / tender / over-active) — decorative, the words in the
// reading are the source of truth. Ported from the mobile app's
// chakra-column.tsx.
type State = "open" | "tender" | "active" | "neutral";

const STATE_LABEL: Record<State, string> = {
  open: "Open",
  tender: "Tender",
  active: "Over-active",
  neutral: "—",
};

export function chakraStatesFromReading(text: string): Record<string, State> {
  const out: Record<string, State> = {};
  const lower = text.toLowerCase();
  for (const ch of CHAKRAS) {
    const name = ch.label.toLowerCase();
    const idx = lower.indexOf(name);
    if (idx === -1) {
      out[ch.key] = "neutral";
      continue;
    }
    const window = lower.slice(idx, idx + 90);
    if (/over-?active|overactive|excess|too much|racing/.test(window)) out[ch.key] = "active";
    else if (/tender|blocked|closed|guarded|weak|quiet|dim|needs/.test(window)) out[ch.key] = "tender";
    else if (/open|balanced|strong|bright|flowing|clear/.test(window)) out[ch.key] = "open";
    else out[ch.key] = "neutral";
  }
  return out;
}

export default function ChakraColumn({ states }: { states: Record<string, State> }) {
  return (
    <div className="flex flex-col gap-2.5">
      {[...CHAKRAS].reverse().map((ch) => {
        const st = states[ch.key] ?? "neutral";
        const neutral = st === "neutral";
        return (
          <div key={ch.key} className="flex items-center gap-3">
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: ch.hex, opacity: neutral ? 0.35 : 1 }}
            />
            <span className="flex-1 text-[13px] font-bold text-[#3a2f4a]">{ch.label}</span>
            <span
              className="text-[10px] font-extrabold tracking-[.02em] rounded-[8px] px-2 py-0.5"
              style={{
                background: neutral ? "#f0eef4" : "#efe9fe",
                color: neutral ? "#9a92a8" : "#7c3aed",
              }}
            >
              {STATE_LABEL[st]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
