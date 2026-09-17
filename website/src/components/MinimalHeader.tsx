import { LOGO_URL } from "@/lib/site";

// A quiet header for feature pages (Kundali, and later Palm/Face/…) that
// aren't part of the marketing scroll — just a way back home, no nav links
// or auth controls competing with the task at hand.
export default function MinimalHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-5 sm:px-9 py-4 sm:py-5">
      <a href="/" className="inline-flex items-center gap-2.5">
        <img
          src={LOGO_URL}
          alt="AstraVeda"
          className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(244,210,138,.35)]"
        />
        <span className="font-[family-name:var(--font-display)] text-[17px] tracking-[.05em] font-semibold text-[#FFF7E6]">
          ASTRAVEDA
        </span>
      </a>
    </header>
  );
}
