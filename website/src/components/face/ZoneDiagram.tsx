"use client";

// The three Trikala zones of Mukha Samudrika: upper (forehead → brow) = early
// life & intellect, middle (brow → nose tip) = middle life & drive, lower
// (nose tip → chin) = later life & willpower. Ported from the mobile app's
// zone-diagram.tsx as plain SVG (no react-native-svg here).
const ZONES = [
  { key: "upper", label: "Upper · early life", color: "#0f8a7e" },
  { key: "middle", label: "Middle · middle life", color: "#3fa66b" },
  { key: "lower", label: "Lower · later life", color: "#c18426" },
];

export default function ZoneDiagram({ size = 200 }: { size?: number }) {
  const w = size;
  const h = size * 1.15;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.36;
  const ry = h * 0.44;
  const y1 = cy - ry + (2 * ry) / 3;
  const y2 = cy - ry + (4 * ry) / 3;
  const clipId = "faceClip";

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h}>
        <defs>
          <clipPath id={clipId}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x={0} y={0} width={w} height={y1} fill={`${ZONES[0].color}22`} />
          <rect x={0} y={y1} width={w} height={y2 - y1} fill={`${ZONES[1].color}22`} />
          <rect x={0} y={y2} width={w} height={h - y2} fill={`${ZONES[2].color}22`} />
        </g>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="#8a6f5f" strokeWidth={1.5} fill="none" />
        <line x1={cx - rx} y1={y1} x2={cx + rx} y2={y1} stroke="#8a6f5f" strokeWidth={1} strokeDasharray="3 4" />
        <line x1={cx - rx} y1={y2} x2={cx + rx} y2={y2} stroke="#8a6f5f" strokeWidth={1} strokeDasharray="3 4" />
      </svg>
      <div className="mt-3 flex flex-col gap-1.5 self-stretch">
        {ZONES.map((z) => (
          <div key={z.key} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
            <span className="text-[12px] font-semibold text-[#41706a]">{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
