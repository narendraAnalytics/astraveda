// A twinkling star-field for dark "night" panels. Positions come from an
// integer LCG at module load — identical on server and client, so no
// hydration mismatch (float Math.sin/cos caused one on Kundali's chart).
const STARS = (() => {
  let s = 20260920;
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: 34 }, () => ({
    x: Math.round(next() * 1000) / 10,
    y: Math.round(next() * 1000) / 10,
    r: 1 + Math.round(next() * 10) / 10,
    d: Math.round(next() * 40) / 10,
  }));
})();

export default function NightSky({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <style>{`
        @keyframes av-dream-twinkle { 0%,100% { opacity:.25; transform:scale(.8);} 50% { opacity:1; transform:scale(1.25);} }
        @media (prefers-reduced-motion: reduce) { .av-dream-star { animation: none !important; opacity:.6 !important; } }
      `}</style>
      {STARS.map((st, i) => (
        <span
          key={i}
          className="av-dream-star absolute rounded-full bg-white"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.r,
            height: st.r,
            animation: `av-dream-twinkle ${3 + (i % 4)}s ease-in-out ${st.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
