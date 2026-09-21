"use client";

// The AstraVeda mascot as an inline SVG (the mobile one is built from Views — this is a richer
// web redraw in the same palette: purple gradient body, gold antenna/arms, cream rim).
// All limb motion is CSS keyframes (transform-box: view-box, origins in SVG user units) so the
// robot costs nothing per frame in React. Body float / walk-in is done by the parent.

type Props = {
  walking: boolean; // legs stepping (walk-in)
  waving: boolean; // right arm waving
  speaking: boolean; // mouth moving
  animate: boolean; // false under Reduce Motion → fully static
  className?: string;
};

export default function RobotAvatar({ walking, waving, speaking, animate, className }: Props) {
  const on = animate;
  return (
    <svg
      viewBox="0 0 140 176"
      className={className}
      role="img"
      aria-label="AstraVeda robot"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="avr-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c25cf5" />
          <stop offset="1" stopColor="#8f29dd" />
        </linearGradient>
        <linearGradient id="avr-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a72be6" />
          <stop offset="1" stopColor="#6d1fb8" />
        </linearGradient>
        <linearGradient id="avr-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD873" />
          <stop offset="1" stopColor="#E0A020" />
        </linearGradient>
        <radialGradient id="avr-core" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#FFF3C4" />
          <stop offset=".5" stopColor="#FFC93C" />
          <stop offset="1" stopColor="#E08A1E" />
        </radialGradient>
        <filter id="avr-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        .avr-part { transform-box: view-box; }
        @keyframes avr-stepA { from { transform: rotate(-26deg) } to { transform: rotate(26deg) } }
        @keyframes avr-stepB { from { transform: rotate(26deg) } to { transform: rotate(-26deg) } }
        @keyframes avr-wave  { from { transform: rotate(-118deg) } to { transform: rotate(-158deg) } }
        @keyframes avr-blink { 0%, 92%, 100% { transform: scaleY(1) } 96% { transform: scaleY(.12) } }
        @keyframes avr-talk  { from { transform: scaleY(.35) } to { transform: scaleY(1.35) } }
        @keyframes avr-pulse { 0%, 100% { opacity: .75; transform: scale(1) } 50% { opacity: 1; transform: scale(1.18) } }
        @keyframes avr-ring  { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .avr-walk .avr-legL { animation: avr-stepA .46s ease-in-out infinite alternate }
        .avr-walk .avr-legR { animation: avr-stepB .46s ease-in-out infinite alternate }
        .avr-armR-wave { animation: avr-wave .38s ease-in-out infinite alternate }
        .avr-eye { animation: avr-blink 4.2s ease-in-out infinite }
        .avr-eye2 { animation-delay: .04s }
        .avr-mouth-talk { animation: avr-talk .2s ease-in-out infinite alternate }
        .avr-pulse { animation: avr-pulse 2.2s ease-in-out infinite }
        .avr-ring { animation: avr-ring 9s linear infinite }
      `}</style>

      {/* floor shadow */}
      <ellipse cx="70" cy="168" rx="38" ry="6" fill="rgba(60,20,90,.28)" />

      <g className={on && walking ? "avr-walk" : ""}>
        {/* legs — pivot at the hip */}
        <g className="avr-part avr-legL" style={{ transformOrigin: "55px 128px" }}>
          <rect x="49" y="126" width="12" height="28" rx="6" fill="url(#avr-gold)" />
          <rect x="43" y="150" width="24" height="13" rx="6.5" fill="#5b2a86" stroke="#fffaf2" strokeWidth="1.5" />
        </g>
        <g className="avr-part avr-legR" style={{ transformOrigin: "85px 128px" }}>
          <rect x="79" y="126" width="12" height="28" rx="6" fill="url(#avr-gold)" />
          <rect x="73" y="150" width="24" height="13" rx="6.5" fill="#5b2a86" stroke="#fffaf2" strokeWidth="1.5" />
        </g>

        {/* left arm (rests) */}
        <g className="avr-part" style={{ transformOrigin: "40px 96px", transform: "rotate(8deg)" }}>
          <rect x="26" y="92" width="11" height="32" rx="5.5" fill="url(#avr-gold)" />
          <circle cx="31.5" cy="126" r="6.5" fill="#fffaf2" />
        </g>

        {/* torso */}
        <rect x="40" y="84" width="60" height="52" rx="20" fill="url(#avr-body)" stroke="#fffaf2" strokeWidth="2.2" />
        <ellipse cx="55" cy="93" rx="12" ry="4" fill="#fff" opacity=".28" />
        {/* chest core — pulsing gold lotus light */}
        <g className="avr-part avr-pulse" style={{ transformOrigin: "70px 110px" }}>
          <circle cx="70" cy="110" r="11" fill="url(#avr-core)" filter="url(#avr-glow)" />
        </g>
        <g className="avr-part avr-ring" style={{ transformOrigin: "70px 110px" }}>
          <circle cx="70" cy="110" r="16" fill="none" stroke="#FFD873" strokeWidth="1" strokeDasharray="3 4" opacity=".8" />
        </g>

        {/* right arm (waves) */}
        <g
          className={`avr-part ${on && waving ? "avr-armR-wave" : ""}`}
          style={{ transformOrigin: "100px 96px", transform: on && waving ? undefined : "rotate(-8deg)" }}
        >
          <rect x="98" y="92" width="11" height="32" rx="5.5" fill="url(#avr-gold)" />
          <circle cx="103.5" cy="126" r="6.5" fill="#fffaf2" />
        </g>

        {/* head */}
        <rect x="18" y="42" width="10" height="24" rx="5" fill="url(#avr-gold)" />
        <rect x="112" y="42" width="10" height="24" rx="5" fill="url(#avr-gold)" />
        <line x1="70" y1="22" x2="70" y2="8" stroke="#FFC93C" strokeWidth="3" strokeLinecap="round" />
        <g className="avr-part avr-pulse" style={{ transformOrigin: "70px 6px" }}>
          <circle cx="70" cy="6" r="6" fill="url(#avr-core)" filter="url(#avr-glow)" />
        </g>
        <rect x="26" y="20" width="88" height="70" rx="27" fill="url(#avr-head)" stroke="#fffaf2" strokeWidth="2.6" />
        <ellipse cx="52" cy="29" rx="20" ry="5" fill="#fff" opacity=".34" transform="rotate(-8 52 29)" />

        {/* visor */}
        <rect x="35" y="35" width="70" height="40" rx="17" fill="#1B0F3D" opacity=".94" />
        <rect x="35" y="35" width="70" height="40" rx="17" fill="none" stroke="#c25cf5" strokeOpacity=".5" strokeWidth="1.2" />
        <g className="avr-part avr-eye" style={{ transformOrigin: "55px 54px" }}>
          <ellipse cx="55" cy="54" rx="7.5" ry="8.5" fill="#FFF7E6" />
          <ellipse cx="57" cy="51" rx="2.4" ry="2.8" fill="#fff" />
        </g>
        <g className="avr-part avr-eye avr-eye2" style={{ transformOrigin: "85px 54px" }}>
          <ellipse cx="85" cy="54" rx="7.5" ry="8.5" fill="#FFF7E6" />
          <ellipse cx="87" cy="51" rx="2.4" ry="2.8" fill="#fff" />
        </g>
        <circle cx="45" cy="66" r="4.5" fill="#FF8FB8" opacity=".5" />
        <circle cx="95" cy="66" r="4.5" fill="#FF8FB8" opacity=".5" />
        <g
          className={`avr-part ${on && speaking ? "avr-mouth-talk" : ""}`}
          style={{ transformOrigin: "70px 64px" }}
        >
          <path d="M60 63 Q70 72 80 63" fill="none" stroke="#FFC93C" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
