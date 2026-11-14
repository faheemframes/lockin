"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, ArrowRight } from "lucide-react";
import { LockinLogo, LockinMark } from "../../../components/ui/LockinLogo";
import { CountUp } from "../../../components/ui/motion";
import LoadingScreen from "../../../components/LoadingScreen";

const API =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost:4000")
        ? process.env.NEXT_PUBLIC_API_URL
        : "/api")
    : (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost:4000")
        ? process.env.NEXT_PUBLIC_API_URL
        : "/api");

export default function PublicShareRecap() {
  const params = useParams();
  const router = useRouter();
  const shareId = params?.shareId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recap, setRecap] = useState<any>(null);

  useEffect(() => {
    if (!shareId) return;

    fetch(`${API}/recaps/share/${shareId}`, {
      headers: { "bypass-tunnel-reminder": "true" }
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Recap card not found or has expired.");
        }
        return res.json();
      })
      .then((data) => {
        setRecap(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load shared card.");
        setLoading(false);
      });
  }, [shareId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !recap) {
    return (
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-5 text-center">
        <div className="grid-noise pointer-events-none fixed inset-0" />
        <LockinMark size={72} color="rgb(var(--ink-3))" />
        <h1 className="t-display relative mt-6 text-large-title text-ink">Card not found</h1>
        <p className="relative mt-2 max-w-[300px] text-subhead leading-relaxed text-ink-2">{error || "This recap doesn't exist or was removed."}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="relative mt-8 flex h-12 items-center rounded-xl border border-line bg-surface px-6 text-subhead font-semibold text-ink transition-colors hover:bg-raised"
        >
          Open LOCKIN
        </button>
      </div>
    );
  }

  const hours = Math.floor(recap.sessionDuration / 60);
  const mins = recap.sessionDuration % 60;
  const isSession = recap.recapType === "session";
  const accent = recap.recapType === "weekly" || recap.recapType === "monthly" ? "gold" : "signal";
  const isCollaborative = recap.participantCount && recap.participantCount > 1;

  const stats = isSession
    ? [
        { label: "Tasks", value: recap.tasksCompleted },
        { label: "Streak", value: `${recap.streak}d` },
        recap.missionRank && isCollaborative
          ? { label: "Crew Rank", value: `#${recap.missionRank}/${recap.participantCount}` }
          : { label: "Focus", value: "100%" },
        recap.categorySnapshot ? { label: "Category", value: recap.categorySnapshot } : null
      ]
    : [
        { label: "Tasks", value: recap.tasksCompleted },
        { label: "Streak", value: `${recap.streak}d` },
        { label: "Sessions", value: recap.metadata?.missionsCompleted ?? 0 },
        recap.categorySnapshot ? { label: "Top category", value: recap.categorySnapshot } : null
      ];

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-bg px-5 py-10 text-ink">
      <div className="grid-noise pointer-events-none fixed inset-0" />
      <motion.div className="race-stripe pointer-events-none fixed inset-x-0 top-0 h-[2px]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1 }} />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <LockinLogo size="sm" />
        </motion.div>

        <motion.article
          initial={{ y: 60, rotateX: 24, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, rotateX: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 20, delay: 0.15 }}
          style={{ transformPerspective: 1200 }}
          className={`relative mt-8 flex aspect-[9/16] w-full flex-col justify-between overflow-hidden rounded-sm border bg-surface p-7 shadow-lift ${accent === "gold" ? "border-gold/40" : "border-signal/70"}`}
        >
          {recap.metadata?.screenshot && (
            <>
              <img
                src={recap.metadata.screenshot}
                alt="Session evidence"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/35" />
            </>
          )}
          <div className="pointer-events-none absolute -bottom-6 -right-10 opacity-[0.07]">
            <LockinMark size={260} color="rgb(var(--ink))" showTriangle={false} />
          </div>

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-callout font-semibold text-ink">{recap.creator?.name}</p>
              <p className="truncate text-footnote text-ink-3">{recap.creator?.department}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-caption font-semibold ${accent === "gold" ? "text-gold" : "text-crimson"}`}>
                {isSession ? "Session" : `${recap.recapType} wrapped`}
              </p>
              <p className="text-caption text-ink-3">{new Date(recap.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>

          <div className="relative">
            <div className="t-display flex items-baseline leading-none">
              {hours > 0 && (
                <>
                  <CountUp value={hours} className="text-[96px]" />
                  <span className="mr-3 text-[36px]">h</span>
                </>
              )}
              {(mins > 0 || hours === 0) && (
                <>
                  <CountUp value={mins} className="text-[96px]" />
                  <span className="text-[36px]">m</span>
                </>
              )}
            </div>
            <p className="t-label mt-2">Locked in</p>
            {recap.missionTitle && <p className="t-display mt-2 line-clamp-2 text-title-2 text-ink-2">{recap.missionTitle}</p>}
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-x-5 border-t border-white/10">
              {stats.filter(Boolean).map((s: any, i: number, arr: any[]) => (
                <div key={s.label} className={`py-3.5 ${i < arr.length - 2 ? "border-b border-white/10" : ""}`}>
                  <p className="text-[11px] font-semibold text-ink-3">{s.label}</p>
                  <p className="t-display mt-1 truncate text-title-3 text-ink">{s.value}</p>
                </div>
              ))}
            </div>

            {recap.achievements && recap.achievements.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                {recap.achievements.map((ach: any, i: number) => (
                  <motion.span
                    key={ach.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.9 + i * 0.07 }}
                    className="flex items-center gap-1.5 rounded-sm border border-gold/30 bg-gold/10 px-2.5 py-1 text-caption font-medium text-gold"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    {ach.title}
                  </motion.span>
                ))}
              </div>
            )}
          </div>

          <motion.div
            className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: "-120%" }}
            animate={{ x: "320%" }}
            transition={{ delay: 0.8, duration: 1.2, ease: "easeInOut" }}
          />
        </motion.article>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-8 w-full text-center">
          <p className="t-display text-title-1 text-ink">
            Stop scrolling. <span className="text-crimson">Start executing.</span>
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/")}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 btn-primary"
          >
            Lock in with {recap.creator?.name?.split(" ")[0] || "them"}
            <ArrowRight className="h-5 w-5" />
          </motion.button>
          <p className="mt-3 text-footnote text-ink-3">Free for students. College email required.</p>
        </motion.div>
      </div>
    </div>
  );
}
