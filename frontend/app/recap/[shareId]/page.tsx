"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, CheckCircle, Trophy, Sparkles, Flame, Users, ExternalLink, Download } from "lucide-react";
import Shell from "../../../components/Shell";
import Header from "../../../components/Header";
import LoadingScreen from "../../../components/LoadingScreen";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white px-4 text-center">
        <Trophy className="h-10 w-10 text-zinc-700 mb-3" />
        <h2 className="text-lg font-black uppercase tracking-wider text-white">Coordinates Lost</h2>
        <p className="mt-1.5 text-xs text-zinc-500 max-w-[280px] leading-relaxed">
          {error || "The recap card you are looking for does not exist or has expired."}
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 flex h-10 items-center justify-center px-6 rounded-xl border border-white/10 bg-white/5 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 transition"
        >
          Go to Lockin Dashboard
        </button>
      </div>
    );
  }

  // Formatting hours and minutes
  const hours = Math.floor(recap.sessionDuration / 60);
  const mins = recap.sessionDuration % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  // Theme Configs
  const themeMap: { [key: string]: { border: string; glow: string; text: string; bg: string } } = {
    session: {
      border: "border-cherryRed/30",
      glow: "from-cherryRed/15 via-luxuryMaroon/5 to-transparent",
      text: "text-cherryRed",
      bg: "bg-luxuryMaroon/10"
    },
    weekly: {
      border: "border-luxuryGold/30",
      glow: "from-luxuryGold/15 via-luxuryMaroon/5 to-transparent",
      text: "text-luxuryGold",
      bg: "bg-luxuryMaroon/10"
    },
    monthly: {
      border: "border-luxuryMaroon/40",
      glow: "from-luxuryMaroon/15 via-luxuryMaroon/5 to-transparent",
      text: "text-luxuryMaroon",
      bg: "bg-luxuryMaroon/20"
    },
    yearly: {
      border: "border-white/20",
      glow: "from-white/10 via-zinc-800/5 to-transparent",
      text: "text-white",
      bg: "bg-white/5"
    },
    team: {
      border: "border-cherryRed/35",
      glow: "from-cherryRed/20 via-luxuryMaroon/5 to-transparent",
      text: "text-cherryRed",
      bg: "bg-luxuryMaroon/15"
    }
  };

  const activeTheme = themeMap[recap.recapType] || themeMap.session;
  const isCollaborative = recap.participantCount && recap.participantCount > 1;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden selection:bg-luxuryGold selection:text-black">
      
      {/* Background radial overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-luxuryGold/10 to-transparent blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-md w-full flex flex-col items-center space-y-6">
        
        {/* Public Header */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="LOCKIN" className="h-6 w-6 object-contain" />
          <span className="font-display text-sm font-black uppercase tracking-widest text-white">LOCKIN</span>
        </div>

        {/* Public Card Box */}
        <div
          className={`relative overflow-hidden rounded-[2.5rem] border ${activeTheme.border} bg-zinc-950/80 w-full aspect-[9/16] flex flex-col justify-between p-8 shadow-2xl backdrop-blur-xl`}
        >
          {/* Drifting Spotlight Ambient Glow */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className={`absolute -top-1/4 -left-1/4 w-full h-full rounded-full bg-gradient-to-br ${activeTheme.glow} blur-[80px]`} />
          </div>

          {/* Top Info */}
          <div className="relative z-10 flex items-start justify-between w-full">
            <div>
              <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Focused Agent</span>
              <span className="text-[11px] font-black text-white uppercase block mt-0.5">{recap.creator?.name}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5 block truncate max-w-[150px]">
                {recap.creator?.department}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest bg-white/5 ${activeTheme.text}`}>
                {recap.recapType === "session" ? "SESSION CARD" : `${recap.recapType} wrapped`}
              </span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                {new Date(recap.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Hero metrics */}
          <div className="relative z-10 flex flex-col justify-center my-auto py-6">
            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight text-white leading-none">
              {timeDisplay}
            </h1>
            <p className="font-display text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
              LOCKED IN
            </p>
            {recap.missionTitle && (
              <p className="text-xs font-semibold text-zinc-500 mt-2.5 border-l border-white/10 pl-3 italic line-clamp-2">
                {recap.missionTitle}
              </p>
            )}
          </div>

          {/* Metrics List */}
          <div className="relative z-10 grid grid-cols-2 gap-4 w-full">
            {recap.recapType === "session" ? (
              <>
                <div className="border-t border-white/5 pt-2 text-left">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Tasks Completed</span>
                  <span className="text-xs font-black text-white">{recap.tasksCompleted} Tasks</span>
                </div>
                <div className="border-t border-white/5 pt-2 text-left">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Streak</span>
                  <span className="text-xs font-black text-white">{recap.streak} Days</span>
                </div>
                {recap.missionRank && (
                  <div className="border-t border-white/5 pt-2 text-left">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Rank in Run</span>
                    <span className="text-xs font-black text-white">
                      #{recap.missionRank} {isCollaborative ? "MVP" : "Contributor"}
                    </span>
                  </div>
                )}
                {recap.categorySnapshot && (
                  <div className="border-t border-white/5 pt-2 text-left">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Category</span>
                    <span className="text-xs font-black text-white truncate max-w-[130px] block">{recap.categorySnapshot}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="border-t border-white/5 pt-2 text-left">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Tasks Completed</span>
                  <span className="text-xs font-black text-white">{recap.tasksCompleted} Tasks</span>
                </div>
                <div className="border-t border-white/5 pt-2 text-left">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Current Streak</span>
                  <span className="text-xs font-black text-white">{recap.streak} Days</span>
                </div>
                <div className="border-t border-white/5 pt-2 text-left">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Total Runs</span>
                  <span className="text-xs font-black text-white">
                    {recap.metadata?.missionsCompleted ?? 0} Sessions
                  </span>
                </div>
                {recap.categorySnapshot && (
                  <div className="border-t border-white/5 pt-2 text-left">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Top Category</span>
                    <span className="text-xs font-black text-white truncate max-w-[130px] block">{recap.categorySnapshot}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Unlocked Badges */}
          {recap.achievements && recap.achievements.length > 0 && (
            <div className="relative z-10 border-t border-white/5 pt-3 w-full mt-2">
              <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Achievements Unlocked</span>
              <div className="flex flex-wrap gap-1.5">
                {recap.achievements.map((ach: any) => (
                  <div
                    key={ach.id}
                    className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/4 px-2 py-1 shadow-sm"
                  >
                    <Trophy className={`h-2.5 w-2.5 ${activeTheme.text}`} />
                    <span className="text-[9px] font-black text-white uppercase tracking-wider">{ach.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer branding */}
          <div className="relative z-10 border-t border-white/5 pt-3 w-full mt-4 flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-zinc-600">
            <span>LOCKIN.GG PRODUCTIVITY</span>
            <span>PUBLIC SHARE LINK</span>
          </div>
        </div>

        {/* CTA Join LOCKIN */}
        <div className="w-full space-y-3">
          <button
            onClick={() => router.push("/")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-luxuryGold text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-[0_0_20px_rgba(197,168,128,0.25)] hover:bg-luxuryGold/95 transition active:scale-[0.98]"
          >
            Join LOCKIN Platform
            <ExternalLink className="h-4 w-4" />
          </button>
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider text-center">
            Sign up to lock in with peer groups and sync your aura.
          </p>
        </div>

      </div>
    </div>
  );
}
