"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Star, Hand, Plus, ChevronRight, Trash2, Camera } from "lucide-react";

import { deleteKundali, listKundalis, type KundaliSummary } from "@/lib/kundali";
import { deletePalm, listPalms, type PalmSummary } from "@/lib/palm";
import { ApiError } from "@/lib/api";

// One hub for every saved reading — mirrors the mobile app's astrology tab
// (a "Charts | Palms" segmented control over the same two lists). Reached
// from the Hero's "Explore Your Horoscope" CTA once signed in, instead of
// dropping straight into a new Kundli.
type Tab = "charts" | "palms";

const TAB_META: Record<Tab, { gradient: string; title: string; sub: string; icon: typeof Star; newLabel: string; href: string }> = {
  charts: {
    gradient: "linear-gradient(135deg,#2A1147,#4A1C6E,#6A2597)",
    title: "Your Kundali",
    sub: "Vedic Kundalis for you and your family.",
    icon: Star,
    newLabel: "New chart",
    href: "/kundali",
  },
  palms: {
    gradient: "linear-gradient(135deg,#7A1F5C,#C0356F,#E2745A)",
    title: "Your Palm Readings",
    sub: "Hasta Samudrika palm readings for you and your family.",
    icon: Hand,
    newLabel: "New reading",
    href: "/palm",
  },
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

export default function ReadingsHub() {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("charts");

  const [charts, setCharts] = useState<KundaliSummary[]>([]);
  const [palms, setPalms] = useState<PalmSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    try {
      const [c, p] = await Promise.all([listKundalis(token), listPalms(token)]);
      setCharts(c);
      setPalms(p);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your readings.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleDeleteChart = useCallback(
    async (k: KundaliSummary) => {
      if (!window.confirm(`Remove ${k.name}'s Kundali? This can't be undone.`)) return;
      setDeletingId(k.id);
      const token = await getToken();
      try {
        await deleteKundali(k.id, token);
        setCharts((prev) => prev.filter((x) => x.id !== k.id));
      } catch {
        setError("Couldn't delete that chart. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [getToken],
  );

  const handleDeletePalm = useCallback(
    async (p: PalmSummary) => {
      if (!window.confirm(`Remove ${p.name}'s palm reading? This can't be undone.`)) return;
      setDeletingId(p.id);
      const token = await getToken();
      try {
        await deletePalm(p.id, token);
        setPalms((prev) => prev.filter((x) => x.id !== p.id));
      } catch {
        setError("Couldn't delete that reading. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [getToken],
  );

  const meta = TAB_META[tab];
  const Icon = meta.icon;

  return (
    <div>
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-[24px] px-6 py-7 sm:px-8 sm:py-8 mb-4 relative z-0"
        style={{ background: meta.gradient }}
      >
        <h1 className="text-white text-[24px] sm:text-[27px] font-bold">{meta.title}</h1>
        <p className="text-white/80 text-[13px] mt-1.5">{meta.sub}</p>
      </motion.div>

      <div
        className="relative z-10 mx-2 sm:mx-4 flex gap-1.5 p-1.5 rounded-[16px] border shadow-[0_10px_26px_rgba(27,23,48,.08)]"
        style={{
          background: `linear-gradient(135deg, ${CARD_ACCENT.charts[0]}12, ${CARD_ACCENT.palms[0]}12)`,
          borderColor: `${CARD_ACCENT[tab][0]}28`,
        }}
      >
        {(["charts", "palms"] as Tab[]).map((t) => {
          const on = tab === t;
          const [a, a2] = CARD_ACCENT[t];
          const TIcon = TAB_META[t].icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-[12px] text-[13px] font-bold transition-all"
              style={
                on
                  ? { background: `linear-gradient(135deg, ${a}, ${a2})`, color: "#fff", boxShadow: `0 6px 16px ${a}45` }
                  : { background: `${a}14`, color: a }
              }
            >
              <TIcon size={14} />
              {t === "charts" ? "Kundali" : "Palms"}
            </button>
          );
        })}
      </div>

      <div className="pt-7">
        <button
          type="button"
          onClick={() => router.push(meta.href)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[100px] font-semibold text-[13.5px] text-white shadow-[0_8px_22px_rgba(27,23,48,.2)] hover:brightness-105 transition-all mb-6"
          style={{ background: meta.gradient }}
        >
          <Plus size={16} /> {meta.newLabel}
        </button>

        {error && (
          <p className="text-[13px] text-[#C0392B] bg-[#FDF1EF] border border-[#F0C9C2] rounded-[12px] px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-[150px] rounded-[20px] bg-[#1B1730]/[.04] animate-pulse" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {tab === "charts" ? (
                charts.length === 0 ? (
                  <EmptyState
                    icon={Icon}
                    accent={CARD_ACCENT.charts}
                    title="No charts yet"
                    body="Generate a Vedic Kundali for yourself or a family member — it's saved here for you to revisit any time."
                  />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {charts.map((k, i) => (
                      <ChartCard
                        key={k.id}
                        chart={k}
                        index={i}
                        deleting={deletingId === k.id}
                        onOpen={() => router.push(`/kundali?id=${k.id}`)}
                        onDelete={() => handleDeleteChart(k)}
                      />
                    ))}
                  </div>
                )
              ) : palms.length === 0 ? (
                <EmptyState
                  icon={Icon}
                  accent={CARD_ACCENT.palms}
                  title="No palm readings yet"
                  body="Scan your palm or answer a few questions — it's saved here for you to revisit any time."
                />
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {palms.map((p, i) => (
                    <PalmCard
                      key={p.id}
                      item={p}
                      index={i}
                      deleting={deletingId === p.id}
                      onOpen={() => router.push(`/palm?id=${p.id}`)}
                      onDelete={() => handleDeletePalm(p)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// Every card is a soft mesh-gradient tint of its accent pair instead of a
// flat white/cream panel — per 2026 dashboard trends, "Soft Gradients 2.0":
// airy, glass-like color washes rather than loud fills, with a gradient-ring
// avatar and colorful fact chips carrying the accent through the card.
const CARD_ACCENT: Record<Tab, [string, string]> = {
  charts: ["#8F29DD", "#A72BE6"],
  palms: ["#C0356F", "#E2745A"],
};

function EmptyState({
  icon: Icon,
  accent,
  title,
  body,
}: {
  icon: typeof Star;
  accent: [string, string];
  title: string;
  body: string;
}) {
  const [a, a2] = accent;
  return (
    <div
      className="rounded-[24px] p-10 text-center border"
      style={{
        background: `linear-gradient(160deg, ${a}12 0%, ${a2}08 55%, #FFFFFF 100%)`,
        borderColor: `${a}22`,
      }}
    >
      <div
        className="w-16 h-16 rounded-[18px] mx-auto mb-4 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${a}, ${a2})`, boxShadow: `0 10px 24px ${a}40` }}
      >
        <Icon size={26} color="#fff" />
      </div>
      <h2 className="text-[16px] font-semibold text-[#1B1730]">{title}</h2>
      <p className="text-[13.5px] text-[#5B5570] mt-2 max-w-[360px] mx-auto">{body}</p>
    </div>
  );
}

function GradientPill({ accent, children }: { accent: [string, string]; children: React.ReactNode }) {
  const [a, a2] = accent;
  return (
    <span
      className="text-[9px] font-bold tracking-[.02em] rounded-[6px] px-1.5 py-0.5 flex-shrink-0 text-white"
      style={{ background: `linear-gradient(90deg, ${a}, ${a2})` }}
    >
      {children}
    </span>
  );
}

function FactPill({ label, value, accent }: { label: string; value: string; accent: [string, string] }) {
  const [a] = accent;
  return (
    <div className="rounded-[10px] px-2 py-1.5" style={{ background: `${a}0f`, border: `1px solid ${a}22` }}>
      <div className="text-[8.5px] font-bold uppercase tracking-[.02em]" style={{ color: `${a}b3` }}>
        {label}
      </div>
      <div className="text-[11px] font-bold text-[#1B1730] mt-0.5 truncate">{value}</div>
    </div>
  );
}

function CardShell({
  accent,
  deleting,
  onDelete,
  deleteLabel,
  children,
}: {
  accent: [string, string];
  deleting: boolean;
  onDelete: () => void;
  deleteLabel: string;
  children: React.ReactNode;
}) {
  const [a, a2] = accent;
  return (
    <div
      className="rounded-[20px] p-5 group relative border transition-all hover:-translate-y-1"
      style={{
        background: `linear-gradient(160deg, ${a}14 0%, ${a2}0a 50%, #FFFFFF 100%)`,
        borderColor: `${a}28`,
        boxShadow: `0 4px 18px ${a}14`,
        opacity: deleting ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 16px 34px ${a}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 4px 18px ${a}14`;
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label={deleteLabel}
        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8A8398] opacity-0 group-hover:opacity-100 hover:bg-white hover:text-[#C0392B] transition-all disabled:opacity-50 z-10"
      >
        <Trash2 size={15} />
      </button>
      {children}
    </div>
  );
}

function ChartCard({
  chart,
  index,
  deleting,
  onOpen,
  onDelete,
}: {
  chart: KundaliSummary;
  index: number;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const accent = CARD_ACCENT.charts;
  const [a, a2] = accent;
  const facts: [string, string][] = [
    ...(chart.lagna ? [["Lagna", chart.lagna] as [string, string]] : []),
    ...(chart.moon_sign ? [["Rashi", chart.moon_sign] as [string, string]] : []),
    ...(chart.nakshatra ? [["Nakshatra", chart.nakshatra] as [string, string]] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
    >
      <CardShell accent={accent} deleting={deleting} onDelete={onDelete} deleteLabel={`Delete ${chart.name}'s chart`}>
        <button type="button" onClick={onOpen} className="w-full text-left">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-bold flex-shrink-0 text-white"
              style={{ background: `linear-gradient(135deg, ${a}, ${a2})`, boxShadow: `0 6px 16px ${a}50` }}
            >
              {chart.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14.5px] font-semibold text-[#1B1730] truncate">{chart.name}</span>
                {chart.relation && <GradientPill accent={accent}>{chart.relation}</GradientPill>}
              </div>
              <p className="text-[11.5px] text-[#8A8398] mt-0.5 truncate">
                {prettyDate(chart.birth_date)}
                {chart.unknown_time ? "" : ` · ${chart.birth_time.slice(0, 5)}`} · {chart.birth_place}
              </p>
            </div>
            <ChevronRight size={17} className="text-[#C7AD97] flex-shrink-0" />
          </div>

          {facts.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mt-4">
              {facts.map(([label, value]) => (
                <FactPill key={label} label={label} value={value} accent={accent} />
              ))}
            </div>
          )}

          {chart.current_mahadasha && (
            <p className="text-[11px] text-[#5B5570] mt-3">
              Running Mahadasha ·{" "}
              <span className="font-bold" style={{ color: a }}>
                {chart.current_mahadasha}
              </span>
            </p>
          )}
        </button>
      </CardShell>
    </motion.div>
  );
}

function PalmCard({
  item,
  index,
  deleting,
  onOpen,
  onDelete,
}: {
  item: PalmSummary;
  index: number;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const accent = CARD_ACCENT.palms;
  const [a, a2] = accent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
    >
      <CardShell accent={accent} deleting={deleting} onDelete={onDelete} deleteLabel={`Delete ${item.name}'s reading`}>
        <button type="button" onClick={onOpen} className="w-full text-left">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-bold flex-shrink-0 text-white"
              style={{ background: `linear-gradient(135deg, ${a}, ${a2})`, boxShadow: `0 6px 16px ${a}50` }}
            >
              {item.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14.5px] font-semibold text-[#1B1730] truncate">{item.name}</span>
                {item.relation && <GradientPill accent={accent}>{item.relation}</GradientPill>}
                {item.source === "scan" && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-black tracking-[.02em] rounded-[6px] px-1.5 py-0.5 text-white flex-shrink-0"
                    style={{ background: `linear-gradient(90deg, ${a}, ${a2})` }}
                  >
                    <Camera size={9} /> SCANNED
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#8A8398] mt-0.5 truncate">{item.headline_trait}</p>
            </div>
            <ChevronRight size={17} className="text-[#C7AD97] flex-shrink-0" />
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-4">
            <FactPill label="Dominant hand" value={item.dominant_hand} accent={accent} />
            <FactPill label="Hand shape" value={item.hand_shape} accent={accent} />
          </div>
        </button>
      </CardShell>
    </motion.div>
  );
}
