"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus, ChevronRight, Trash2, Camera } from "lucide-react";

import { deleteFace, listFaces, type FaceSummary } from "@/lib/face";
import { ApiError } from "@/lib/api";

const GRADIENT = "linear-gradient(135deg,#0c5f57,#0f8a7e,#3fa66b)";
const TEAL = "#0f8a7e";

const RELATION_TINT: Record<string, string> = {
  Self: TEAL,
  Spouse: "#3fa66b",
  Child: "#4FAA6A",
  Mother: "#E0912F",
  Father: "#4D8DE8",
  Sibling: "#8758CE",
  Friend: "#C18426",
  Other: "#8A8F98",
};

export default function ReadingsGallery() {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<FaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    try {
      const rows = await listFaces(token);
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your face readings.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleDelete = useCallback(
    async (f: FaceSummary) => {
      if (!window.confirm(`Remove ${f.name}'s face reading? This can't be undone.`)) return;
      setDeletingId(f.id);
      const token = await getToken();
      try {
        await deleteFace(f.id, token);
        setItems((prev) => prev.filter((x) => x.id !== f.id));
      } catch {
        setError("Couldn't delete that reading. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [getToken],
  );

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[26px] font-medium text-[#1B1730]">
            Your Face Readings
          </h1>
          <p className="text-[13.5px] text-[#5B5570] mt-1">
            Mukha Samudrika readings for you and your family.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/face")}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[100px] font-semibold text-[13.5px] text-white shadow-[0_8px_22px_rgba(15,138,126,.3)] hover:brightness-105 transition-all"
          style={{ background: GRADIENT }}
        >
          <Plus size={16} /> New reading
        </button>
      </div>

      {error && (
        <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[12px] px-4 py-3 mb-5">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-[140px] rounded-[20px] bg-[#1B1730]/[.04] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[24px] bg-[#F2FAF8] border border-[#1B1730]/8 p-10 text-center">
          <div className="w-14 h-14 rounded-[16px] bg-[#E2F4F0] mx-auto mb-4 flex items-center justify-center text-[24px]">
            🧑‍🦱
          </div>
          <h2 className="text-[16px] font-semibold text-[#1B1730]">No readings yet</h2>
          <p className="text-[13.5px] text-[#5B5570] mt-2 max-w-[360px] mx-auto">
            Scan a face or answer a few questions — it&apos;s saved here for you to
            revisit any time.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((f, i) => (
            <ReadingCard
              key={f.id}
              item={f}
              index={i}
              deleting={deletingId === f.id}
              onOpen={() => router.push(`/face?id=${f.id}`)}
              onDelete={() => handleDelete(f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingCard({
  item,
  index,
  deleting,
  onOpen,
  onDelete,
}: {
  item: FaceSummary;
  index: number;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const tint = RELATION_TINT[item.relation ?? "Other"] ?? RELATION_TINT.Other;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: deleting ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
      className="rounded-[20px] bg-white border border-[#1B1730]/8 p-5 hover:shadow-[0_10px_26px_rgba(27,23,48,.08)] transition-all group relative"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label={`Delete ${item.name}'s reading`}
        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8A8398] opacity-0 group-hover:opacity-100 hover:bg-[#F2FAF8] hover:text-[#C0392B] transition-all disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>

      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-bold flex-shrink-0"
            style={{ backgroundColor: `${tint}22`, color: tint }}
          >
            {item.name.trim().charAt(0).toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14.5px] font-semibold text-[#1B1730] truncate">{item.name}</span>
              {item.relation && (
                <span
                  className="text-[9px] font-bold tracking-[.02em] rounded-[6px] px-1.5 py-0.5 flex-shrink-0"
                  style={{ backgroundColor: `${tint}1a`, color: tint }}
                >
                  {item.relation}
                </span>
              )}
              {item.source === "scan" && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-[.02em] rounded-[6px] px-1.5 py-0.5 text-white flex-shrink-0" style={{ background: TEAL }}>
                  <Camera size={9} /> SCANNED
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[#8A8398] mt-0.5 truncate">{item.headline_trait}</p>
          </div>
          <ChevronRight size={17} className="text-[#C7AD97] flex-shrink-0" />
        </div>
      </button>
    </motion.div>
  );
}
