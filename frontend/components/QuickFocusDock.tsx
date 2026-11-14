"use client";

import React, { useEffect, useState } from "react";
import { Play, Clock, Sparkles, Activity } from "lucide-react";
import { User } from "../app/types";
import { displaySec, formatClock, loadTimer } from "../lib/focusTimer";

interface QuickFocusDockProps {
  user: User;
  onOpenModal: (minutes?: number) => void;
  setTab?: (tab: string) => void;
}

export default function QuickFocusDock({ user, onOpenModal, setTab }: QuickFocusDockProps) {
  const [activeSession, setActiveSession] = useState<{ missionId: number; timeLeft: number } | null>(null);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const checkTimer = () => {
      const t = loadTimer(user.id);
      setActiveSession(t ? { missionId: t.missionId, timeLeft: displaySec(t) } : null);
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [user]);

  const handleResume = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lockin_open_focus_overlay", "true");
      window.dispatchEvent(new CustomEvent("lockin:open-focus"));
    }
    setTab?.("active");
  };

  if (activeSession) {
    const timeFormatted = formatClock(activeSession.timeLeft);

    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/25 p-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Focus Session Active
              </span>
              <span className="font-mono text-[11px] font-bold text-white">
                {timeFormatted}
              </span>
            </div>
            <p className="text-xs text-ink-3">Your Pomodoro timer is executing in background.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResume}
          className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-emerald-400"
        >
          Resume
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-line bg-raised/70 p-3.5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-crimson/40 bg-crimson/15 text-crimson">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Pomodoro Focus
              </span>
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-crimson px-1.5 py-0.2 rounded-full border border-crimson/30 bg-crimson/10">
                Solo Sprint
              </span>
            </div>
            <p className="text-[11px] text-ink-3">Stop scrolling. Pick a timer and execute.</p>
          </div>
        </div>

        {/* 1-Tap Preset Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenModal(25)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:border-ink/40 hover:text-ink"
          >
            25m
          </button>
          <button
            type="button"
            onClick={() => onOpenModal(45)}
            className="rounded-lg border border-crimson/50 bg-crimson/10 px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-crimson/20"
          >
            45m
          </button>
          <button
            type="button"
            onClick={() => onOpenModal(90)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:border-ink/40 hover:text-ink"
          >
            90m
          </button>
          <button
            type="button"
            onClick={() => onOpenModal(45)}
            className="btn-primary h-8 px-3 text-[11px] font-bold uppercase tracking-wider ml-1"
          >
            <Play className="h-3 w-3 fill-current mr-1" /> Lock In
          </button>
        </div>
      </div>
    </div>
  );
}
