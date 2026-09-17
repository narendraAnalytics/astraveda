// Light, airy backdrop for signed-in feature pages (Kundali, and later
// Palm/Face/…) — a soft pastel gradient mesh on the brand's cream base
// instead of a flat fill or a dark cosmic panel. Per 2026 "soft gradient"
// research: subtle blurred colour fields behind the content, never
// competing with the card sitting on top of it.
export default function FeatureBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-[#FFFAF2]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 50% at 10% -5%, rgba(143,41,221,.12), transparent 60%), " +
            "radial-gradient(55% 50% at 100% 0%, rgba(233,190,108,.22), transparent 60%), " +
            "radial-gradient(60% 55% at 15% 100%, rgba(208,68,126,.10), transparent 60%), " +
            "radial-gradient(65% 55% at 100% 100%, rgba(143,41,221,.10), transparent 60%)",
        }}
      />
    </div>
  );
}
