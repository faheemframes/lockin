"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, MapPin, Check, X, MessageSquare, ShieldAlert, AlertCircle, Sparkles, Trophy, Plus, Trash2, CheckSquare, Square, FileText, Flame, Play, Pause, Compass, Clock, CheckCircle2 } from "lucide-react";
import { User, Mission } from "../app/types";
import Chat from "./Chat";
import RecapCard from "./RecapCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface ActiveMissionsProps {
  user: User;
  refreshUser: () => Promise<void>;
  api: (path: string, options?: RequestInit) => Promise<any>;
  socketUrl: string;
}

export default function ActiveMissionsNew({ user, refreshUser, api, socketUrl }: ActiveMissionsProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chatMission, setChatMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputCodes, setInputCodes] = useState<{ [missionId: number]: string }>({});
  const [errors, setErrors] = useState<{ [missionId: number]: string }>({});
  const [submitting, setSubmitting] = useState<{ [missionId: number]: boolean }>({});
  const [tasksCompletedInput, setTasksCompletedInput] = useState<{ [missionId: number]: string }>({});
  const [recapData, setRecapData] = useState<any | null>(null);
  const [showRecapCard, setShowRecapCard] = useState(false);

  // New V2 states
  const [missionTasks, setMissionTasks] = useState<{ [missionId: number]: any[] }>({});
  const [loadingTasks, setLoadingTasks] = useState<{ [missionId: number]: boolean }>({});
  const [newTaskTitles, setNewTaskTitles] = useState<{ [missionId: number]: string }>({});

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

  // Timer V2 states
  const [activeFocusMission, setActiveFocusMission] = useState<Mission | null>(null);
  const [activeTimerDuration, setActiveTimerDuration] = useState<number>(1500); // default 25 min
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(1500);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [showTimerSelector, setShowTimerSelector] = useState<number | null>(null);

  // Timer Tick Effect
  useEffect(() => {
    let interval: any = null;
    if (timerRunning && activeFocusMission) {
      interval = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (activeTimerDuration > 0) {
            // Countdown
            if (prev <= 1) {
              setTimerRunning(false);
              clearInterval(interval);
              // Simple audio beep
              if (typeof window !== "undefined") {
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
              }
              return 0;
            }
            return prev - 1;
          } else {
            // Stopwatch
            return prev + 1;
          }
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, activeFocusMission, activeTimerDuration]);

  // Sync to/from localStorage
  useEffect(() => {
    if (!user) return;
    const key = `lockin_timer_${user.id}`;
    if (activeFocusMission) {
      localStorage.setItem(key, JSON.stringify({
        missionId: activeFocusMission.id,
        duration: activeTimerDuration,
        timeLeft: timeLeftSeconds,
        running: timerRunning,
        lastSaved: Date.now()
      }));
    } else {
      localStorage.removeItem(key);
    }
  }, [activeFocusMission, activeTimerDuration, timeLeftSeconds, timerRunning, user]);

  // Restore timer state on load
  useEffect(() => {
    if (!user || loading) return;
    const key = `lockin_timer_${user.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        const mission = missions.find(m => m.id === state.missionId);
        if (mission && mission.status === "Executing") {
          setActiveFocusMission(mission);
          setActiveTimerDuration(state.duration);
          
          let nextTime = state.timeLeft;
          if (state.running) {
            const elapsed = Math.floor((Date.now() - state.lastSaved) / 1000);
            if (state.duration > 0) {
              nextTime = Math.max(0, state.timeLeft - elapsed);
            } else {
              nextTime = state.timeLeft + elapsed;
            }
          }
          setTimeLeftSeconds(nextTime);
          setTimerRunning(nextTime > 0 || state.duration === 0 ? state.running : false);
        } else {
          localStorage.removeItem(key);
        }
      } catch (err) {
        console.error("Failed to restore timer state", err);
      }
    }
  }, [missions, user, loading]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

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

  async function loadTasks(missionId: number) {
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

  async function handleToggleTask(missionId: number, taskId: number) {
    try {
      await api(`/tasks/${taskId}/toggle`, { method: "PUT" });
      await loadTasks(missionId);
    } catch (err) {
      console.error("Failed to toggle task", err);
    }
  }

  async function handleAddTask(missionId: number) {
    const title = newTaskTitles[missionId] || "";
    if (!title.trim()) return;
    try {
      const currentTasks = missionTasks[missionId] || [];
      const position = currentTasks.length;
      await api(`/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), missionId, position })
      });
      setNewTaskTitles(prev => ({ ...prev, [missionId]: "" }));
      await loadTasks(missionId);
    } catch (err) {
      console.error("Failed to add task", err);
    }
  }

  async function handleDeleteTask(missionId: number, taskId: number) {
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      await loadTasks(missionId);
    } catch (err) {
      console.error("Failed to delete task", err);
    }
  }

  function initiateFinishSession(mission: Mission) {
    let elapsed = 0;
    if (activeFocusMission && activeFocusMission.id === mission.id) {
      elapsed = activeTimerDuration > 0 ? activeTimerDuration - timeLeftSeconds : timeLeftSeconds;
    } else {
      elapsed = (mission.focus_duration || 25) * 60;
    }
    const actualMins = Math.max(1, Math.round(elapsed / 60));

    let failed = false;
    if (activeFocusMission && activeFocusMission.id === mission.id && activeTimerDuration > 0) {
      const tasksList = missionTasks[mission.id] || [];
      const tasksCompleted = tasksList.filter(t => t.completed).length;
      const underHalf = elapsed < (activeTimerDuration * 0.5);
      const noTasks = tasksCompleted === 0;
      const underThreeMins = elapsed < 180;
      if ((underHalf && noTasks) || underThreeMins) {
        failed = true;
      }
    }

    if (activeFocusMission && activeFocusMission.id === mission.id && activeTimerDuration > 0 && timeLeftSeconds > 0) {
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
      setTimerRunning(false);
      await Promise.all([load(), refreshUser()]);
    } catch (err: any) {
      alert(err.message || "Failed to finish focus session.");
    } finally {
      setSubmittingReflection(false);
    }
  }

  async function handleViewMissionRecap(missionId: number) {
    try {
      const result = await api(`/recaps/mission/${missionId}/user/${user.id}`);
      setRecapData(result);
      setShowRecapCard(true);
    } catch (err: any) {
      alert("No recap data saved for this past mission.");
    }
  }

  async function handleVibeCheck(missionId: number, rating: "W" | "L") {
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

  async function handleApprove(missionId: number, participantId: number) {
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

  async function handleAttendance(missionId: number, showedUp: boolean, targetParticipantId?: number) {
    const code = inputCodes[missionId] || "";
    const pId = targetParticipantId || user.id;

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
          setActiveFocusMission(currentM);
          if (showTimerSelector === missionId) {
            setTimerRunning(true);
          } else {
            setActiveTimerDuration(0);
            setTimeLeftSeconds(0);
            setTimerRunning(true);
          }
        }
      }
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [missionId]: err.message || "Failed to submit." }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [missionId]: false }));
    }
  }

  const isDue = (datetime: string) => {
    return new Date(datetime).getTime() <= Date.now();
  };

  const timeLeft = (datetime: string) => {
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

  // Percentage for timer circle
  const getTimerPercentage = () => {
    if (activeTimerDuration <= 0) return 100;
    return (timeLeftSeconds / activeTimerDuration) * 100;
  };

  return (
    <section className="mx-auto w-full max-w-md md:max-w-5xl flex-1 px-4 py-6 pb-28 md:pb-8 space-y-8 select-none">
      
      {/* Immersive Header Card */}
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#161211]/40 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-cherryRed/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-cherryRed/5 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 text-left">
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-cherryRed flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-cherryRed animate-spin" style={{ animationDuration: "12s" }} /> ACTIVE FLIGHTS
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-cotton tracking-tight">Execution Queue</h2>
            <p className="text-xs text-zinc-500 font-semibold max-w-md">
              Synchronize with your partner, verify attendance, and execute your runways.
            </p>
          </div>
          
          <div className="flex gap-3 shrink-0">
            <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-5 py-3 text-center min-w-[100px] shadow-lg">
              <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">
                Completed
              </span>
              <span className="text-xl font-black text-cherryRed tracking-tight">
                {missions.filter((m) => m.status === "Completed").length}
              </span>
            </div>
            
            <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-5 py-3 text-center min-w-[100px] shadow-lg">
              <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">
                Total Runs
              </span>
              <span className="text-xl font-black text-white tracking-tight">
                {missions.length}
              </span>
            </div>
          </div>
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
            className="flex items-start gap-4 rounded-2xl border border-cherryRed/35 bg-cherryRed/5 p-5 shadow-[0_4px_25px_rgba(222,33,30,0.08)] backdrop-blur-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cherryRed/10 border border-cherryRed/20 text-cherryRed shrink-0 animate-pulse">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                {pendingRequests} Crew Application{pendingRequests > 1 ? "s" : ""} Pending
              </h4>
              <p className="mt-1 text-xs font-semibold text-zinc-400 leading-normal">
                Review and approve which crew members get to lock in with you on your launched flights.
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
          className="flex items-start gap-4 rounded-2xl border border-cherryRed/35 bg-cherryRed/5 p-5 shadow-[0_4px_25px_rgba(210,4,45,0.08)] backdrop-blur-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cherryRed/10 border border-cherryRed/20 text-cherryRed shrink-0 animate-pulse">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              Verification Required
            </h4>
            <p className="mt-1 text-xs font-semibold text-zinc-400 leading-normal">
              Confirm who showed up on {pendingReviews} due runway{pendingReviews > 1 ? "s" : ""} to close the flight log and sync Aura.
            </p>
          </div>
        </motion.div>
      )}

      {/* Queue items */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="h-8 w-8 rounded-full border-2 border-cherryRed/20 border-t-cherryRed animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500 animate-pulse">
              Syncing Runway Log...
            </span>
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-20 rounded-[30px] border border-white/5 bg-zinc-950/10 p-8 max-w-md mx-auto">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-500 mb-4">
              <Compass className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Queue Empty</p>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed max-w-[280px] mx-auto font-medium">
              Find ambitious crew runs on the discovery board or launch a solo focus session.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {missions.map((mission, idx) => {
              const isSolo = mission.mission_type === "solo";
              const due = isDue(mission.datetime) || isSolo;
              const isCreator = mission.role === "creator" || isSolo;
              const isRequest = mission.status === "Requested";
              const active = mission.status === "Accepted";
              const needsReview = mission.showed_up === null && due && active && !isSolo;
              
              let statusLabel = mission.status || "Pending";
              let statusColor = "border-zinc-800 bg-zinc-900/40 text-zinc-400";

              if (isRequest) {
                statusLabel = "Application";
                statusColor = "border-zinc-800 bg-zinc-900/50 text-zinc-400";
              } else if (active) {
                statusLabel = isSolo ? "Solo Active" : "Approved";
                statusColor = "border-cherryRed/30 bg-cherryRed/5 text-cherryRed";
              } else if (mission.status === "Executing") {
                statusLabel = "LOCKED IN";
                statusColor = "border-cherryRed/50 bg-[#D2042D] text-cotton shadow-[0_0_20px_rgba(210,4,45,0.15)]";
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
                roleLabel = `Host (Partner: ${mission.participant_name || "Waiting..."})`;
              } else {
                roleLabel = `Partner: ${mission.creator_name}`;
              }

              return (
                <motion.article
                  key={`${mission.id}-${mission.role}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, type: "spring", stiffness: 180 }}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-zinc-950/40 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:border-white/10 ${
                    needsReview ? "border-cherryRed/30 shadow-[0_0_25px_rgba(210,4,45,0.06)]" : "border-white/5"
                  }`}
                >
                  <div className="absolute top-0 right-0 -mr-6 -mt-6 h-20 w-20 rounded-full bg-white/[0.01] pointer-events-none" />
                  
                  <div>
                    {/* Top Row: Title & Badge */}
                    <div className="flex items-start justify-between gap-4 mb-4 text-left">
                      <div>
                        <h3 className="text-base md:text-lg font-black text-cotton leading-tight tracking-tight">
                          {mission.title}
                        </h3>
                        <p className="mt-1 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          {roleLabel}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider shrink-0 h-fit ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Timing & Location Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs font-bold text-zinc-400 mb-5 text-left">
                      <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-[#1B1716]/30 p-3">
                        <CalendarClock className="h-4 w-4 text-cherryRed shrink-0" />
                        <span className="text-zinc-300 truncate">
                          {isSolo ? "Start Anytime" : (due ? "Ready" : timeLeft(mission.datetime))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-[#1B1716]/30 p-3">
                        <MapPin className="h-4 w-4 text-cherryRed shrink-0" />
                        <span className="truncate text-zinc-300">
                          {isSolo ? "Solo Runway" : mission.location}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational States */}
                  <div className="mt-auto space-y-3">
                    
                    {/* 1. Request Review Box (Creator Only) */}
                    {isCreator && isRequest && !isSolo && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl border border-cherryRed/20 bg-cherryRed/5 p-4 text-left space-y-3.5"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[9px] font-black tracking-widest uppercase text-cherryRed block">
                              CANDIDATE PROFILE
                            </span>
                            <p className="text-xs text-cotton font-bold mt-1">
                              Dept: {mission.participant_department}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-zinc-950/60 px-3 py-1.5 text-[10px] font-black text-cherryRed flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-cherryRed" /> {mission.participant_reputation} Aura
                          </div>
                        </div>
                        
                        <button
                          onClick={() => mission.participant_id && handleApprove(mission.id, mission.participant_id)}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-white transition hover:bg-cherryRed/95 active:scale-[0.98] shadow-md"
                        >
                          <Check className="h-4 w-4 stroke-[3]" /> Approve Crew Request
                        </button>
                      </motion.div>
                    )}

                    {/* 2. Participant Request Pending state */}
                    {!isCreator && isRequest && (
                      <div className="rounded-2xl border border-white/5 bg-zinc-900/10 p-4 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 animate-pulse">
                          Awaiting Approval
                        </span>
                        <p className="text-[11px] text-zinc-400 font-semibold mt-1 max-w-[280px] mx-auto">
                          Waiting for {mission.creator_name} to approve your lock-in request...
                        </p>
                      </div>
                    )}

                    {/* 3. Confirmed Active Review / OTP Code check */}
                    {active && (
                      <div className="space-y-3">
                        {isSolo ? (
                          <div className="rounded-2xl border border-cherryRed/20 bg-cherryRed/5 p-4 text-center space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed block">
                              SOLO TARGET READY
                            </span>
                            
                            {showTimerSelector === mission.id ? (
                              <div className="space-y-3 text-left">
                                <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                  Select Target Focus Duration:
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-[11px] font-black uppercase tracking-wider text-cotton">
                                  {[
                                    { label: "25 Min Focus", value: 25 },
                                    { label: "50 Min Focus", value: 50 },
                                    { label: "90 Min Focus", value: 90 },
                                    { label: "Stopwatch", value: 0 },
                                  ].map((opt) => (
                                    <button
                                      key={opt.label}
                                      onClick={async () => {
                                        setActiveTimerDuration(opt.value * 60);
                                        setTimeLeftSeconds(opt.value * 60);
                                        setShowTimerSelector(null);
                                        await handleAttendance(mission.id, true);
                                      }}
                                      className="h-10 rounded-xl border border-white/5 bg-zinc-950/60 hover:bg-[#D2042D]/10 hover:border-[#D2042D]/35 transition text-center"
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setShowTimerSelector(null)}
                                  className="w-full h-8 text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-white transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="text-[11px] text-zinc-400 font-semibold max-w-[280px] mx-auto">
                                  Define your flight clock and begin your solo runway logs.
                                </p>
                                <button
                                  onClick={() => setShowTimerSelector(mission.id)}
                                  disabled={submitting[mission.id]}
                                  className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-cotton shadow-[0_0_20px_rgba(222,33,30,0.15)] hover:bg-[#810100]/95 transition active:scale-[0.98]"
                                >
                                  <Flame className="h-4 w-4 fill-current stroke-2" /> Start Solo Focus Session
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Creator Code display */}
                            {isCreator && due && (
                              <div className="rounded-2xl border border-cherryRed/20 bg-cherryRed/5 p-4 text-center space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed block">
                                  MEETUP VERIFICATION LOG
                                </span>
                                <p className="text-xs text-zinc-400 font-semibold max-w-[280px] mx-auto">
                                  Provide this security key to {mission.participant_name} to confirm takeoff:
                                </p>
                                <div className="text-3xl font-black tracking-[0.25em] text-cherryRed bg-black/60 rounded-xl py-3 max-w-[160px] mx-auto border border-white/5 shadow-inner">
                                  {mission.verification_code}
                                </div>
                              </div>
                            )}

                            {/* Participant OTP Entry box */}
                            {!isCreator && due && (
                              <div className="rounded-2xl border border-cherryRed/20 bg-cherryRed/5 p-4 text-left space-y-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed block">
                                  ENTER ACCESS KEY
                                </span>
                                <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
                                  Obtain the 4-digit verification code from {mission.creator_name} to log in.
                                </p>
                                
                                <div className="flex gap-3">
                                  <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="0000"
                                    value={inputCodes[mission.id] || ""}
                                    onChange={(e) => setInputCodes({ ...inputCodes, [mission.id]: e.target.value.replace(/\D/g, "") })}
                                    className="h-11 w-24 rounded-xl border border-white/5 bg-zinc-950/60 text-center text-base font-black tracking-widest text-cotton outline-none focus:border-cherryRed focus:ring-1 focus:ring-cherryRed/25 transition"
                                  />
                                  <button
                                    onClick={() => handleAttendance(mission.id, true)}
                                    disabled={submitting[mission.id]}
                                    className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-cotton transition hover:bg-[#810100] active:scale-[0.98] disabled:opacity-50 shadow-md"
                                  >
                                    <Check className="h-4 w-4 stroke-[3]" /> Verify Log
                                  </button>
                                </div>
                              </div>
                            )}

                            {errors[mission.id] && (
                              <p className="text-xs font-bold text-cherryRed text-center">
                                {errors[mission.id]}
                              </p>
                            )}

                            {/* Creator control: can mark participant as missed */}
                            {isCreator && due && (
                              <button
                                onClick={() => handleAttendance(mission.id, false, mission.participant_id)}
                                disabled={submitting[mission.id]}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cherryRed/35 bg-cherryRed/5 text-xs font-black uppercase tracking-wider text-cherryRed hover:bg-cherryRed/10 transition active:scale-[0.98] disabled:opacity-50"
                              >
                                <X className="h-4 w-4 stroke-[3]" /> Participant No-Show
                              </button>
                            )}

                            {/* Participant self-report missed */}
                            {!isCreator && due && (
                              <button
                                onClick={() => handleAttendance(mission.id, false)}
                                disabled={submitting[mission.id]}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-cotton hover:bg-white/10 transition active:scale-[0.98] disabled:opacity-50"
                              >
                                <X className="h-4 w-4 stroke-[2]" /> I missed this meetup
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Executing Status Workspace */}
                    {mission.status === "Executing" && (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block animate-pulse">
                            FLIGHT IN EXECUTION
                          </span>
                          <p className="text-xs text-zinc-400 font-semibold mt-1">
                            Your focus timer is logging. Do not break focus.
                          </p>
                          <button
                            onClick={() => {
                              setActiveFocusMission(mission);
                              if (activeFocusMission?.id !== mission.id) {
                                setActiveTimerDuration(0);
                                setTimeLeftSeconds(0);
                                setTimerRunning(true);
                              }
                            }}
                            className="mt-3.5 w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-cotton shadow-[0_0_20px_rgba(222,33,30,0.2)] hover:bg-[#810100] transition active:scale-[0.98]"
                          >
                            <Flame className="h-4 w-4 fill-current stroke-2" /> Open Fullscreen Focus
                          </button>
                        </div>

                        {/* Checklist Tasks */}
                        <div className="space-y-3.5 text-left bg-zinc-950/65 p-4.5 rounded-2xl border border-white/5 shadow-inner">
                          <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                              Runway Checklist
                            </h4>
                            {missionTasks[mission.id] && (
                              <span className="text-[10px] font-black text-cherryRed tracking-wider">
                                {missionTasks[mission.id].filter(t => t.completed).length} / {missionTasks[mission.id].length} DONE
                              </span>
                            )}
                          </div>
                          
                          {/* Task input to add a task on the fly */}
                          <div className="flex gap-2">
                            <Input
                              value={newTaskTitles[mission.id] || ""}
                              onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [mission.id]: e.target.value }))}
                              placeholder="New checklist log..."
                              className="h-9 border-white/5 bg-zinc-900/60 text-xs text-white"
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
                              className="h-9 px-3.5 rounded-xl bg-cherryRed/10 border border-cherryRed/30 text-[10px] text-cherryRed font-black hover:bg-cherryRed/20 hover:scale-[1.02] active:scale-[0.98] transition shrink-0"
                            >
                              Add
                            </button>
                          </div>

                          {loadingTasks[mission.id] ? (
                            <div className="flex justify-center py-4">
                              <div className="h-4 w-4 rounded-full border border-zinc-500/20 border-t-zinc-500 animate-spin" />
                            </div>
                          ) : (missionTasks[mission.id] || []).length === 0 ? (
                            <p className="text-[10.5px] text-zinc-600 font-semibold text-center py-2">No active items on checklist.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {(missionTasks[mission.id] || []).map((t) => (
                                <div key={t.id} className="flex justify-between items-center bg-zinc-900/20 p-2.5 rounded-xl border border-white/5 transition hover:bg-white/[0.02]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTask(mission.id, t.id)}
                                    className="flex items-center gap-2.5 text-xs font-semibold text-cotton/90 text-left truncate flex-1"
                                  >
                                    {t.completed ? (
                                      <CheckCircle2 className="h-4.5 w-4.5 text-cherryRed shrink-0 fill-cherryRed/10" />
                                    ) : (
                                      <Square className="h-4.5 w-4.5 text-zinc-600 shrink-0" />
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
                        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4 space-y-4 shadow-inner">
                          {(missionTasks[mission.id] || []).length > 0 ? (
                            <div className="flex justify-between items-center rounded-xl border border-white/5 bg-zinc-900/40 p-3 text-xs font-bold text-zinc-400">
                              <span>Log Progress:</span>
                              <span className="font-black text-cherryRed text-sm">
                                {(missionTasks[mission.id] || []).filter(t => t.completed).length} / {(missionTasks[mission.id] || []).length} Tasks
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1.5 text-left">
                              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                Estimated Tasks Completed
                              </label>
                              <select
                                value={tasksCompletedInput[mission.id] || "0"}
                                onChange={(e) => setTasksCompletedInput({ ...tasksCompletedInput, [mission.id]: e.target.value })}
                                className="h-10 w-full rounded-xl border border-white/5 bg-zinc-950 text-xs text-cotton outline-none focus:border-cherryRed px-2 font-bold"
                              >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                  <option key={n} value={String(n)} className="bg-zinc-950 text-cotton">{n} Tasks Completed</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <button
                            onClick={() => initiateFinishSession(mission)}
                            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-white transition hover:bg-cherryRed/95 hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-cherryRed/10"
                          >
                            Complete Focus Session
                          </button>
                        </div>

                        {/* Optional vibe check rating if they want extra aura */}
                        {!isSolo && (!!mission.participant_name || !!mission.creator_name) && (
                          <div className="rounded-2xl border border-white/5 bg-[#1B1716]/30 p-4 space-y-3 shadow-inner">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-left block">
                              VIBE RATINGS
                            </span>
                            <div className="flex gap-2.5">
                              <button
                                onClick={() => handleVibeCheck(mission.id, "W")}
                                className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-[10.5px] font-black uppercase tracking-wider text-white hover:bg-white/10 active:scale-[0.97] transition"
                              >
                                W Vibe (+2 Aura)
                              </button>
                              <button
                                onClick={() => handleVibeCheck(mission.id, "L")}
                                className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cherryRed/20 bg-cherryRed/5 text-[10.5px] font-black uppercase tracking-wider text-cherryRed hover:bg-cherryRed/10 active:scale-[0.97] transition"
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
                      <div className="mt-4 flex gap-2.5">
                        {!isSolo && mission.status !== "Pending" && (
                          <button
                            onClick={() => setChatMission(mission)}
                            className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#1B1716]/44 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-[#1B1716]/80 active:scale-[0.97] transition"
                          >
                            <MessageSquare className="h-4 w-4 text-cherryRed" />
                            <span>Chatroom</span>
                          </button>
                        )}

                        {mission.status === "Completed" && (
                          <button
                            onClick={() => handleViewMissionRecap(mission.id)}
                            className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl border border-cherryRed/35 bg-cherryRed/5 text-xs font-black uppercase tracking-wider text-cherryRed hover:bg-cherryRed/15 active:scale-[0.97] transition shadow-[0_0_15px_rgba(210,4,45,0.08)]"
                          >
                            <Trophy className="h-4 w-4 text-cherryRed" />
                            <span>View recap</span>
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

      {/* Reflection Modal Dialog */}
      <Dialog open={!!activeReflectionMission} onOpenChange={(open) => !open && setActiveReflectionMission(null)}>
        <DialogContent className="border-white/10 bg-zinc-950/98 text-white max-w-sm rounded-[32px] backdrop-blur-2xl shadow-2xl p-6.5">
          <DialogHeader className="border-b border-white/5 pb-3">
            <DialogTitle className="text-base font-black tracking-tight text-white uppercase flex items-center gap-2">
              <FileText className="h-5 w-5 text-cherryRed" />
              FOCUS REFLECTION LOG
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4.5 mt-4 text-left">
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                RUNWAY LOG
              </p>
              <h4 className="text-sm font-bold text-white leading-tight mt-0.5">{activeReflectionMission?.title}</h4>
              <p className="text-[11px] text-zinc-400 font-semibold mt-1 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-cherryRed stroke-[2.5]" />
                Completed: {
                  activeReflectionMission ? (
                    (missionTasks[activeReflectionMission.id] || []).length > 0 
                      ? `${(missionTasks[activeReflectionMission.id] || []).filter(t => t.completed).length} / ${(missionTasks[activeReflectionMission.id] || []).length} tasks`
                      : `${Number(tasksCompletedInput[activeReflectionMission.id] || 0)} tasks`
                  ) : "0 tasks"
                }
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                How did it go?
              </label>
              <Textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="Briefly reflect on your focus, flow, and output..."
                className="min-h-20 border-white/5 bg-[#1B1716]/40 text-xs text-cotton rounded-xl resize-none focus:border-cherryRed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Key takeaway / Lessons
              </label>
              <Textarea
                value={lessonsLearned}
                onChange={(e) => setLessonsLearned(e.target.value)}
                placeholder="What did you learn? What will you optimize?"
                className="min-h-20 border-white/5 bg-[#1B1716]/40 text-xs text-cotton rounded-xl resize-none focus:border-cherryRed"
              />
            </div>

            {/* Screenshot attachment */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Attach Proof / Screenshot
              </label>
              
              {screenshotBase64 ? (
                <div className="relative rounded-2xl border border-white/10 bg-[#1B1716]/40 overflow-hidden aspect-video w-full flex items-center justify-center shadow-inner">
                  <img src={screenshotBase64} alt="Attached Preview" className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={() => setScreenshotBase64(null)}
                    className="absolute top-2.5 right-2.5 rounded-full bg-black/85 p-1.5 text-zinc-400 hover:text-white transition shadow-md"
                  >
                    <X className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#1B1716]/30 h-24 cursor-pointer hover:bg-white/5 hover:border-cherryRed/40 transition-all shadow-inner group">
                  <Plus className="h-5 w-5 text-zinc-500 group-hover:text-cherryRed group-hover:scale-110 transition-all mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    Upload Progress Image
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
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                Project / Work URL
              </label>
              <Input
                type="text"
                placeholder="e.g. github.com/username/project"
                value={attachLink}
                onChange={(e) => setAttachLink(e.target.value)}
                className="h-10 border-white/5 bg-[#1B1716]/40 text-xs text-cotton rounded-xl focus:border-cherryRed"
              />
            </div>

            {/* Public switch */}
            <div className="flex items-center justify-between bg-zinc-950/60 p-3.5 rounded-2xl border border-white/5">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-cotton block">Broadcast Log</span>
                <span className="text-[9px] font-medium text-zinc-500">Share this reflection to the social feed</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPublicReflection(!isPublicReflection)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublicReflection ? "bg-cherryRed" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isPublicReflection ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
 
            <button
              onClick={submitFinishSession}
              disabled={submittingReflection}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-white shadow-lg hover:bg-cherryRed/95 active:scale-[0.98] disabled:opacity-50"
            >
              {submittingReflection ? "Locking in recap..." : "Finalize log & claim Aura"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Immersive Focus Cockpit */}
      {activeFocusMission && (
        <div 
          className="fixed inset-0 bg-[#0F0C0B] z-[990] flex flex-col justify-between p-6 sm:p-10 select-none overflow-y-auto text-cotton"
          style={{ backgroundImage: "radial-gradient(circle at 50% 30%, rgba(210, 4, 45, 0.05), transparent 45%), radial-gradient(circle at 10% 80%, rgba(129, 1, 0, 0.05), transparent 35%), linear-gradient(to bottom, #110D0C, #090707)" }}
        >
          {/* Subtle Ambient Particles Floating */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-cherryRed/20 filter blur-xl animate-pulse"
                style={{
                  width: `${100 + i * 50}px`,
                  height: `${100 + i * 50}px`,
                  left: `${10 + i * 15}%`,
                  top: `${20 + (i % 2) * 30}%`
                }}
              />
            ))}
          </div>

          {/* Top navigation cockpit */}
          <div className="flex justify-between items-center border-b border-white/5 pb-4 text-left z-10 relative">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cherryRed flex items-center gap-1.5">
                <Flame className="h-4 w-4 animate-pulse" /> FLIGHT LOG IN EXECUTION
              </span>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider mt-0.5">
                {activeFocusMission.title}
              </h2>
            </div>
            
            <button
              onClick={() => setActiveFocusMission(null)}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/10 transition active:scale-95"
            >
              Minimize Cockpit
            </button>
          </div>

          {/* Center Immersive Timer Dial */}
          <div className="my-auto py-8 flex flex-col items-center justify-center text-center space-y-10 z-10 relative">
            <div className="relative flex items-center justify-center">
              
              {/* Premium Glow Rings behind */}
              <div 
                className="absolute h-64 w-64 sm:h-76 sm:w-76 rounded-full border border-cherryRed/10 blur-[8px] pointer-events-none"
                style={{
                  boxShadow: `0 0 50px rgba(210, 4, 45, 0.12)`
                }}
              />
              
              {/* Custom SVG Circular Gauge */}
              <svg className="absolute h-60 w-60 sm:h-72 sm:w-72 -rotate-90 transform" viewBox="0 0 200 200">
                {/* Background track circle */}
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  className="stroke-[#1C1716] fill-transparent"
                  strokeWidth="6"
                />
                {/* Glowing Active Ring */}
                <motion.circle
                  cx="100"
                  cy="100"
                  r="85"
                  className="stroke-cherryRed fill-transparent"
                  strokeWidth="7"
                  strokeDasharray="534"
                  strokeDashoffset={534 - (534 * getTimerPercentage()) / 100}
                  strokeLinecap="round"
                  style={{
                    stroke: "#D2042D",
                    filter: "drop-shadow(0 0 8px rgba(210,4,45,0.5))"
                  }}
                />
              </svg>

              <div className="flex flex-col items-center justify-center h-48 w-48 sm:h-56 sm:w-56 rounded-full bg-[#130F0E]/80 border border-white/5 shadow-2xl backdrop-blur-xl">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-widest tabular-nums leading-none">
                  {formatTime(timeLeftSeconds)}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {activeTimerDuration > 0 ? "COUNTDOWN" : "ELAPSED"}
                </span>
              </div>
            </div>

            {/* Checklist Tasks in Fullscreen */}
            <div className="w-full max-w-sm space-y-4 bg-zinc-950/60 border border-white/5 p-5 rounded-3xl shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Runway Checklist</span>
                <span className="text-[10px] font-black text-cherryRed tracking-wider">
                  {(missionTasks[activeFocusMission.id] || []).filter(t => t.completed).length} / {(missionTasks[activeFocusMission.id] || []).length} DONE
                </span>
              </div>
              
              {/* Add checklist item */}
              <div className="flex gap-2">
                <Input
                  value={newTaskTitles[activeFocusMission.id] || ""}
                  onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [activeFocusMission.id]: e.target.value }))}
                  placeholder="New cockpit item..."
                  className="h-9 border-white/5 bg-[#1B1716]/40 text-xs text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask(activeFocusMission.id);
                    }
                  }}
                />
                <button
                  onClick={() => handleAddTask(activeFocusMission.id)}
                  className="h-9 px-4 rounded-xl bg-cherryRed/10 border border-cherryRed/30 text-[10px] text-cherryRed font-black hover:bg-cherryRed/20 active:scale-95 transition shrink-0"
                >
                  Add
                </button>
              </div>

              {/* Tasks list */}
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 text-left scrollbar-thin">
                {(missionTasks[activeFocusMission.id] || []).length === 0 ? (
                  <p className="text-[10px] text-zinc-600 font-semibold text-center py-2">Checklist log empty.</p>
                ) : (
                  (missionTasks[activeFocusMission.id] || []).map((t) => (
                    <div key={t.id} className="flex justify-between items-center bg-zinc-900/10 p-2.5 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(activeFocusMission.id, t.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-cotton/90 truncate flex-1 text-left"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-cherryRed shrink-0 animate-pulse" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-zinc-600 shrink-0" />
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
          <div className="flex flex-col gap-4 border-t border-white/5 pt-6 max-w-sm mx-auto w-full z-10 relative">
            <div className="flex gap-3">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-black uppercase tracking-wider text-cotton hover:bg-white/10 transition active:scale-[0.98]"
              >
                {timerRunning ? (
                  <>
                    <Pause className="h-4 w-4" /> Pause Cockpit
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Resume Focus
                  </>
                )}
              </button>
              <button
                onClick={() => initiateFinishSession(activeFocusMission)}
                className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-cherryRed text-xs font-black uppercase tracking-wider text-white hover:bg-[#810100] active:scale-[0.98] transition shadow-[0_0_20px_rgba(210,4,45,0.2)]"
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
