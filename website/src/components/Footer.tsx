import { LOGO_URL, NAV_LINKS } from "@/lib/site";

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
              AI-powered Vedic astrology, palmistry, face reading, Vastu and
              temple e-commerce — built on our own self-hosted astrology
              engine, no third-party APIs.
            </p>
          </div>

          <div>
            <div className="text-[12px] font-semibold tracking-[.12em] text-[#F4D28A] mb-4">
              NAVIGATE
            </div>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[14px] text-[rgba(255,247,230,.7)] hover:text-[#FFF7E6] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[12px] font-semibold tracking-[.12em] text-[#F4D28A] mb-4">
              AVAILABLE IN
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
            © {new Date().getFullYear()} AstraVeda. All rights reserved.
          </p>
          <p className="text-[12.5px] text-[rgba(255,247,230,.5)]">
            Cosmic intelligence for a better you.
          </p>
        </div>
      </div>
    </footer>
  );
}
