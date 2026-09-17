"use client";

import { useEffect, useState } from "react";
import { LOGO_URL, NAV_LINKS } from "@/lib/site";

const NAV_TRIGGER = 96;

export default function Navbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-nav-theme]")
    );
    if (sections.length === 0) return;

    let ticking = false;
    const update = () => {
      let current: "dark" | "light" = "dark";
      for (const el of sections) {
        if (el.getBoundingClientRect().top <= NAV_TRIGGER) {
          current = (el.dataset.navTheme as "dark" | "light") || "dark";
        } else {
          break;
        }
      }
      setTheme(current);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const isLight = theme === "light";

  return (
    <nav className="av-nav fixed top-0 inset-x-0 z-50 px-5 sm:px-9 py-4 sm:py-5 bg-transparent">
      <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3 sm:gap-5">
        <a
          href="#home"
          className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0"
        >
          <img
            src={LOGO_URL}
            alt="AstraVeda"
            className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-[0_0_10px_rgba(244,210,138,.35)] flex-shrink-0"
          />
          <div className="flex flex-col leading-[1.05] min-w-0">
            <span
              className={`font-[family-name:var(--font-display)] text-[17px] sm:text-[20px] tracking-[.04em] sm:tracking-[.06em] font-semibold whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-300 ${
                isLight ? "text-[#1B1730]" : "text-[#FFF7E6]"
              }`}
            >
              ASTRAVEDA
            </span>
            <span
              className={`hidden sm:block text-[10px] tracking-[.08em] whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-300 ${
                isLight ? "text-[#8F29DD]/70" : "text-[rgba(244,210,138,.75)]"
              }`}
            >
              COSMIC INTELLIGENCE FOR A BETTER YOU
            </span>
          </div>
        </a>

        <div
          className={`av-nav-links hidden md:flex items-center gap-8 text-[14px] font-medium whitespace-nowrap transition-colors duration-300 ${
            isLight ? "text-[#1B1730]" : "text-[#FFF7E6]"
          }`}
        >
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              className={
                i === 0
                  ? "opacity-95"
                  : isLight
                  ? "text-[#5B5570] hover:text-[#1B1730] transition-colors"
                  : "text-[rgba(255,247,230,.72)] hover:text-[#FFF7E6] transition-colors"
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="#toolkit"
          className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-[9px] rounded-[100px] font-semibold text-[12.5px] sm:text-[13.5px] text-[#241505] shadow-[0_4px_18px_rgba(244,210,138,.35)] whitespace-nowrap"
          style={{ background: "linear-gradient(180deg,#F7DDA2,#E9BE6C)" }}
        >
          Get Started <span className="text-[13px] sm:text-[14px]">→</span>
        </a>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .av-nav-links { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
