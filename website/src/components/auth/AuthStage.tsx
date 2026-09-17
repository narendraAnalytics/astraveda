"use client";

import { LOGO_URL } from "@/lib/site";

type AuthMode = "sign-in" | "sign-up";

const COPY: Record<
  AuthMode,
  { headline: React.ReactNode; sub: string }
> = {
  "sign-in": {
    headline: (
      <>
        Welcome back to <span className="text-[#F4D28A] italic">your stars</span>
      </>
    ),
    sub: "Sign in to pick up your Kundli, palm readings, and daily cosmic guidance right where you left off.",
  },
  "sign-up": {
    headline: (
      <>
        Begin your <span className="text-[#F4D28A] italic">cosmic story</span>
      </>
    ),
    sub: "Create your account to unlock personalized Kundli, palm and face readings, and daily guidance from the stars.",
  },
};

const STARS = [
  { top: "10%", left: "16%", size: 3, delay: 0 },
  { top: "20%", left: "64%", size: 2, delay: 0.4 },
  { top: "33%", left: "40%", size: 4, delay: 0.9 },
  { top: "46%", left: "78%", size: 2, delay: 1.3 },
  { top: "58%", left: "20%", size: 3, delay: 0.2 },
  { top: "67%", left: "56%", size: 2, delay: 1.7 },
  { top: "80%", left: "32%", size: 3, delay: 0.6 },
  { top: "16%", left: "86%", size: 2, delay: 1.1 },
];

export default function AuthStage({
  mode,
  children,
}: {
  mode: AuthMode;
  children: React.ReactNode;
}) {
  const copy = COPY[mode];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FFF7E6]">
      {/* Cosmic panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-[#0E0B1E] px-8 py-8 lg:w-[44%] lg:px-14 lg:py-14">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 0%, rgba(143,41,221,.3), transparent 55%), radial-gradient(90% 70% at 100% 100%, rgba(244,210,138,.16), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="av-auth-stars absolute inset-0 pointer-events-none overflow-hidden"
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-[#F4D28A]"
              style={{
                top: s.top,
                left: s.left,
                width: s.size,
                height: s.size,
                boxShadow: `0 0 ${s.size * 2}px ${s.size}px rgba(244,210,138,.55)`,
                animation: `av-twinkle ${3 + i * 0.3}s ease-in-out infinite ${s.delay}s`,
              }}
            />
          ))}
        </div>

        <a href="/" className="relative z-[1] inline-flex items-center gap-2.5 w-fit">
          <img src={LOGO_URL} alt="" className="h-8 w-8 object-contain" />
          <span className="font-[family-name:var(--font-display)] text-[16px] tracking-[.06em] font-semibold text-[#FFF7E6]">
            ASTRAVEDA
          </span>
        </a>

        <div className="relative z-[1] max-w-[380px]">
          <h1 className="font-[family-name:var(--font-display)] font-medium text-[clamp(28px,3.4vw,42px)] leading-[1.15] text-[#FFF7E6] mb-4">
            {copy.headline}
          </h1>
          <p className="text-[14.5px] leading-[1.6] text-[rgba(255,247,230,.66)]">
            {copy.sub}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .av-auth-stars span { animation: none !important; opacity: .55; }
        }
      `}</style>
    </div>
  );
}
