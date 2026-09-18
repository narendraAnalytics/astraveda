// Sarvam is prompted (backend/app/services/palm_reading.py) to return these 7
// fixed headings, each on its own line — split on those so every section gets
// its own heading treatment instead of one undifferentiated block of text.
const KNOWN_HEADINGS = [
  "Hand Nature",
  "Heart Line & Relationships",
  "Head Line & Mind",
  "Life Line & Vitality",
  "Fate Line & Career",
  "Mounts & Planetary Strengths",
  "Guidance",
];

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
            <h3 className="font-[family-name:var(--font-display)] text-[17px] font-medium mb-2 bg-clip-text text-transparent bg-[linear-gradient(90deg,#7A1F5C,#E2745A)]">
              {s.heading}
            </h3>
          )}
          <p className="text-[14.5px] leading-[1.85] text-[#3A2E52] whitespace-pre-line">
            {s.body}
          </p>
          {i < sections.length - 1 && (
            <div className="mt-6 h-px bg-[linear-gradient(90deg,transparent,#C0356F,transparent)] opacity-40" />
          )}
        </div>
      ))}
    </div>
  );
}
