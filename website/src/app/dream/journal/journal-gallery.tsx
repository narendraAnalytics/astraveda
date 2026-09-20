"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus } from "lucide-react";

import { deleteDream, listDreams, type DreamSummary } from "@/lib/dream";
import { ApiError } from "@/lib/api";
import DreamCard from "@/components/dream/DreamCard";

const GRADIENT = "linear-gradient(135deg,#1e1b4b,#4f46e5,#6d28d9)";

export default function JournalGallery() {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<DreamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    try {
      setItems(await listDreams(token));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your dream journal.");
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
    async (d: DreamSummary) => {
      if (!window.confirm(`Remove “${d.title}” from your journal? This can't be undone.`)) return;
      setDeletingId(d.id);
      const token = await getToken();
      try {
        await deleteDream(d.id, token);
        setItems((prev) => prev.filter((x) => x.id !== d.id));
      } catch {
        setError("Couldn't delete that dream. Please try again.");
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
            Your Dream Journal
          </h1>
          <p className="text-[13.5px] text-[#5B5570] mt-1">Every dream you&apos;ve had interpreted, kept in one place.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dream")}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[100px] font-semibold text-[13.5px] text-white shadow-[0_8px_22px_rgba(79,70,229,.3)] hover:brightness-105 transition-all"
          style={{ background: GRADIENT }}
        >
          <Plus size={16} /> New dream
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
            <div key={i} className="h-[170px] rounded-[20px] bg-[#1B1730]/[.04] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[24px] p-10 text-center border" style={{ background: "linear-gradient(160deg,#4f46e512,#FFFFFF)", borderColor: "#4f46e522" }}>
          <div className="w-16 h-16 rounded-[18px] mx-auto mb-4 flex items-center justify-center text-[26px]" style={{ background: GRADIENT }}>
            🌙
          </div>
          <h2 className="text-[16px] font-semibold text-[#1B1730]">No dreams yet</h2>
          <p className="text-[13.5px] text-[#5B5570] mt-2 max-w-[360px] mx-auto">
            Describe a dream and it&apos;s saved here to revisit any time.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
            >
              <DreamCard
                item={d}
                deleting={deletingId === d.id}
                onOpen={() => router.push(`/dream?id=${d.id}`)}
                onDelete={() => handleDelete(d)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
