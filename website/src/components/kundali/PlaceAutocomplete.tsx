"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, type Place } from "@/lib/kundali";

export default function PlaceAutocomplete({
  value,
  onSelect,
}: {
  value: Place | null;
  onSelect: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2 || (value && query === value.label)) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query.trim());
        setResults(places);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onSelect(null);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="City, country"
        className="w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white px-4 text-[15px] text-[#1B1730] focus:border-[#8F29DD] focus:outline-none focus:ring-2 focus:ring-[#8F29DD]/15"
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-[#8A8398]">
          …
        </span>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1.5 w-full rounded-[12px] border border-[#1B1730]/10 bg-white shadow-[0_12px_28px_rgba(27,23,48,.12)] overflow-hidden">
          {results.map((p) => (
            <button
              key={`${p.latitude},${p.longitude}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(p.label);
                setResults([]);
                setOpen(false);
                onSelect(p);
              }}
              className="w-full text-left px-4 py-2.5 text-[13.5px] text-[#1B1730] hover:bg-[#8F29DD]/[.06] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
