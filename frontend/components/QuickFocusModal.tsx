"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { LockinMark } from "./ui/LockinLogo";
import { Play, Clock, Sparkles } from "lucide-react";
import { User } from "../app/types";
import { POINTS_NAME } from "../lib/brand";
import { saveTimer, startTimer } from "../lib/focusTimer";
import { prepareFocusNotifications } from "../lib/focusNotify";

interface QuickFocusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  api: (path: string, options?: any) => Promise<any>;
  setTab?: (tab: string) => void;
  refreshUser: () => Promise<void>;
  initialDuration?: number;
}

const PRESET_DURATIONS = [
  { label: "25m Sprint", minutes: 25, hint: "Classic Pomodoro" },
  { label: "45m Deep Work", minutes: 45, hint: "Recommended" },
  { label: "90m Monk Mode", minutes: 90, hint: "Peak Flow" },
  { label: "Stopwatch", minutes: 0, hint: "Open-ended" }
];

const GOAL_SUGGESTIONS = [
  { label: "DSA Grind", catId: 1 },
  { label: "Exam Prep", catId: 9 },
  { label: "Back & Biceps", catId: 8 },
  { label: "Ship Feature", catId: 1 },
  { label: "Deep Reading", catId: 9 }
];

export default function QuickFocusModal({
  open,
  onOpenChange,
  user,
  api,
  setTab,
  refreshUser,
  initialDuration = 45
}: QuickFocusModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(initialDuration);
  const [goal, setGoal] = useState<string>("");
  const [selectedCatId, setSelectedCatId] = useState<number>(1);
  const [launching, setLaunching] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Sync selected duration when prop changes or modal opens
  React.useEffect(() => {
    setSelectedMinutes(initialDuration);
  }, [initialDuration, open]);

  const handleLaunch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (launching) return;
    setLaunching(true);
    setError("");

    try {
      const title = goal.trim() || (selectedMinutes > 0 ? `${selectedMinutes}m Focus Sprint` : "Open Focus Session");
      const duration = selectedMinutes > 0 ? selectedMinutes : 25;
      const targetSecs = selectedMinutes > 0 ? selectedMinutes * 60 : 0;

      // 1. Create solo focus mission (created directly as Executing with workDuration: duration)
      const mission = await api("/missions", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: "Solo Pomodoro focus sprint on LOCKIN.",
          location: "Solo",
          datetime: new Date().toISOString(),
          categoryId: selectedCatId,
          focusDuration: duration,
          missionType: "solo",
          startNow: true
        })
      });

      const missionId = mission?.id;
      if (!missionId) throw new Error("Could not initialize mission coordinates.");

      const fullMission = {
        ...mission,
        id: missionId,
        title,
        status: "Executing",
        focus_duration: duration,
        work_duration: duration,
        showed_up: true
      };

      // 2. Persist timer state in localStorage and dispatch exact duration event
      if (typeof window !== "undefined") {
        // Anchored to wall-clock time, so it survives locked screens and reloads.
        saveTimer(user.id, startTimer(missionId, title, targetSecs));
        prepareFocusNotifications();
        localStorage.setItem("lockin_open_focus_overlay", "true");
        window.dispatchEvent(
          new CustomEvent("lockin:open-focus", {
            detail: {
              mission: fullMission,
              duration: targetSecs
            }
          })
        );
      }

      // 3. Clean up & transition to queue/active tab
      onOpenChange(false);
      setTab?.("active");
      await refreshUser();
    } catch (err: any) {
      console.error("Quick focus launch error:", err);
      setError(err?.message || "Failed to launch session. Please try again.");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-line bg-surface p-6 shadow-2xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 mb-2">
            <LockinMark size={22} color="rgb(var(--signal))" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">
              Stop scrolling. Start executing.
            </span>
          </div>
          <DialogTitle className="t-display text-2xl font-bold text-ink tracking-tight">
            Ready to lock in?
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            Launch a solo Pomodoro timer. Complete it to earn +10 {POINTS_NAME} and generate your verified story recap card.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLaunch} className="mt-4 space-y-4">
          {/* Target Duration Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-ink-3" /> Focus Target
              </span>
              <span className="text-[11px] text-ink-3 font-mono">
                {selectedMinutes > 0 ? `${selectedMinutes} minutes` : "Stopwatch mode"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRESET_DURATIONS.map((preset) => {
                const isSelected = selectedMinutes === preset.minutes;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSelectedMinutes(preset.minutes)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-crimson bg-crimson/10 shadow-sm"
                        : "border-line bg-raised/60 hover:border-line hover:bg-raised text-ink-3 hover:text-ink"
                    }`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? "text-ink" : "text-ink-2"}`}>
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-ink-4 mt-0.5">
                      {preset.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal Input with 1-Tap Chips */}
          <div>
            <label htmlFor="focus-goal" className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-2 block mb-1.5">
              What are you executing?
            </label>
            <input
              id="focus-goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. 5 LeetCode problems, Chest day, Essay draft"
              maxLength={80}
              className="h-11 w-full rounded-xl border border-line bg-raised px-3.5 text-sm text-ink placeholder:text-ink-4 focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson"
            />

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {GOAL_SUGGESTIONS.map((sug) => (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => {
                    setGoal(sug.label);
                    setSelectedCatId(sug.catId);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                    goal === sug.label
                      ? "border-crimson bg-crimson/15 text-ink font-semibold"
                      : "border-line bg-surface/80 text-ink-3 hover:text-ink hover:border-ink/40"
                  }`}
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-crimson font-medium" role="alert">
              {error}
            </p>
          )}

          {/* Action CTAs */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={launching}
              className="btn-primary h-12 w-full gap-2 text-sm font-bold uppercase tracking-wider shadow-lg"
            >
              <Play className="h-4 w-4 fill-current" />
              {launching ? "Starting Focus..." : `Lock In (${selectedMinutes > 0 ? `${selectedMinutes}m` : "Stopwatch"})`}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-center text-xs text-ink-4 hover:text-ink-2 transition-colors"
            >
              Skip for now · Browse campus missions
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
