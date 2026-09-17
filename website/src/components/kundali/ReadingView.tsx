// Sarvam is prompted (backend/app/services/reading.py) to return four fixed
// headings on their own line: Lagna & Personality, Moon & Mind, Current
// Dasha, Guidance. Split on those so each section gets its own heading
// treatment instead of one undifferentiated block of text.
const KNOWN_HEADINGS = ["Lagna & Personality", "Moon & Mind", "Current Dasha", "Guidance"];

function parseReading(text: string): { heading: string | null; body: string }[] {
  const lines = text.split("\n");
  const sections: { heading: string | null; body: string }[] = [];
  let current: { heading: string | null; body: string[] } = { heading: null, body: [] };

  for (const raw of lines) {
    const line = raw.trim();
    const match = KNOWN_HEADINGS.find((h) => h.toLowerCase() === line.toLowerCase());
    if (match) {
      if (current.heading || current.body.length) {
        sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
      }
      current = { heading: match, body: [] };
    } else if (line.length > 0) {
      current.body.push(line);
    }
  }
  if (current.heading || current.body.length) {
    sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
  }
  return sections.filter((s) => s.body.length > 0);
}

export default function ReadingView({ text }: { text: string }) {
  const sections = parseReading(text);

  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <div key={i}>
          {s.heading && (
            <h3 className="font-[family-name:var(--font-display)] text-[17px] font-medium mb-2 bg-clip-text text-transparent bg-[linear-gradient(90deg,#8F29DD,#C1653D,#C18426)]">
              {s.heading}
            </h3>
          )}
          <p className="text-[14.5px] leading-[1.85] text-[#3A2E52] whitespace-pre-line">
            {s.body}
          </p>
          {i < sections.length - 1 && (
            <div className="mt-6 h-px bg-[linear-gradient(90deg,transparent,#C18426,transparent)] opacity-40" />
          )}
        </div>
      ))}
    </div>
  );
}
