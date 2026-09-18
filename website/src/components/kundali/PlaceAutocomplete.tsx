"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { searchPlaces, type Place } from "@/lib/kundali";

// Mirrors frontend/src/app/kundali.tsx's "Place of birth" field (the mobile
// app) — a suffix icon that reflects state (searching/selected/idle), a pin
// icon per suggestion row, a timezone confirmation once picked, and a "no
// matching city" message instead of silently showing nothing.
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
  const [notFound, setNotFound] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setNotFound(false);
    if (query.trim().length < 2 || (value && query === value.label)) {
      setResults([]);
      return;
    }
    setLoading(true);
    const seq = ++seqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query.trim());
        if (seq !== seqRef.current) return;
        setResults(places);
        setNotFound(places.length === 0);
        setOpen(true);
      } catch {
        if (seq !== seqRef.current) return;
        setResults([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onSelect(null);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search city…"
          autoComplete="off"
          className="w-full h-12 rounded-[12px] border border-[#1B1730]/14 bg-white pl-4 pr-11 text-[15px] text-[#1B1730] focus:border-[#D6336C] focus:outline-none focus:ring-2 focus:ring-[#D6336C]/15"
        />
        <span className="absolute right-4 flex items-center justify-center">
          {loading ? (
            <Loader2 size={17} className="text-[#8A8398] animate-spin" />
          ) : value ? (
            <CheckCircle2 size={17} className="text-[#0D9488]" />
          ) : (
            <MapPin size={17} className="text-[#8A8398]" />
          )}
        </span>
      </div>

      {open && !value && results.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-[12px] border border-[#1B1730]/10 bg-white shadow-[0_12px_28px_rgba(27,23,48,.12)] overflow-hidden">
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
              className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-[13.5px] text-[#1B1730] hover:bg-[#D6336C]/[.06] transition-colors"
            >
              <MapPin size={14} className="text-[#D6336C] flex-shrink-0" />
              {p.label}
            </button>
          ))}
        </div>
      )}

      {value ? (
        <p className="text-[11.5px] text-[#8A8398] mt-2">Timezone · {value.timezone}</p>
      ) : notFound && !loading ? (
        <p className="text-[11.5px] text-[#C0392B] mt-2">
          No matching city found. Try a nearby larger city.
        </p>
      ) : query.trim().length >= 2 && !loading && results.length > 0 ? (
        <p className="text-[11.5px] text-[#8A8398] mt-2">Pick your city from the list above.</p>
      ) : null}
    </div>
  );
}
