"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, MapPin, Check, X, MessageSquare, ShieldAlert, AlertCircle, Sparkles, Trophy, Plus, Trash2, CheckSquare, Square, FileText, Flame, Play, Pause, Users, Calendar, Download } from "lucide-react";
import { User, Mission } from "../app/types";
import Chat from "./Chat";
import RecapCard from "./RecapCard";
import PublicProfile from "./PublicProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  TimerAnchor,
  FocusTimerDisplay,
  anchorFromPersisted,
  createCountdownAnchor,
  createStopwatchAnchor,
  getElapsedSeconds,
  persistTimer,
  readPersistedTimer,
  toggleTimerRunning,
} from "./FocusTimer";

interface ActiveMissionsProps {
  user: User;
  refreshUser: () => Promise<void>;
  api: (path: string, options?: RequestInit) => Promise<any>;
  socketUrl: string;
}

export default function ActiveMissions({ user, refreshUser, api, socketUrl }: ActiveMissionsProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chatMission, setChatMission] = useState<Mission | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputCodes, setInputCodes] = useState<{ [missionId: string | number]: string }>({});
  const [errors, setErrors] = useState<{ [missionId: string | number]: string }>({});
  const [submitting, setSubmitting] = useState<{ [missionId: string | number]: boolean }>({});
  const [tasksCompletedInput, setTasksCompletedInput] = useState<{ [missionId: string | number]: string }>({});
  const [recapData, setRecapData] = useState<any | null>(null);
  const [showRecapCard, setShowRecapCard] = useState(false);

  // New V2 states
  const [missionTasks, setMissionTasks] = useState<{ [missionId: string | number]: any[] }>({});
  const [loadingTasks, setLoadingTasks] = useState<{ [missionId: string | number]: boolean }>({});
  const [newTaskTitles, setNewTaskTitles] = useState<{ [missionId: string | number]: string }>({});

  const [activeReflectionMission, setActiveReflectionMission] = useState<Mission | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [isPublicReflection, setIsPublicReflection] = useState(true);
  const [submittingReflection, setSubmittingReflection] = useState(false);
  
  // V2 reflection attachments & exit states
  const [reflectionDuration, setReflectionDuration] = useState<number>(25);
  const [isFailedRun, setIsFailedRun] = useState<boolean>(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [attachLink, setAttachLink] = useState<string>("");

  // Timer: parent only stores an anchor (no per-second setState)
  const [activeFocusMission, setActiveFocusMission] = useState<Mission | null>(null);
  const [timerAnchor, setTimerAnchor] = useState<TimerAnchor | null>(null);
  const [focusOverlayOpen, setFocusOverlayOpen] = useState(false);
  const [showTimerSelector, setShowTimerSelector] = useState<string | number | null>(null);
  const timerRestoredRef = useRef(false);
  const pendingDurationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    persistTimer(user.id, timerAnchor);
  }, [timerAnchor, user?.id]);

  // Restore timer once after missions first load — never on every 15s poll
  useEffect(() => {
    if (!user || loading || timerRestoredRef.current) return;
    timerRestoredRef.current = true;
    const saved = readPersistedTimer(user.id);
    if (!saved) return;
    const mission = missions.find((m) => m.id === saved.missionId);
    if (mission && mission.status === "Executing") {
      setActiveFocusMission(mission);
      setTimerAnchor(anchorFromPersisted(saved));
      setFocusOverlayOpen(true);
    } else {
      persistTimer(user.id, null);
    }
  }, [missions, user, loading]);

  const handleTimerComplete = useCallback(() => {
    setTimerAnchor((prev) =>
      prev
        ? {
            ...prev,
            running: false,
            endAt: null,
            pausedLeft: 0,
          }
        : prev
    );
    if (typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("AudioContext block", e);
    }
  }, []);

  const startFocusSession = useCallback((mission: Mission, durationSec: number) => {
    setActiveFocusMission(mission);
    setTimerAnchor(
      durationSec > 0
        ? createCountdownAnchor(mission.id, durationSec, true)
        : createStopwatchAnchor(mission.id, true)
    );
    setFocusOverlayOpen(true);
  }, []);

  async function load() {
    try {
      const active = await api(`/missions/active/${user.id}`);
      setMissions(active);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks(missionId: string | number) {
    setLoadingTasks(prev => ({ ...prev, [missionId]: true }));
    try {
      const tasks = await api(`/tasks/mission/${missionId}`);
      setMissionTasks(prev => ({ ...prev, [missionId]: tasks }));
    } catch (err) {
      console.error("Error loading tasks", err);
    } finally {
      setLoadingTasks(prev => ({ ...prev, [missionId]: false }));
    }
  }

  async function handleToggleTask(missionId: string | number, taskId: number) {
    setMissionTasks((prev) => ({
      ...prev,
      [missionId]: (prev[missionId] || []).map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
    }));
    try {
      await api(`/tasks/${taskId}/toggle`, { method: "PUT" });
    } catch (err) {
      console.error("Failed to toggle task", err);
      await loadTasks(missionId);
    }
  }

  async function handleAddTask(missionId: string | number) {
    const title = newTaskTitles[missionId] || "";
    if (!title.trim()) return;
    const optimisticId = -Date.now();
    const position = (missionTasks[missionId] || []).length;
    setNewTaskTitles((prev) => ({ ...prev, [missionId]: "" }));
    setMissionTasks((prev) => ({
      ...prev,
      [missionId]: [
        ...(prev[missionId] || []),
        { id: optimisticId, title: title.trim(), completed: false, position },
      ],
    }));
    try {
      await api(`/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), missionId, position }),
      });
      await loadTasks(missionId);
    } catch (err) {
      console.error("Failed to add task", err);
      await loadTasks(missionId);
    }
  }

  async function handleDeleteTask(missionId: string | number, taskId: number) {
    setMissionTasks((prev) => ({
      ...prev,
      [missionId]: (prev[missionId] || []).filter((t) => t.id !== taskId),
    }));
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete task", err);
      await loadTasks(missionId);
    }
  }

  function initiateFinishSession(mission: Mission) {
    let elapsed = 0;
    const durationSec = timerAnchor?.durationSec ?? 0;
    if (activeFocusMission && activeFocusMission.id === mission.id && timerAnchor) {
      elapsed = getElapsedSeconds(timerAnchor);
    } else {
      elapsed = (mission.focus_duration || 25) * 60;
    }
    const actualMins = Math.max(1, Math.round(elapsed / 60));
    const timeLeft = timerAnchor ? Math.max(0, durationSec - elapsed) : 0;

    let failed = false;
    if (activeFocusMission && activeFocusMission.id === mission.id && durationSec > 0) {
      const tasksList = missionTasks[mission.id] || [];
      const tasksCompleted = tasksList.filter((t) => t.completed).length;
      const underHalf = elapsed < durationSec * 0.5;
      const noTasks = tasksCompleted === 0;
      const underThreeMins = elapsed < 180;
      if ((underHalf && noTasks) || underThreeMins) {
        failed = true;
      }
    }

    if (activeFocusMission && activeFocusMission.id === mission.id && durationSec > 0 && timeLeft > 0) {
      const confirmEnd = window.confirm(
        "Are you sure you want to end before the target time?\n\n" +
          `You have only focused for ${actualMins} minute(s).\n` +
          (failed ? "WARNING: This will count as a RUNWAY CRASH (5 Aura penalty)." : "")
      );
      if (!confirmEnd) return;
    }

    setReflectionDuration(actualMins);
    setIsFailedRun(failed);
    setActiveReflectionMission(mission);
    setReflectionText("");
    setLessonsLearned("");
    setIsPublicReflection(true);
    setScreenshotBase64(null);
    setAttachLink("");
  }

  async function submitFinishSession() {
    if (!activeReflectionMission) return;
    setSubmittingReflection(true);
    try {
      const missionId = activeReflectionMission.id;
      const tasksList = missionTasks[missionId] || [];
      const tasksCompleted = tasksList.length > 0
        ? tasksList.filter(t => t.completed).length
        : Number(tasksCompletedInput[missionId] || 0);

      const result = await api(`/missions/${missionId}/finish`, {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          tasksCompleted,
          sessionDuration: reflectionDuration,
          isFailed: isFailedRun,
          reflection: {
            reflectionText: reflectionText.trim() || null,
            lessonsLearned: lessonsLearned.trim() || null,
            isPublic: isPublicReflection,
            screenshot: screenshotBase64,
            link: attachLink.trim() || null
          }
        })
      });

      setRecapData(result);
      setShowRecapCard(true);
      setActiveReflectionMission(null);
      setActiveFocusMission(null);
      setTimerAnchor(null);
      setFocusOverlayOpen(false);
      await Promise.all([load(), refreshUser()]);
    } catch (err: any) {
      alert(err.message || "Failed to finish focus session.");
    } finally {
      setSubmittingReflection(false);
    }
  }

  async function handleViewMissionRecap(missionId: string | number) {
    try {
      const result = await api(`/recaps/mission/${missionId}/user/${user.id}`);
      setRecapData(result);
      setShowRecapCard(true);
    } catch (err: any) {
      alert("No recap data saved for this past mission.");
    }
  }

  async function handleVibeCheck(missionId: string | number, rating: "W" | "L") {
    try {
      await api(`/missions/${missionId}/vibe-check`, {
        method: "POST",
        body: JSON.stringify({ raterId: user.id, rating })
      });
      await Promise.all([load(), refreshUser()]);
      alert("Vibe check submitted successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to submit vibe check.");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      load();
    }, 15000); // refresh every 15s for faster request/check-in updates
    return () => clearInterval(interval);
  }, [user.id]);

  useEffect(() => {
    missions.forEach(m => {
      if (m.status === "Executing" && !missionTasks[m.id]) {
        loadTasks(m.id);
      }
    });
  }, [missions]);

  async function handleApprove(missionId: string | number, participantId: number) {
    try {
      await api(`/missions/${missionId}/approve-participant`, {
        method: "POST",
        body: JSON.stringify({ creatorId: user.id, participantId })
      });
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to approve request.");
    }
  }

  async function handleAttendance(missionId: string | number, showedUp: boolean, targetParticipantId?: number) {
    const code = inputCodes[missionId] || "";
    const pId = targetParticipantId || user.id; // if creator calls, it passes the participant's ID

    setErrors((prev) => ({ ...prev, [missionId]: "" }));
    setSubmitting((prev) => ({ ...prev, [missionId]: true }));

    try {
      await api(`/missions/${missionId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ userId: pId, showedUp, code })
      });
      const updatedList = await api(`/missions/active/${user.id}`);
      setMissions(updatedList);
      await refreshUser();

      // Automatically enter fullscreen focus mode if session is now executing
      if (showedUp) {
        const currentM = updatedList.find((m: any) => m.id === missionId);
        if (currentM && currentM.status === "Executing") {
          const durationSec =
            pendingDurationRef.current !== null
              ? pendingDurationRef.current
              : 0;
          pendingDurationRef.current = null;
          startFocusSession(currentM, durationSec);
        }
      }
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [missionId]: err.message || "Failed to submit." }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [missionId]: false }));
    }
  }

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const getGoogleCalendarUrl = (mission: Mission) => {
    const title = encodeURIComponent(mission.title || "LockIn Mission");
    const descText = `${mission.description || ""}\n\nHost: ${mission.creator_name || "Unknown"}\nLocation: ${mission.location || "Runway"}\nLocked in with: ${mission.participant_name || "Solo"}`;
    const details = encodeURIComponent(descText);
    const location = encodeURIComponent(mission.location || "");
    
    const startDate = mission.datetime ? new Date(mission.datetime) : new Date();
    const isValidDate = !isNaN(startDate.getTime());
    const actualStart = isValidDate ? startDate : new Date();
    const durationMin = mission.focus_duration || 60;
    const endDate = new Date(actualStart.getTime() + durationMin * 60 * 1000);
    
    const formatGCalDate = (date: Date) => {
      try {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      } catch (e) {
        return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      }
    };
    
    const dates = `${formatGCalDate(actualStart)}/${formatGCalDate(endDate)}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  const downloadICS = (mission: Mission) => {
    const title = mission.title || "LockIn Mission";
    const descText = `${mission.description || ""}\n\nHost: ${mission.creator_name || "Unknown"}\nLocation: ${mission.location || "Runway"}\nLocked in with: ${mission.participant_name || "Solo"}`;
    const location = mission.location || "Runway";
    
    const startDate = mission.datetime ? new Date(mission.datetime) : new Date();
    const isValidDate = !isNaN(startDate.getTime());
    const actualStart = isValidDate ? startDate : new Date();
    const durationMin = mission.focus_duration || 60;
    const endDate = new Date(actualStart.getTime() + durationMin * 60 * 1000);
    
    const formatICSDate = (date: Date) => {
      try {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      } catch (e) {
        return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      }
    };
    
    const escapeICS = (str: string) => {
      return str
        .replace(/[\\,;]/g, (match) => `\\${match}`)
        .replace(/\n/g, "\\n");
    };
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LockIn//Mission Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:mission-${mission.id}@lockin.app`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(actualStart)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeICS(title)}`,
      `DESCRIPTION:${escapeICS(descText)}`,
      `LOCATION:${escapeICS(location)}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30) || "mission";
    link.download = `${safeTitle}.ics`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isDue = (datetime: string | null) => {
    if (!datetime) return false;
    return new Date(datetime).getTime() <= Date.now();
  };

  const timeLeft = (datetime: string | null) => {
    if (!datetime) return "Ready";
    const diff = new Date(datetime).getTime() - Date.now();
    if (diff <= 0) return "Ready";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${minutes}m`;
  };

  const pendingReviews = missions.filter(
    (mission) => mission.showed_up === null && isDue(mission.datetime) && mission.status === "Accepted"
  ).length;

  return (
    <section className="mx-auto w-full max-w-md md:max-w-5xl flex-1 px-4 py-4 pb-24 md:pb-6 space-y-6">
      {/* Title block */}
      <div className="flex items-end justify-between border-b border-white/5 pb-4">
        <div>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-cherryRed">
            Execution Queue
          </span>
          <h2 className="text-xl md:text-3xl font-bold text-cotton tracking-tight mt-1">Active Runs</h2>
        </div>
        <div className="rounded-xl md:rounded-2xl border border-white/5 bg-zinc-950/45 px-3 md:px-5 py-1.5 md:py-2.5 text-right">
          <span className="block text-[8px] md:text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Completed
          </span>
          <span className="text-sm md:text-lg font-black text-cherryRed">
            {missions.filter((m) => m.status === "Completed").length}
          </span>
        </div>
      </div>

      {/* Pending join requests banner for creators */}
      {(() => {
        const pendingRequests = missions.filter(
          (m) => m.role === "creator" && m.status === "Requested"
        ).length;
        return pendingRequests > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-cherryRed/35 bg-cherryRed/5 p-3.5 md:p-4.5"
          >
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-cherryRed shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-wider leading-none">
                {pendingRequests} Join Request{pendingRequests > 1 ? "s" : ""} Waiting
              </h4>
              <p className="mt-1 text-[11px] md:text-xs font-medium leading-normal text-zinc-400">
                Review and approve who locks in with you. Scroll down to see them.
              </p>
            </div>
          </motion.div>
        ) : null;
      })()}

      {/* Attendance check alert */}
      {pendingReviews > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-cherryRed/35 bg-cherryRed/5 p-3.5 md:p-4.5"
        >
          <ShieldAlert className="h-4 w-4 md:h-5 md:w-5 text-cherryRed shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-wider leading-none">
              Attendance check required
            </h4>
            <p className="mt-1 text-[11px] md:text-xs font-medium leading-normal text-zinc-400">
              Confirm who showed up on {pendingReviews} due runway{pendingReviews > 1 ? "s" : ""} to sync Aura.
            </p>
          </div>
        </motion.div>
      )}

      {/* Queue items */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-20 text-xs md:text-sm font-bold text-zinc-600 uppercase tracking-widest">
            Syncing queue...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-white/5 bg-zinc-950/10 p-8">
            <p className="text-xs md:text-sm font-bold text-zinc-600 uppercase tracking-widest">Queue Empty</p>
            <p className="mt-2 text-xs md:text-sm text-zinc-500 leading-relaxed max-w-[240px] mx-auto">
              Accept targets from the discovery board or launch a new runway.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0">
            {missions.map((mission, idx) => {
              const isSolo = mission.mission_type === "solo";
              const due = isDue(mission.datetime) || isSolo;
              const isCreator = mission.role === "creator" || isSolo;
              const isRequest = mission.status === "Requested";
              const active = mission.status === "Accepted";
              const needsReview = mission.showed_up === null && due && active && !isSolo;
              
              let statusLabel = mission.status || "Pending";
              let statusColor = "border-zinc-800 bg-noirBlack/40 text-cotton/60";

              if (isRequest) {
                statusLabel = "Request";
                statusColor = "border-zinc-800 bg-zinc-900/50 text-zinc-400";
              } else if (active) {
                statusLabel = isSolo ? "Solo Active" : "Active";
                statusColor = "border-cherryRed/45 bg-cherryRed/5 text-cherryRed";
              } else if (mission.status === "Executing") {
                statusLabel = "LOCKED IN";
                statusColor = "border-cherryRed/50 bg-[#D2042D] text-cotton shadow-[0_0_15px_rgba(210,4,45,0.15)]";
              } else if (mission.status === "Completed") {
                statusLabel = "Completed";
                statusColor = "border-zinc-800 bg-zinc-900/50 text-cotton shadow-[0_0_15px_rgba(255,255,255,0.05)]";
              } else if (mission.status === "Missed") {
                statusLabel = "Missed";
                statusColor = "border-cherryRed/25 bg-cherryRed/10 text-cherryRed";
              }

              let roleLabel = "";
              if (isSolo) {
                roleLabel = "Solo Focus";
              } else if (isCreator) {
                roleLabel = `Host (Participant: ${mission.participant_name})`;
              } else {
                roleLabel = `Partner: ${mission.creator_name}`;
              }

              return (
                <motion.article
                  key={`${mission.id}-${mission.role}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`relative overflow-hidden rounded-2xl border bg-noirBlack/45 p-4 md:p-6 shadow-sm backdrop-blur-md transition hover:scale-[1.01] hover:border-white/10 ${
                    needsReview ? "border-cherryRed/40 ring-1 ring-cherryRed/10" : "border-zinc-900"
                  }`}
                  style={{
                    borderColor: mission.cover_color ? `${mission.cover_color}55` : undefined,
                    boxShadow: mission.cover_color ? `0 4px 20px rgba(0,0,0,0.4), 0 0 15px ${mission.cover_color}12` : undefined
                  }}
                >
                  {/* Optional Mission Cover Background */}
                  {mission.cover_image && (
                    <div 
                      className="absolute inset-0 z-0 opacity-[0.12] pointer-events-none"
                      style={{ 
                        background: mission.cover_image.includes("gradient") 
                          ? mission.cover_image 
                          : `url(${mission.cover_image}) center/cover no-repeat`
                      }}
                    />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3 mb-3.5 text-left">
                      <div>
                        <h3 className="text-sm md:text-base lg:text-lg font-black text-white leading-tight">
                          {mission.title}
                        </h3>
                        <p className="mt-1 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          {roleLabel}
                        </p>
                        {/* RSVP Count */}
                        {mission.locked_in_count !== undefined && mission.locked_in_count > 2 && (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] md:text-xs font-bold text-zinc-400">
                            <Users className="h-3.5 w-3.5 text-luxuryGold shrink-0" />
                            <span>{mission.locked_in_count} people locked in</span>
                          </div>
                        )}
                      </div>
                      <span className={`rounded-md border px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs font-black uppercase tracking-wider shrink-0 h-fit ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Timing & Location */}
                    <div className="grid grid-cols-2 gap-3.5 text-xs md:text-sm font-bold text-cotton/80 mb-4.5 text-left">
                      <div className="flex items-center gap-2.5 rounded-xl border border-luxuryMaroon/15 bg-[#1B1716]/40 p-2.5 md:p-3.5">
                        <CalendarClock className="h-3.5 w-3.5 md:h-4.5 md:w-4.5 text-luxuryGold shrink-0" />
                        <span className="text-cotton/90">
                          {isSolo ? "Start Anytime" : (due ? "Ready" : timeLeft(mission.datetime))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl border border-luxuryMaroon/15 bg-[#1B1716]/40 p-2.5 md:p-3.5">
                        <MapPin className="h-3.5 w-3.5 md:h-4.5 md:w-4.5 text-cherryRed shrink-0" />
                        <span className="truncate text-cotton/90">
                          {isSolo ? "Solo Runway" : mission.location}
                        </span>
                      </div>
                    </div>

                    {/* Attendee Profiles */}
                    {mission.attendees && mission.attendees.length > 0 && (
                      <div className="mb-4.5 space-y-2 text-left">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                          Locked In Crew
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {mission.attendees.slice(0, 3).map((attendee) => (
                            <button
                              key={attendee.id}
                              type="button"
                              onClick={() => setSelectedUserId(attendee.id)}
                              className="flex items-center gap-1.5 rounded-full border border-white/5 bg-black/30 pl-1 pr-2.5 py-1 text-[10px] font-semibold text-cotton/90 hover:border-luxuryGold/40 hover:bg-black/50 transition cursor-pointer"
                            >
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cherryRed/10 border border-cherryRed/20 text-[8px] font-black text-cherryRed shrink-0">
                                {getInitials(attendee.name)}
                              </div>
                              <span className="truncate max-w-[80px]">{attendee.name}</span>
                            </button>
                          ))}
                          {mission.attendees.length > 3 && (
                            <div className="flex h-7 items-center justify-center rounded-full border border-white/5 bg-black/30 px-2.5 text-[9px] font-bold text-zinc-500">
                              +{mission.attendees.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Calendar Integration */}
                    {!isSolo && mission.status !== "Completed" && mission.status !== "Missed" && (
                      <div className="mb-4.5 flex flex-wrap gap-2 text-left">
                        <a
                          href={getGoogleCalendarUrl(mission)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-luxuryGold/20 bg-luxuryGold/5 px-2.5 text-[10px] font-bold text-luxuryGold hover:bg-luxuryGold/10 transition"
                        >
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>Google Calendar</span>
                        </a>
                        <button
                          onClick={() => downloadICS(mission)}
                          className="flex-1 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] font-bold text-cotton/80 hover:bg-white/10 transition"
                        >
                          <Download className="h-3 w-3 shrink-0" />
                          <span>Export .ics</span>
                        </button>
                      </div>
                    )}

                  {/* 1. Request Review Box (Creator Only) */}
                  {isCreator && isRequest && !isSolo && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-3.5 rounded-xl border border-cherryRed/20 bg-cherryRed/5 p-3 md:p-4.5 text-left space-y-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton">
                            Join Request Received
                          </p>
                          <p className="text-[9px] md:text-xs text-zinc-500 font-semibold mt-0.5">
                            Dept: {mission.participant_department}
                          </p>
                        </div>
                        <div className="rounded-lg border border-cherryRed/20 bg-cherryRed/5 px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs font-black text-cherryRed flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> {mission.participant_reputation} Aura
                        </div>
                      </div>
                      
                      <button
                        onClick={() => mission.participant_id && handleApprove(mission.id, mission.participant_id)}
                        className="flex h-9 md:h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-cherryRed text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton transition hover:bg-cherryRed/95"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" /> Approve Request
                      </button>
                    </motion.div>
                  )}

                  {/* 2. Participant Request Pending state */}
                  {!isCreator && isRequest && (
                    <div className="mb-3.5 rounded-xl border border-zinc-800 bg-zinc-900/55 p-3.5 md:p-4.5 text-center">
                      <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-zinc-400">
                        Join Requested
                      </p>
                      <p className="text-[9px] md:text-xs text-zinc-500 font-semibold mt-0.5">
                        Waiting for {mission.creator_name} to approve your lock-in request...
                      </p>
                    </div>
                  )}

                  {/* 3. Confirmed Active Review / OTP Code check */}
                  {active && (
                    <div className="space-y-3">
                      {isSolo ? (
                        <div className="rounded-xl border border-cherryRed/20 bg-cherryRed/5 p-4 text-center">
                          <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton">
                            SOLO RUNWAY READY
                          </p>
                          {showTimerSelector === mission.id ? (
                            <div className="mt-3.5 space-y-3 text-left">
                              <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500">
                                Choose Focus Session Duration:
                              </label>
                              <div className="grid grid-cols-2 gap-2 text-xs font-black uppercase tracking-wider text-cotton">
                                {[
                                  { label: "25 Min", value: 25 },
                                  { label: "50 Min", value: 50 },
                                  { label: "90 Min", value: 90 },
                                  { label: "Stopwatch", value: 0 },
                                ].map((opt) => (
                                  <button
                                    key={opt.label}
                                    onClick={async () => {
                                      pendingDurationRef.current = opt.value * 60;
                                      setShowTimerSelector(null);
                                      await handleAttendance(mission.id, true);
                                    }}
                                    className="h-10 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-cherryRed/10 hover:border-cherryRed/30 transition text-center"
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setShowTimerSelector(null)}
                                className="w-full h-8 text-[9px] font-black uppercase tracking-wider text-zinc-500 text-center hover:text-cotton transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="text-[9px] md:text-xs text-zinc-500 font-semibold mt-1">
                                Ready to lock in? Choose your focus timer and start.
                              </p>
                              <button
                                onClick={() => setShowTimerSelector(mission.id)}
                                disabled={submitting[mission.id]}
                                className="mt-3.5 w-full flex h-10 items-center justify-center gap-1.5 rounded-lg bg-cherryRed text-xs font-black uppercase tracking-wider text-cotton shadow-[0_0_15px_rgba(129,1,0,0.15)] hover:bg-[#810100]/95 transition active:scale-[0.98]"
                              >
                                <Check className="h-4 w-4 stroke-[3]" /> Start Focus Session
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Creator Code display */}
                          {isCreator && due && (
                            <div className="rounded-xl border border-cherryRed/20 bg-cherryRed/5 p-3.5 md:p-4.5 text-center">
                              <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton">
                                Meetup Verification Code
                              </p>
                              <p className="text-[9px] md:text-xs text-zinc-500 font-semibold mt-0.5">
                                Share this OTP with {mission.participant_name} to check in:
                              </p>
                              <div className="mt-2.5 text-2xl md:text-3xl font-black tracking-widest text-cherryRed bg-black/40 rounded-lg py-1 md:py-2.5 max-w-[120px] md:max-w-[150px] mx-auto border border-cherryRed/20 shadow-[0_0_15px_rgba(129,1,0,0.1)]">
                                {mission.verification_code}
                              </div>
                            </div>
                          )}

                          {/* Participant OTP Entry box */}
                          {!isCreator && due && (
                            <div className="rounded-xl border border-cherryRed/20 bg-cherryRed/5 p-3.5 md:p-4.5 text-left space-y-2.5">
                              <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton">
                                Enter Verification OTP
                              </p>
                              <p className="text-[9px] md:text-xs text-zinc-500 font-semibold">
                                Get the 4-digit code from {mission.creator_name} to complete runway.
                              </p>
                              
                              <div className="flex gap-2.5">
                                <input
                                  type="text"
                                  maxLength={4}
                                  placeholder="0000"
                                  value={inputCodes[mission.id] || ""}
                                  onChange={(e) => setInputCodes({ ...inputCodes, [mission.id]: e.target.value.replace(/\D/g, "") })}
                                  className="h-9 md:h-11 w-24 md:w-32 rounded-lg border border-zinc-800 bg-zinc-900/40 text-center text-sm md:text-base font-black tracking-widest text-cotton outline-none focus:border-cherryRed"
                                />
                                <button
                                  onClick={() => handleAttendance(mission.id, true)}
                                  disabled={submitting[mission.id]}
                                  className="flex-1 flex h-9 md:h-11 items-center justify-center gap-1.5 rounded-lg bg-cherryRed text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton transition hover:bg-cherryRed/95 disabled:opacity-50"
                                >
                                  <Check className="h-3.5 w-3.5 stroke-[3]" /> Verify & Check In
                                </button>
                              </div>
                            </div>
                          )}

                          {errors[mission.id] && (
                            <p className="text-[10px] md:text-xs font-bold text-cherryRed text-center">
                              {errors[mission.id]}
                            </p>
                          )}

                          {/* Creator control: can mark participant as missed */}
                          {isCreator && due && (
                            <button
                              onClick={() => handleAttendance(mission.id, false, mission.participant_id)}
                              disabled={submitting[mission.id]}
                              className="flex h-9 md:h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-cherryRed/30 bg-cherryRed/5 text-[10px] md:text-xs font-black uppercase tracking-wider text-cherryRed hover:bg-cherryRed/10 transition disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5 stroke-[3]" /> Participant No-Show
                            </button>
                          )}

                          {/* Participant self-report missed */}
                          {!isCreator && due && (
                            <button
                              onClick={() => handleAttendance(mission.id, false)}
                              disabled={submitting[mission.id]}
                              className="flex h-9 md:h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-[10px] md:text-xs font-bold uppercase tracking-wider text-cotton/80 hover:text-cotton hover:bg-zinc-800 transition disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5 stroke-[2]" /> I missed this meetup
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Executing Status Workspace */}
                  {mission.status === "Executing" && (
                    <div className="mt-3.5 space-y-3">
                      <div className="rounded-xl border border-cherryRed/25 bg-cherryRed/5 p-3 text-center">
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-cotton">
                          LOCKED IN & EXECUTING
                        </p>
                        <p className="text-[9px] md:text-xs text-zinc-500 font-semibold mt-1">
                          You are currently focused on this mission. Complete your work below.
                        </p>
                        <button
                          onClick={() => {
                            if (activeFocusMission?.id === mission.id && timerAnchor) {
                              setFocusOverlayOpen(true);
                            } else {
                              startFocusSession(mission, 0);
                            }
                          }}
                          className="mt-3 w-full flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cherryRed text-xs font-black uppercase tracking-wider text-cotton shadow-[0_0_15px_rgba(129,1,0,0.15)] hover:bg-[#810100]/95 transition active:scale-[0.98]"
                        >
                          <Flame className="h-4 w-4 stroke-[3]" /> Open Fullscreen Focus
                        </button>
                      </div>

                      {/* Checklist Tasks */}
                      <div className="mt-3 space-y-2 text-left bg-black/30 p-3.5 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                            Task Checklist
                          </h4>
                          {missionTasks[mission.id] && (
                            <span className="text-[10px] font-black text-cherryRed">
                              {missionTasks[mission.id].filter(t => t.completed).length} / {missionTasks[mission.id].length} Done
                            </span>
                          )}
                        </div>
                        
                        {/* Task input to add a task on the fly */}
                        <div className="flex gap-2">
                          <Input
                            value={newTaskTitles[mission.id] || ""}
                            onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [mission.id]: e.target.value }))}
                            placeholder="Add new checklist item..."
                            className="h-8 border-white/5 bg-black/40 text-[11px] text-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTask(mission.id);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTask(mission.id)}
                            className="h-8 px-2.5 rounded-lg bg-cherryRed/15 border border-cherryRed/30 text-[10px] text-cotton font-black hover:bg-cherryRed/30 transition shrink-0"
                          >
                            Add
                          </button>
                        </div>

                        {loadingTasks[mission.id] ? (
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-center py-2 animate-pulse">Syncing tasks...</p>
                        ) : (missionTasks[mission.id] || []).length === 0 ? (
                          <p className="text-[10px] text-zinc-600 font-semibold text-center py-2">No tasks added to checklist.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto mt-2">
                            {(missionTasks[mission.id] || []).map((t) => (
                              <div key={t.id} className="flex justify-between items-center bg-zinc-900/40 p-2 rounded-lg border border-white/5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTask(mission.id, t.id)}
                                  className="flex items-center gap-2.5 text-[11px] font-semibold text-cotton/90 text-left truncate flex-1"
                                >
                                  {t.completed ? (
                                    <CheckSquare className="h-4 w-4 text-cherryRed shrink-0" />
                                  ) : (
                                    <Square className="h-4 w-4 text-zinc-500 shrink-0" />
                                  )}
                                  <span className={t.completed ? "line-through text-zinc-500" : ""}>{t.title}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(mission.id, t.id)}
                                  className="text-zinc-600 hover:text-cherryRed p-1 transition shrink-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Checkout / Finish form */}
                      <div className="rounded-xl border border-zinc-800 bg-noirBlack/40 p-4 space-y-3 text-left">
                        {(missionTasks[mission.id] || []).length > 0 ? (
                          <div className="flex justify-between items-center rounded-lg border border-white/5 bg-black/40 p-3 text-xs">
                            <span className="font-bold text-zinc-400">Total Completed:</span>
                            <span className="font-black text-cherryRed text-sm">
                              {(missionTasks[mission.id] || []).filter(t => t.completed).length} / {(missionTasks[mission.id] || []).length} Tasks
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1 text-left">
                            <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500">
                              Tasks Completed
                            </label>
                            <select
                              value={tasksCompletedInput[mission.id] || "0"}
                              onChange={(e) => setTasksCompletedInput({ ...tasksCompletedInput, [mission.id]: e.target.value })}
                              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-cotton outline-none focus:border-cherryRed px-2"
                            >
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <option key={n} value={String(n)} className="bg-zinc-950 text-cotton">{n} Tasks Completed</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button
                          onClick={() => initiateFinishSession(mission)}
                          className="w-full flex h-10 items-center justify-center gap-1.5 rounded-lg bg-cherryRed text-xs font-black uppercase tracking-wider text-white transition hover:bg-cherryRed/95 shadow-[0_0_15px_rgba(210,4,45,0.15)]"
                        >
                          Complete Focus Session
                        </button>
                      </div>

                      {/* Optional vibe check rating if they want extra aura */}
                      {!isSolo && (!!mission.participant_name || !!mission.creator_name) && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500 text-left">
                            Optional: Rate Partner's Vibe
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVibeCheck(mission.id, "W")}
                              className="flex-1 flex h-8 items-center justify-center gap-1 rounded-lg border border-white/20 bg-white/5 text-[10px] font-bold text-white hover:bg-white/10 transition"
                            >
                              W Vibe (+2 Aura)
                            </button>
                            <button
                              onClick={() => handleVibeCheck(mission.id, "L")}
                              className="flex-1 flex h-8 items-center justify-center gap-1 rounded-lg border border-cherryRed/20 bg-cherryRed/5 text-[10px] font-bold text-cherryRed hover:bg-cherryRed/10 transition"
                            >
                              L Vibe (-1 Aura)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirmed / Past Runway Footer: Chat Access */}
                  {!isRequest && (!isSolo && mission.status !== "Pending" || mission.status === "Completed") && (
                    <div className="mt-3.5 flex gap-2">
                      {!isSolo && mission.status !== "Pending" && (
                        <button
                          onClick={() => setChatMission(mission)}
                          className="flex-1 flex h-9 md:h-11 items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs md:text-sm font-bold text-cherryRed hover:text-cotton hover:bg-zinc-800 transition"
                        >
                          <MessageSquare className="h-4 w-4 md:h-4.5 md:w-4.5 text-cherryRed" />
                          <span>Rendezvous Chat</span>
                        </button>
                      )}

                      {mission.status === "Completed" && (
                        <button
                          onClick={() => handleViewMissionRecap(mission.id)}
                          className="flex-1 flex h-9 md:h-11 items-center justify-center gap-2.5 rounded-xl border border-cherryRed/30 bg-cherryRed/5 text-xs md:text-sm font-bold text-cherryRed hover:bg-cherryRed/15 transition"
                        >
                          <Trophy className="h-4 w-4 text-cherryRed" />
                          <span>View Recap</span>
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      {/* Render Chat Panel when selected */}
      <AnimatePresence>
        {chatMission && (
          <Chat
            mission={chatMission}
            user={user}
            onClose={() => setChatMission(null)}
            api={api}
            socketUrl={socketUrl}
          />
        )}
      </AnimatePresence>

      {/* Recap Card Modal */}
      {recapData && (
        <RecapCard
          isOpen={showRecapCard}
          onClose={() => setShowRecapCard(false)}
          recapData={recapData}
        />
      )}

      {/* Public Profile Modal */}
      {selectedUserId && (
        <PublicProfile
          userId={selectedUserId}
          viewerId={user.id}
          isOpen={!!selectedUserId}
          onClose={() => setSelectedUserId(null)}
          api={api}
        />
      )}

      {/* Reflection Modal Dialog */}
      <Dialog open={!!activeReflectionMission} onOpenChange={(open) => !open && setActiveReflectionMission(null)}>
        <DialogContent className="border-white/10 bg-zinc-950/95 text-white max-w-sm rounded-3xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
              <FileText className="h-5 w-5 text-cherryRed" />
              FOCUS REFLECTION
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-left">
            <div>
              <p className="text-[11px] font-bold text-zinc-400">
                Runway: {activeReflectionMission?.title}
              </p>
              <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                Tasks Completed: {
                  activeReflectionMission ? (
                    (missionTasks[activeReflectionMission.id] || []).length > 0 
                      ? (missionTasks[activeReflectionMission.id] || []).filter(t => t.completed).length 
                      : Number(tasksCompletedInput[activeReflectionMission.id] || 0)
                  ) : 0
                }
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                How did it go? (Reflection)
              </label>
              <Textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="Briefly reflect on your focus, distractions, and progress..."
                className="min-h-20 border-white/10 bg-black/40 text-xs text-white resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                Lessons Learned / Takeaways
              </label>
              <Textarea
                value={lessonsLearned}
                onChange={(e) => setLessonsLearned(e.target.value)}
                placeholder="What did you learn or what will you optimize next session?"
                className="min-h-20 border-white/10 bg-black/40 text-xs text-white resize-none"
              />
            </div>

            {/* Screenshot attachment */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                Attach Screenshot / Progress Image
              </label>
              
              {screenshotBase64 ? (
                <div className="relative rounded-xl border border-white/10 bg-black/40 overflow-hidden aspect-video w-full flex items-center justify-center">
                  <img src={screenshotBase64} alt="Attached Preview" className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={() => setScreenshotBase64(null)}
                    className="absolute top-2 right-2 rounded-full bg-black/75 p-1 text-zinc-400 hover:text-white transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/40 h-20 cursor-pointer hover:bg-white/5 transition">
                  <Plus className="h-5 w-5 text-zinc-500 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Upload Image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setScreenshotBase64(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Project Link attachment */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                Project Link
              </label>
              <Input
                type="text"
                placeholder="e.g. github.com/user/repo"
                value={attachLink}
                onChange={(e) => setAttachLink(e.target.value)}
                className="h-9 border-white/10 bg-black/40 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Make Reflection Public</span>
              <button
                type="button"
                onClick={() => setIsPublicReflection(!isPublicReflection)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublicReflection ? "bg-cherryRed" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublicReflection ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={submitFinishSession}
              disabled={submittingReflection}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-cherryRed/35 bg-cherryRed text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(210,4,45,0.15)] hover:bg-[#810100] transition active:scale-[0.98] disabled:opacity-50"
            >
              {submittingReflection ? "Finalizing..." : "Complete & Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Focus Overlay */}
      {focusOverlayOpen && activeFocusMission && timerAnchor && (
        <div 
          className="fixed inset-0 bg-[#120F0D] z-[990] flex flex-col justify-between p-6 sm:p-10 select-none overflow-y-auto text-cotton"
          style={{ backgroundImage: "linear-gradient(135deg, #1B1716 0%, #120F0D 100%)" }}
        >
          {/* Top navigation */}
          <div className="flex justify-between items-center border-b border-white/5 pb-4 text-left">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-cherryRed">
                Focus Runway Active
              </span>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider mt-0.5">
                {activeFocusMission.title}
              </h2>
            </div>
            
            <button
              onClick={() => setFocusOverlayOpen(false)}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/10 transition"
            >
              Minimize
            </button>
          </div>

          {/* Center Timer section */}
          <div className="my-auto py-10 flex flex-col items-center justify-center text-center space-y-8">
            <div className="relative flex items-center justify-center">
              {/* Circular progress glow ring */}
              <div 
                className="absolute h-56 w-56 sm:h-64 sm:w-64 rounded-full border border-cherryRed/10 animate-pulse pointer-events-none"
                style={{
                  boxShadow: "0 0 40px rgba(210, 4, 45, 0.15)",
                  borderColor: "rgba(210, 4, 45, 0.15)"
                }}
              />
              
              <div className="flex flex-col items-center justify-center h-48 w-48 sm:h-56 sm:w-56 rounded-full bg-[#1B1716]/60 border border-white/5 shadow-2xl backdrop-blur-xl">
                {timerAnchor ? (
                  <FocusTimerDisplay
                    anchor={timerAnchor}
                    onComplete={handleTimerComplete}
                  />
                ) : (
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-widest tabular-nums leading-none">
                    00:00
                  </span>
                )}
              </div>
            </div>

            {/* Checklist Tasks in Fullscreen */}
            <div className="w-full max-w-sm space-y-3 bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl">
              <div className="flex justify-between items-center text-left">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Runway Checklist</span>
                <span className="text-[9px] font-black text-cherryRed">
                  {(missionTasks[activeFocusMission.id] || []).filter(t => t.completed).length} / {(missionTasks[activeFocusMission.id] || []).length} Done
                </span>
              </div>
              
              {/* Add checklist item */}
              <div className="flex gap-2">
                <Input
                  value={newTaskTitles[activeFocusMission.id] || ""}
                  onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [activeFocusMission.id]: e.target.value }))}
                  placeholder="Add checklist item..."
                  className="h-8 border-white/5 bg-[#1B1716]/40 text-[10px] text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask(activeFocusMission.id);
                    }
                  }}
                />
                <button
                  onClick={() => handleAddTask(activeFocusMission.id)}
                  className="h-8 px-3 rounded-lg bg-cherryRed/20 border border-cherryRed/40 text-[9px] text-cotton font-black hover:bg-cherryRed/40 transition shrink-0"
                >
                  Add
                </button>
              </div>

              {/* Tasks list */}
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 text-left">
                {(missionTasks[activeFocusMission.id] || []).length === 0 ? (
                  <p className="text-[9px] text-zinc-600 font-semibold text-center py-2">No tasks added.</p>
                ) : (
                  (missionTasks[activeFocusMission.id] || []).map((t) => (
                    <div key={t.id} className="flex justify-between items-center bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(activeFocusMission.id, t.id)}
                        className="flex items-center gap-2 text-[10.5px] font-semibold text-cotton/90 truncate flex-1 text-left"
                      >
                        {t.completed ? (
                          <CheckSquare className="h-3.5 w-3.5 text-cherryRed shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span className={t.completed ? "line-through text-zinc-500" : ""}>{t.title}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom control row */}
          <div className="flex flex-col gap-3.5 border-t border-white/5 pt-5 max-w-sm mx-auto w-full">
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setTimerAnchor((prev) => (prev ? toggleTimerRunning(prev) : prev))
                }
                className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-black uppercase tracking-wider text-cotton hover:bg-white/10 transition"
              >
                {timerAnchor?.running ? "Pause Focus" : "Resume Focus"}
              </button>
              <button
                onClick={() => initiateFinishSession(activeFocusMission)}
                className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-white hover:bg-cherryRed/95 transition shadow-[0_0_15px_rgba(210,4,45,0.15)]"
              >
                Complete Runway
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
