"use client";

import { LOGO_URL, NAV_LINKS } from "@/lib/site";
import { useI18n } from "@/i18n/I18nProvider";

const LANGUAGES = [
  "English",
  "हिन्दी",
  "ଓଡ଼ିଆ",
  "தமிழ்",
  "తెలుగు",
  "मराठी",
  "ಕನ್ನಡ",
];

export default function Footer() {
  const { d } = useI18n();
  return (
    <footer
      data-nav-theme="dark"
      className="relative bg-[#08113A] border-t border-[rgba(244,210,138,.14)] px-6 sm:px-9 pt-16 pb-8"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10 md:gap-8 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={LOGO_URL}
                alt="AstraVeda"
                className="h-9 w-9 object-contain"
              />
              <span className="font-[family-name:var(--font-display)] text-[20px] tracking-[.06em] text-[#FFF7E6] font-semibold">
                ASTRAVEDA
              </span>
            </div>
            <p className="text-[13.5px] leading-[1.7] text-[rgba(255,247,230,.6)] max-w-sm">
              {d.footer.desc}
            </p>
          </div>

          <div>
            <div className="text-[12px] font-semibold tracking-[.12em] text-[#F4D28A] mb-4">
              {d.footer.navigate}
            </div>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link, i) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[14px] text-[rgba(255,247,230,.7)] hover:text-[#FFF7E6] transition-colors"
                  >
                    {d.nav.links[i] ?? link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[12px] font-semibold tracking-[.12em] text-[#F4D28A] mb-4">
              {d.footer.availableIn}
            </div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <span
                  key={lang}
                  className="text-[12.5px] px-3 py-1.5 rounded-full border border-[rgba(244,210,138,.2)] text-[rgba(255,247,230,.65)]"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[rgba(255,247,230,.1)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12.5px] text-[rgba(255,247,230,.5)]">
            © {new Date().getFullYear()} AstraVeda. {d.footer.rights}
          </p>
          <p className="text-[12.5px] text-[rgba(255,247,230,.5)]">
            {d.footer.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
