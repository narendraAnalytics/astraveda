import type { House } from "@/lib/kundali";

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

const HOUSE_SHAPES: { points: [number, number][]; label: [number, number] }[] = [
  // 1 — top kite
  { points: [M.top, X.tr, [C.x, C.y], X.tl], label: [200, 55] },
  // 2
  { points: [CORNER.tr, M.top, X.tr], label: [265, 35] },
  // 3
  { points: [CORNER.tr, X.tr, M.right], label: [340, 100] },
  // 4 — right kite
  { points: [M.right, X.br, [C.x, C.y], X.tr], label: [345, 200] },
  // 5
  { points: [CORNER.br, M.right, X.br], label: [340, 300] },
  // 6
  { points: [CORNER.br, X.br, M.bottom], label: [265, 365] },
  // 7 — bottom kite
  { points: [M.bottom, X.br, [C.x, C.y], X.bl], label: [200, 345] },
  // 8
  { points: [CORNER.bl, M.bottom, X.bl], label: [135, 365] },
  // 9
  { points: [CORNER.bl, X.bl, M.left], label: [60, 300] },
  // 10 — left kite
  { points: [M.left, X.bl, [C.x, C.y], X.tl], label: [55, 200] },
  // 11
  { points: [CORNER.tl, X.tl, M.left], label: [60, 100] },
  // 12
  { points: [CORNER.tl, M.top, X.tl], label: [135, 35] },
];

const ABBR: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju",
  Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

export default function NorthIndianChart({ houses }: { houses: House[] }) {
  const byNumber = new Map(houses.map((h) => [h.house, h]));

  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[380px] mx-auto" role="img" aria-label="North Indian birth chart">
      <rect x="1" y="1" width="398" height="398" fill="#FFF7E6" stroke="#C18426" strokeWidth="2" />
      <path
        d="M200,0 L400,200 L200,400 L0,200 Z M0,0 L400,400 M400,0 L0,400"
        fill="none"
        stroke="#C18426"
        strokeWidth="1.4"
      />
      {HOUSE_SHAPES.map((shape, i) => {
        const houseNo = i + 1;
        const house = byNumber.get(houseNo);
        const planets = (house?.planets ?? []).map((p) => ABBR[p] ?? p.slice(0, 2));
        const isLagna = houseNo === 1;
        return (
          <g key={houseNo}>
            {isLagna && (
              <polygon
                points={shape.points.map((p) => p.join(",")).join(" ")}
                fill="#8F29DD14"
              />
            )}
            <text
              x={shape.label[0]}
              y={shape.label[1] - 10}
              textAnchor="middle"
              fontSize="9"
              fill="#B08F3D"
              fontFamily="var(--font-body)"
            >
              {houseNo}
            </text>
            {house?.sign && (
              <text
                x={shape.label[0]}
                y={shape.label[1]}
                textAnchor="middle"
                fontSize="8.5"
                fill="#8A6D3B"
                fontFamily="var(--font-body)"
              >
                {house.sign.slice(0, 3)}
              </text>
            )}
            {planets.length > 0 && (
              <text
                x={shape.label[0]}
                y={shape.label[1] + 13}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight={600}
                fill="#1B1730"
                fontFamily="var(--font-body)"
              >
                {planets.join(" ")}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
