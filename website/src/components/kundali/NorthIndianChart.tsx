import type { House, Planet } from "@/lib/kundali";

// Classic North Indian (diamond) Kundli chart, drawn as plain SVG in a
// 400x400 box: outer square + both diagonals + the midpoint-diamond together
// partition the square into exactly 12 regions — 4 "kite" quadrilaterals
// (houses 1/4/7/10, the angular houses) and 8 triangles (2 per corner).
// House 1 is always the top kite; houses run clockwise from there.
type Point = [number, number];

const C = { x: 200, y: 200 };
const M: Record<"top" | "right" | "bottom" | "left", Point> = {
  top: [200, 0], right: [400, 200], bottom: [200, 400], left: [0, 200],
};
const X: Record<"tr" | "br" | "bl" | "tl", Point> = {
  tr: [300, 100], br: [300, 300], bl: [100, 300], tl: [100, 100],
};
const CORNER: Record<"tl" | "tr" | "br" | "bl", Point> = {
  tl: [0, 0], tr: [400, 0], br: [400, 400], bl: [0, 400],
};

const HOUSE_SHAPES: { points: Point[]; label: Point; rashiAnchor: Point }[] = [
  { points: [M.top, X.tr, [C.x, C.y], X.tl], label: [200, 60], rashiAnchor: [200, 22] },
  { points: [CORNER.tr, M.top, X.tr], label: [275, 30], rashiAnchor: [355, 16] },
  { points: [CORNER.tr, X.tr, M.right], label: [352, 105], rashiAnchor: [355, 30] },
  { points: [M.right, X.br, [C.x, C.y], X.tr], label: [340, 200], rashiAnchor: [378, 200] },
  { points: [CORNER.br, M.right, X.br], label: [352, 295], rashiAnchor: [355, 370] },
  { points: [CORNER.br, X.br, M.bottom], label: [275, 370], rashiAnchor: [355, 384] },
  { points: [M.bottom, X.br, [C.x, C.y], X.bl], label: [200, 340], rashiAnchor: [200, 378] },
  { points: [CORNER.bl, M.bottom, X.bl], label: [125, 370], rashiAnchor: [45, 384] },
  { points: [CORNER.bl, X.bl, M.left], label: [48, 295], rashiAnchor: [45, 370] },
  { points: [M.left, X.bl, [C.x, C.y], X.tl], label: [60, 200], rashiAnchor: [22, 200] },
  { points: [CORNER.tl, X.tl, M.left], label: [48, 105], rashiAnchor: [45, 30] },
  { points: [CORNER.tl, M.top, X.tl], label: [125, 30], rashiAnchor: [45, 16] },
];

const GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃",
  Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};

const CORNER_ORNAMENT: Point[] = [[10, 10], [390, 10], [390, 390], [10, 390]];

export default function NorthIndianChart({
  houses,
  planets,
}: {
  houses: House[];
  planets?: Planet[];
}) {
  const byNumber = new Map(houses.map((h) => [h.house, h]));
  const retro = new Set((planets ?? []).filter((p) => p.retrograde).map((p) => p.name));

  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full max-w-[380px] mx-auto"
      role="img"
      aria-label="North Indian birth chart"
    >
      <defs>
        <radialGradient id="chartBg" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#FFFDF8" />
          <stop offset="100%" stopColor="#FBEFD4" />
        </radialGradient>
      </defs>

      <rect x="6" y="6" width="388" height="388" rx="6" fill="url(#chartBg)" stroke="#C18426" strokeWidth="2.5" />
      <rect x="12" y="12" width="376" height="376" rx="3" fill="none" stroke="#C18426" strokeOpacity="0.35" strokeWidth="1" />
      <path
        d="M200,6 L394,200 L200,394 L6,200 Z M6,6 L394,394 M394,6 L6,394"
        fill="none"
        stroke="#C18426"
        strokeWidth="1.3"
      />

      {CORNER_ORNAMENT.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#C18426" fillOpacity="0.55" />
      ))}

      {/* Ascendant marker above house 1 */}
      <path d="M188,14 L200,2 L212,14 Z" fill="#D6336C" />

      {HOUSE_SHAPES.map((shape, i) => {
        const houseNo = i + 1;
        const house = byNumber.get(houseNo);
        const isLagna = houseNo === 1;
        const rashiNo = house ? house.sign_index + 1 : null;
        const planetNames = house?.planets ?? [];

        return (
          <g key={houseNo}>
            {isLagna && (
              <polygon points={shape.points.map((p) => p.join(",")).join(" ")} fill="#D6336C12" />
            )}
            {rashiNo && (
              <text
                x={shape.rashiAnchor[0]}
                y={shape.rashiAnchor[1]}
                textAnchor="middle"
                fontSize="10"
                fontWeight={600}
                fill="#B08F3D"
                fontFamily="var(--font-body)"
              >
                {rashiNo}
              </text>
            )}
            {planetNames.length > 0 && (
              <text
                x={shape.label[0]}
                y={shape.label[1]}
                textAnchor="middle"
                fontSize="13"
                fontWeight={600}
                fill="#1B1730"
                fontFamily="var(--font-body)"
              >
                {planetNames.map((name, idx) => (
                  <tspan key={name} dx={idx === 0 ? 0 : 6}>
                    {GLYPH[name] ?? name.slice(0, 2)}
                    {retro.has(name) ? "℞" : ""}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
