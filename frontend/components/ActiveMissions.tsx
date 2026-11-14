"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, MapPin, Check, X, MessageSquare, Sparkles, Trophy, Plus, Trash2, Flame, Play, Pause, Calendar, Users, Radio, ExternalLink, Copy, ChevronDown } from "lucide-react";
import { User, Mission } from "../app/types";
import { uploadImage } from "../lib/supabase";
import Chat from "./Chat";
import RecapCard from "./RecapCard";
import PublicProfile from "./PublicProfile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, fieldClass } from "./ui/input";
import { CountUp, Portal, Reveal, Skeleton } from "./ui/motion";
import { LockinMark } from "./ui/LockinLogo";
import { spring } from "../lib/motion";
import { Textarea } from "./ui/textarea";
import { POINTS_NAME } from "../lib/brand";
import {
  FocusTimer, startTimer, displaySec, isRunning, isFinished, endsAt, pause, resume, freezeAtEnd,
  saveTimer, loadTimer, elapsedSec, formatClock
} from "../lib/focusTimer";
import { prepareFocusNotifications, showFocusRunning, showFocusDone, clearFocusNotification } from "../lib/focusNotify";

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
  const [customMetric, setCustomMetric] = useState("");
  const [isPublicReflection, setIsPublicReflection] = useState(true);
  const [submittingReflection, setSubmittingReflection] = useState(false);
  
  // V2 reflection attachments & exit states
  const [reflectionDuration, setReflectionDuration] = useState<number>(25);
  const [reflectionTargetMinutes, setReflectionTargetMinutes] = useState<number>(0);
  const [isFailedRun, setIsFailedRun] = useState<boolean>(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [attachLink, setAttachLink] = useState<string>("");

  // Timer V2 states
  const [activeFocusMission, setActiveFocusMission] = useState<Mission | null>(null);
  // The timer is stored as timestamps (lib/focusTimer); what it shows is derived.
  const [timer, setTimer] = useState<FocusTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const activeTimerDuration = timer?.durationSec ?? 0;
  const timeLeftSeconds = timer ? displaySec(timer, now) : 0;
  const timerRunning = timer ? isRunning(timer, now) : false;
  const [focusOverlayOpen, setFocusOverlayOpen] = useState<boolean>(false);
  const [showTimerSelector, setShowTimerSelector] = useState<number | null>(null);

  // Event & Roster states
  const [rosterMission, setRosterMission] = useState<Mission | null>(null);
  const [rosterTab, setRosterTab] = useState<"going" | "pending">("going");
  const [broadcastText, setBroadcastText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const timerRef = useRef<FocusTimer | null>(null);
  timerRef.current = timer;

  /** Change the timer anchors and persist them (not every tick: anchors only). */
  function commitTimer(next: FocusTimer | null, mission?: Mission | null) {
    timerRef.current = next;
    setTimer(next);
    if (mission !== undefined) setActiveFocusMission(mission);
    saveTimer(user.id, next);
    setNow(Date.now());
  }

  /** Start (or re-attach to) a focus session. `startedAt` anchors to the server's check-in time. */
  function beginFocus(mission: Mission, durationSec: number, startedAt?: number) {
    prepareFocusNotifications();
    commitTimer(startTimer(mission.id, mission.title, durationSec, startedAt), mission);
  }

  function stopFocus() {
    commitTimer(null, null);
    clearFocusNotification();
  }

  function toggleFocus() {
    const t = timerRef.current;
    if (!t || isFinished(t)) return;
    if (t.pausedAt === null) commitTimer(pause(t));
    else {
      prepareFocusNotifications();
      commitTimer(resume(t));
    }
  }

  // Clock: recomputed from the anchors every second and the instant the page wakes
  // (unlock, tab switch back, restored from bfcache). Missed ticks cost nothing.
  useEffect(() => {
    if (!timer) return;
    const sync = () => setNow(Date.now());
    const onVisible = () => document.visibilityState === "visible" && sync();
    sync();
    const id = setInterval(sync, 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
    };
  }, [timer]);

  // Countdown reached its target: freeze it exactly there, chime and notify once.
  useEffect(() => {
    if (!timer || timer.pausedAt !== null || !isFinished(timer, now)) return;
    commitTimer(freezeAtEnd(timer));
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
    showFocusDone(timer.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, now]);

  // "Focus running" notification, refreshed whenever the anchors change.
  useEffect(() => {
    if (!timer) return;
    if (isFinished(timer)) return; // the "complete" notification replaces it
    showFocusRunning(timer.title, { endsAt: endsAt(timer), startedAt: timer.startedAt, paused: timer.pausedAt !== null });
  }, [timer]);

  // Time in the tab title, so it is visible from other tabs on desktop.
  useEffect(() => {
    if (!timer) return;
    document.title = `${formatClock(timeLeftSeconds)} · LOCKIN`;
  }, [timer, timeLeftSeconds]);
  useEffect(() => () => { document.title = "LOCKIN"; }, []);
  useEffect(() => { if (!timer) document.title = "LOCKIN"; }, [timer]);

  // Restore once, when the queue first loads. Missions refresh every 15s; the
  // timer must not be re-derived from them each time.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!user || loading || restoredRef.current) return;
    restoredRef.current = true;
    const wantsOverlay = (() => {
      try {
        const v = localStorage.getItem("lockin_open_focus_overlay");
        localStorage.removeItem("lockin_open_focus_overlay");
        return Boolean(v);
      } catch {
        return false;
      }
    })();
    const saved = timerRef.current || loadTimer(user.id);
    const mission = saved ? missions.find((m) => m.id === saved.missionId && m.status === "Executing") : undefined;
    if (saved && mission) {
      timerRef.current = saved;
      setTimer(saved);
      setActiveFocusMission(mission);
      if (wantsOverlay) setFocusOverlayOpen(true);
    } else if (saved) {
      // Finished or cancelled elsewhere.
      saveTimer(user.id, null);
      clearFocusNotification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions, user, loading]);

  // Quick focus (dock / modal) opens the overlay through this event.
  useEffect(() => {
    const handleOpenFocus = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.mission) {
        const saved = loadTimer(user.id);
        const t = saved && saved.missionId === detail.mission.id
          ? saved
          : startTimer(detail.mission.id, detail.mission.title, typeof detail.duration === "number" ? detail.duration : (detail.mission.work_duration || detail.mission.focus_duration || 25) * 60);
        timerRef.current = t;
        setTimer(t);
        saveTimer(user.id, t);
        setActiveFocusMission(detail.mission);
      } else if (!timerRef.current) {
        const saved = loadTimer(user.id);
        if (saved) {
          timerRef.current = saved;
          setTimer(saved);
        }
      }
      setFocusOverlayOpen(true);
    };
    window.addEventListener("lockin:open-focus", handleOpenFocus);
    return () => window.removeEventListener("lockin:open-focus", handleOpenFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const formatTime = formatClock;

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
    if (timer && timer.missionId === mission.id) {
      elapsed = elapsedSec(timer);
    } else if (mission.work_started_at) {
      // No local timer (other device, cleared storage): the server's check-in time is the truth.
      elapsed = Math.max(0, Math.floor((Date.now() - new Date(mission.work_started_at).getTime()) / 1000));
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
        (failed ? `WARNING: This will count as a RUNWAY CRASH (-5 ${POINTS_NAME}).` : "")
      );
      if (!confirmEnd) return;
    }

    const targetMins = activeFocusMission && activeFocusMission.id === mission.id ? Math.round(activeTimerDuration / 60) : 0;
    setReflectionTargetMinutes(targetMins);
    setReflectionDuration(actualMins);
    setIsFailedRun(failed);
    setActiveReflectionMission(mission);
    stopFocus();
    setFocusOverlayOpen(false);
    setReflectionText("");
    setLessonsLearned("");
    setCustomMetric("");
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
          tasksCompleted,
          targetMinutes: reflectionTargetMinutes,
          sessionDuration: reflectionDuration,
          reflection: {
            reflectionText: reflectionText.trim() || null,
            lessonsLearned: lessonsLearned.trim() || null,
            customMetric: customMetric.trim() || null,
            isPublic: isPublicReflection,
            screenshot: screenshotBase64,
            link: attachLink.trim() || null
          }
        })
      });

      setRecapData(result);
      setShowRecapCard(true);
      setActiveReflectionMission(null);
      stopFocus();
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

  // A rating waits 5 seconds before it's sent, so a mis-tap can be undone.
  const [pendingRate, setPendingRate] = useState<{ missionId: number; rating: "W" | "L"; name: string } | null>(null);
  useEffect(() => {
    if (!pendingRate) return;
    const t = setTimeout(() => {
      handleVibeCheck(pendingRate.missionId, pendingRate.rating);
      setPendingRate(null);
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRate]);

  async function handleVibeCheck(missionId: number, rating: "W" | "L") {
    try {
      await api(`/missions/${missionId}/vibe-check`, {
        method: "POST",
        body: JSON.stringify({ rating })
      });
      setErrors((prev) => ({ ...prev, [missionId]: "" }));
      await Promise.all([load(), refreshUser()]);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [missionId]: err.message || "Couldn't save your rating." }));
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
        body: JSON.stringify({ participantId })
      });
      const updatedList = await api(`/missions/active/${user.id}`);
      setMissions(updatedList);
      if (rosterMission && rosterMission.id === missionId) {
        const found = updatedList.find((m: any) => m.id === missionId);
        if (found) setRosterMission(found);
      }
    } catch (err: any) {
      alert(err.message || "Failed to approve request.");
    }
  }

  async function handleDecline(missionId: number, participantId: number) {
    try {
      await api(`/missions/${missionId}/decline-participant`, {
        method: "POST",
        body: JSON.stringify({ participantId })
      });
      const updatedList = await api(`/missions/active/${user.id}`);
      setMissions(updatedList);
      if (rosterMission && rosterMission.id === missionId) {
        const found = updatedList.find((m: any) => m.id === missionId);
        if (found) setRosterMission(found);
      }
    } catch (err: any) {
      alert(err.message || "Failed to decline applicant.");
    }
  }

  async function handleDeleteMission(mission: Mission) {
    const isSolo = mission.mission_type === "solo";
    const isCreator = mission.role === "creator" || isSolo;
    const isRequest = mission.status === "Requested";
    const isRejected = mission.status === "Rejected";
    const actionLabel = isCreator
      ? "delete this mission"
      : isRequest
        ? "withdraw your join request"
        : isRejected
          ? "dismiss this declined request"
          : "give up this mission";

    const confirmed = window.confirm(`Are you sure you want to ${actionLabel}? It will be removed from your queue.`);
    if (!confirmed) return;

    setDeletingId(mission.id);
    try {
      await api(`/missions/${mission.id}/cancel`, { method: "POST" });
      setMissions((prev) => prev.filter((m) => m.id !== mission.id));
      if (activeFocusMission?.id === mission.id) stopFocus();
      await refreshUser();
    } catch (err: any) {
      alert(err.message || "Failed to remove mission.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!rosterMission || !broadcastText.trim()) return;
    setSendingBroadcast(true);
    try {
      await api(`/missions/${rosterMission.id}/broadcast`, {
        method: "POST",
        body: JSON.stringify({ hostId: user.id, message: broadcastText.trim() })
      });
      setBroadcastText("");
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function handleAttendance(missionId: number, showedUp: boolean, targetParticipantId?: number, chosenDuration?: number) {
    const code = inputCodes[missionId] || "";

    setErrors((prev) => ({ ...prev, [missionId]: "" }));
    setSubmitting((prev) => ({ ...prev, [missionId]: true }));

    try {
      await api(`/missions/${missionId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ showedUp, code, ...(targetParticipantId ? { participantId: targetParticipantId } : {}) })
      });
      const updatedList = await api(`/missions/active/${user.id}`);
      setMissions(updatedList);
      await refreshUser();

      // Automatically enter fullscreen focus mode if session is now executing
      if (showedUp) {
        const currentM = updatedList.find((m: any) => m.id === missionId);
        if (currentM && currentM.status === "Executing") {
          const secs = typeof chosenDuration === "number" ? chosenDuration : (currentM.work_duration || currentM.focus_duration || 25) * 60;
          const serverStart = currentM.work_started_at ? new Date(currentM.work_started_at).getTime() : undefined;
          beginFocus(currentM, secs, serverStart && serverStart <= Date.now() ? serverStart : undefined);
          setFocusOverlayOpen(true);
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

  const isDue = (datetime?: string | null) => {
    if (!datetime) return true;
    return new Date(datetime).getTime() <= Date.now();
  };

  // Matches the server: check-in opens 15 minutes before the start time.
  const checkInOpen = (datetime?: string | null) => {
    if (!datetime) return true;
    return new Date(datetime).getTime() - 15 * 60e3 <= Date.now();
  };

  // "2 min", "1h 5m", "3d 4h": no "0h 2m".
  const timeLeft = (datetime?: string | null) => {
    if (!datetime) return "soon";
    const diff = new Date(datetime).getTime() - Date.now();
    if (diff <= 0) return "now";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.max(1, Math.ceil((diff % 3600000) / 60000));
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours === 0) return `${minutes} min`;
    return `${hours}h ${minutes}m`;
  };

  const [showPastMissions, setShowPastMissions] = useState(false);

  // Queue sections, by what the user has to do next.
  const sections = useMemo(() => {
    const out: Record<SectionKey, Mission[]> = { needs: [], live: [], next: [], history: [] };
    const byTime = (a: Mission, b: Mission) => new Date(a.datetime || 0).getTime() - new Date(b.datetime || 0).getTime();
    for (const m of missions) out[sectionOf(m)].push(m);
    out.needs.sort(byTime);
    out.next.sort(byTime);
    out.history.sort((a, b) => -byTime(a, b));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions]);


  const renderCard = (mission: Mission) => {
            const isSolo = mission.mission_type === "solo";
            const due = isDue(mission.datetime) || isSolo;
            const isCreator = mission.role === "creator" || isSolo;
            const isRequest = mission.status === "Requested";
            const isRejected = mission.status === "Rejected";
            const active = mission.status === "Accepted";
            const executing = mission.status === "Executing";
            const needsReview = mission.showed_up === null && due && active && !isSolo;
            const canCheckIn = isSolo || checkInOpen(mission.datetime);
            // A group host runs no session of their own: their partner checks in and finishes.
            const hostOfGroup = isCreator && !isSolo;
            const myRating = hostOfGroup ? mission.creator_vibe_rating : mission.participant_vibe_rating;
            const canRate = !isSolo && mission.status === "Completed" && !myRating;
            const tasks = missionTasks[mission.id] || [];
            const doneTasks = tasks.filter((t) => t.completed).length;

            const status = isRequest
              ? { label: "Requested", cls: "border-line bg-raised text-ink-2" }
              : isRejected
                ? { label: "Declined", cls: "border-crimson/40 bg-crimson/10 text-crimson" }
                : active
                  ? {
                      label: isSolo ? "Ready" : due ? "Due now" : canCheckIn ? "Check-in open" : "Upcoming",
                      cls: due || (canCheckIn && !isSolo) ? "border-signal/70 bg-surface text-crimson" : "border-line bg-raised text-ink"
                    }
                  : executing
                    ? { label: "Locked in", cls: "border-signal text-ink", live: true }
                    : mission.status === "Completed"
                      ? { label: "Completed", cls: "border-success/40 bg-success/10 text-success" }
                      : mission.status === "Missed"
                        ? { label: "Missed", cls: "border-line bg-raised text-ink-3 line-through" }
                        : { label: mission.status || "Pending", cls: "border-line bg-raised text-ink-2" };

            const roleLabel = isSolo
              ? "Solo"
              : isCreator
                ? mission.status === "Pending" ? "Hosting" : `Hosting · with ${mission.participant_name}`
                : `With ${mission.creator_name}`;

            return (
              <Reveal.Item key={`${mission.id}-${mission.role}-${mission.participant_id ?? "self"}`}>
                <motion.article
                  layout
                  className={`relative overflow-hidden rounded-card border bg-surface ${
                    executing ? "border-signal/70" : needsReview ? "border-signal/70" : "border-line"
                  }`}
                >
                  {/* Cover strip */}
                  <div
                    className="h-px w-full"
                    style={{
                      background: mission.cover_color
                        ? mission.cover_color
                        : mission.cover_image?.includes("gradient")
                          ? mission.cover_image
                          : "linear-gradient(90deg, rgb(var(--cherry)), rgb(var(--signal)))"
                    }}
                  />

                  <div className="space-y-5 p-5">
                    {/* Head */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="t-display text-title-2 text-ink">{mission.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="truncate text-subhead text-ink-3">{roleLabel}</p>
                          {mission.is_event && (
                            <span className="rounded-sm border border-signal/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-crimson">
                              Event
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-[12px] font-medium uppercase tracking-[0.12em] ${status.cls}`}>
                          {status.live && (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
                            </span>
                          )}
                          {status.label}
                        </span>
                        {!executing && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMission(mission)}
                            disabled={deletingId === mission.id}
                            title={isCreator ? "Delete mission" : isRequest ? "Withdraw request / Give up" : "Give up"}
                            aria-label={isCreator ? "Delete mission" : "Give up"}
                            className="flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-raised text-ink-3 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Next step */}
                    {(() => {
                      const step = nextStep(mission);
                      return (
                        <p className={`flex items-start gap-2.5 text-subhead leading-snug ${step.urgent ? "text-ink" : "text-ink-2"}`}>
                          <span
                            aria-hidden="true"
                            className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${step.urgent ? "bg-signal" : "bg-ink-3"}`}
                          />
                          {step.text}
                        </p>
                      );
                    })()}

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-subhead text-ink">
                      <span className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-ink-3" />
                        {mission.status === "Completed" || mission.status === "Missed"
                          ? mission.datetime
                            ? new Date(mission.datetime).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
                            : "Done"
                          : isSolo
                            ? "Start anytime"
                            : due
                              ? "Happening now"
                              : `Starts in ${timeLeft(mission.datetime)}`}
                      </span>
                      <span className="flex min-w-0 items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-crimson" />
                        <span className="truncate">{isSolo ? "Wherever you are" : mission.location}</span>
                      </span>
                    </div>

                    {/* Crew & Roster */}
                    {mission.attendees && mission.attendees.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {mission.attendees.slice(0, 4).map((a, i) => (
                                <motion.button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setSelectedUserId(a.id)}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ ...spring.pop, delay: 0.1 + i * 0.05 }}
                                  whileHover={{ y: -3, zIndex: 10 }}
                                  aria-label={`View ${a.name}`}
                                  className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface bg-raised font-display text-footnote font-bold text-ink"
                                >
                                  {getInitials(a.name)}
                                </motion.button>
                              ))}
                            </div>
                            <span className="text-footnote font-medium text-ink-2">
                              {mission.attendees.length} {mission.is_event ? "attending" : "locked in"}
                              {mission.max_capacity ? ` / ${mission.max_capacity}` : ""}
                            </span>
                          </div>

                          {isCreator && !isSolo && (
                            <button
                              type="button"
                              onClick={() => {
                                setRosterMission(mission);
                                setRosterTab((mission.roster?.pending?.length ?? 0) > 0 ? "pending" : "going");
                              }}
                              className="flex h-11 items-center gap-1.5 px-2 text-footnote font-medium uppercase tracking-[0.12em] text-ink-2 hover:text-ink"
                            >
                              <Users className="h-4 w-4 text-ink-3" />
                              <span>Roster</span>
                              {(mission.roster?.pending?.length ?? 0) > 0 && (
                                <span className="tabular rounded-sm bg-signal px-1.5 py-0.5 text-[11px] font-medium text-ink">
                                  {mission.roster!.pending.length}
                                </span>
                              )}
                            </button>
                          )}
                        </div>

                      </div>
                    )}

                    {/* Access Details (Secret Info) */}
                    {mission.secret_info && (active || executing || isCreator) && (
                      <div className="rounded-xl border border-signal/60 bg-signal/10 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-crimson flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                            Access Details
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(mission.secret_info || "");
                              setCopiedSecret(true);
                              setTimeout(() => setCopiedSecret(false), 2000);
                            }}
                            className="text-caption text-ink-3 hover:text-ink flex items-center gap-1"
                          >
                            {copiedSecret ? <Check className="h-3 w-3 text-crimson" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedSecret ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-subhead text-ink font-mono whitespace-pre-wrap break-words text-xs">
                          {mission.secret_info}
                        </p>
                        {mission.secret_info.match(/https?:\/\/[^\s]+/i) && (
                          <a
                            href={mission.secret_info.match(/https?:\/\/[^\s]+/i)![0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-crimson hover:underline pt-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Open link
                          </a>
                        )}
                      </div>
                    )}

                    {/* Calendar */}
                    {!isSolo && mission.status !== "Completed" && mission.status !== "Missed" && !executing && (
                      <div className="flex flex-wrap items-center gap-x-1 text-footnote text-ink-3">
                        <Calendar className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        <span>Add to calendar:</span>
                        <a
                          href={getGoogleCalendarUrl(mission)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-11 px-1.5 leading-[44px] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
                        >
                          Google
                        </a>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => downloadICS(mission)}
                          className="h-11 px-1.5 text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
                        >
                          Apple / Outlook
                        </button>
                      </div>
                    )}

                    {/* Host: nobody yet */}
                    {mission.status === "Pending" && (
                      <Panel tone="muted">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-subhead text-ink-2">Live on the deck. You'll see join requests here.</p>
                          <button
                            type="button"
                            onClick={() => handleDeleteMission(mission)}
                            disabled={deletingId === mission.id}
                            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-caption font-semibold text-ink-3 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{deletingId === mission.id ? "Deleting..." : "Delete"}</span>
                          </button>
                        </div>
                      </Panel>
                    )}

                    {/* Host: approve request */}
                    {isCreator && isRequest && !isSolo && (
                      <Panel>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-headline text-ink">Wants to join</p>
                            <p className="mt-0.5 text-subhead text-ink-3">{mission.participant_department}</p>
                          </div>
                          <span className="flex items-center gap-1.5 rounded-sm border border-line bg-raised px-3 py-1 text-footnote font-medium text-ink-2">
                            <Sparkles className="h-3.5 w-3.5" /> {mission.participant_reputation} {POINTS_NAME}
                          </span>
                        </div>
                        {mission.application_note && (
                          <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
                            <p className="t-label mb-1">
                              Applicant Response
                            </p>
                            <div className="text-subhead text-ink whitespace-pre-wrap text-xs">
                              {mission.application_note}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => mission.participant_id && handleDecline(mission.id, mission.participant_id)}
                            className="btn-ghost flex-1 h-10 text-footnote"
                          >
                            Decline
                          </button>
                          <ActionButton
                            className="flex-1"
                            onClick={() => mission.participant_id && handleApprove(mission.id, mission.participant_id)}
                          >
                            <Check className="h-4 w-4" strokeWidth={2.5} /> Approve
                          </ActionButton>
                        </div>
                      </Panel>
                    )}

                    {/* Participant: waiting */}
                    {!isCreator && isRequest && (
                      <Panel tone="muted">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <motion.span
                              className="h-2 w-2 shrink-0 rounded-full bg-signal"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.6, repeat: Infinity }}
                            />
                            <div>
                              <p className="text-subhead font-medium text-ink">Join request pending</p>
                              <p className="text-footnote text-ink-3">Waiting for {mission.creator_name} to review and approve.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteMission(mission)}
                            disabled={deletingId === mission.id}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-caption font-semibold text-ink-2 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-crimson" />
                            <span>{deletingId === mission.id ? "Withdrawing..." : "Withdraw request"}</span>
                          </button>
                        </div>
                      </Panel>
                    )}

                    {/* Participant: request declined */}
                    {!isCreator && isRejected && (
                      <Panel tone="muted">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <X className="h-4 w-4 text-crimson shrink-0" />
                            <div>
                              <p className="text-subhead font-medium text-crimson">Join request declined</p>
                              <p className="text-footnote text-ink-3">{mission.creator_name} could not accept this request.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteMission(mission)}
                            disabled={deletingId === mission.id}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-caption font-semibold text-ink-2 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-crimson" />
                            <span>{deletingId === mission.id ? "Removing..." : "Dismiss from queue"}</span>
                          </button>
                        </div>
                      </Panel>
                    )}

                    {/* Accepted */}
                    {active && (
                      <div className="space-y-3">
                        {isSolo ? (
                          <Panel>
                            <AnimatePresence mode="wait" initial={false}>
                              {showTimerSelector === mission.id ? (
                                <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                                  <p className="t-label">How long?</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { label: "25 min", value: 25 },
                                      { label: "45 min", value: 45 },
                                      { label: "90 min", value: 90 },
                                      { label: "Open", value: 0 }
                                    ].map((opt, i) => (
                                      <motion.button
                                        key={opt.label}
                                        type="button"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ ...spring.pop, delay: i * 0.04 }}
                                        whileTap={{ scale: 0.94 }}
                                        onClick={async () => {
                                          const chosenSecs = opt.value * 60;
                                          setShowTimerSelector(null);
                                          await handleAttendance(mission.id, true, undefined, chosenSecs);
                                        }}
                                        className="h-14 rounded-xl border border-line bg-raised text-title-3 font-semibold text-ink transition-colors hover:border-signal hover:bg-surface"
                                      >
                                        {opt.label}
                                      </motion.button>
                                    ))}
                                  </div>
                                  <button type="button" onClick={() => setShowTimerSelector(null)} className="h-10 w-full text-subhead text-ink-3 hover:text-ink">
                                    Cancel
                                  </button>
                                </motion.div>
                              ) : (
                                <motion.div key="go" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                  <ActionButton onClick={() => setShowTimerSelector(mission.id)} disabled={submitting[mission.id]}>
                                    <Play className="h-5 w-5 fill-current" /> Start session
                                  </ActionButton>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Panel>
                        ) : (
                          <>
                            {isCreator && canCheckIn && (
                              <Panel>
                                <p className="t-label">Check-in code</p>
                                <p className="mt-1 text-subhead text-ink-2">Give this to {mission.participant_name} when they arrive.</p>
                                <div className="mt-4 flex justify-center gap-2" aria-label={`Code ${String(mission.verification_code ?? "").split("").join(" ")}`}>
                                  {String(mission.verification_code ?? "----").split("").map((d, i) => (
                                    <motion.span
                                      key={i}
                                      initial={{ rotateX: -90, opacity: 0 }}
                                      animate={{ rotateX: 0, opacity: 1 }}
                                      transition={{ ...spring.pop, delay: i * 0.08 }}
                                      className="t-display tabular flex h-16 w-14 items-center justify-center rounded-xl border border-signal/70 bg-bg text-large-title text-crimson"
                                    >
                                      {d}
                                    </motion.span>
                                  ))}
                                </div>
                              </Panel>
                            )}

                            {!isCreator && canCheckIn && (
                              <Panel>
                                <p className="t-label">Enter check-in code</p>
                                <p className="mt-1 text-subhead text-ink-2">Get the 4 digits from {mission.creator_name}.</p>
                                <CodeInput
                                  value={inputCodes[mission.id] || ""}
                                  onChange={(v) => setInputCodes({ ...inputCodes, [mission.id]: v })}
                                />
                                <ActionButton
                                  onClick={() => handleAttendance(mission.id, true)}
                                  disabled={submitting[mission.id] || (inputCodes[mission.id] || "").length < 4}
                                >
                                  <Check className="h-5 w-5" strokeWidth={2.75} /> Check in
                                </ActionButton>
                              </Panel>
                            )}

                            <AnimatePresence>
                              {errors[mission.id] && (
                                <motion.p
                                  role="alert"
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: [0, -6, 6, 0] }}
                                  exit={{ opacity: 0 }}
                                  className="text-center text-subhead font-medium text-crimson"
                                >
                                  {errors[mission.id]}
                                </motion.p>
                              )}
                            </AnimatePresence>

                            {!canCheckIn && (
                              <Panel tone="muted">
                                <p className="text-subhead text-ink-2">
                                  {isCreator ? "Your check-in code appears" : "Check-in opens"} 15 minutes before the start.
                                </p>
                              </Panel>
                            )}

                            {canCheckIn && (
                              <button
                                type="button"
                                onClick={() => (isCreator ? handleAttendance(mission.id, false, mission.participant_id) : handleAttendance(mission.id, false))}
                                disabled={submitting[mission.id]}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-subhead text-ink-3 transition-colors hover:bg-raised hover:text-ink disabled:opacity-50"
                              >
                                <X className="h-4 w-4" /> {isCreator ? "They didn't show" : "I couldn't make it"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Executing: the participant (or solo) runs the session */}
                    {executing && !hostOfGroup && (
                      <div className="space-y-4">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (activeFocusMission?.id !== mission.id) {
                              // No local timer for this session (other device, cleared storage):
                              // re-attach to the server's check-in time instead of restarting.
                              // Missions created before the "not started" fix may carry a stale
                              // server start; only re-attach while it is within the target.
                              const mSecs = (mission.work_duration || mission.focus_duration || 25) * 60;
                              const serverStart = mission.work_started_at ? new Date(mission.work_started_at).getTime() : undefined;
                              const age = serverStart ? Date.now() - serverStart : Infinity;
                              beginFocus(mission, mSecs, age >= 0 && age < mSecs * 1000 ? serverStart : undefined);
                            }
                            setFocusOverlayOpen(true);
                          }}
                          className="group relative flex w-full items-center justify-between overflow-hidden rounded-sm bg-signal p-5 text-left text-ink transition-colors hover:bg-cherry"
                        >
                          <span className="relative">
                            <span className="t-label text-ink/80">{activeFocusMission?.id === mission.id ? "Session active" : "Focus mode"}</span>
                            <span className="t-display tabular mt-1 block text-title-1 text-ink">
                              {/* "Continue" only once a timer for this mission actually exists. */}
                              {activeFocusMission?.id === mission.id ? `Continue focus (${formatTime(timeLeftSeconds)})` : "Start focus"}
                            </span>
                          </span>
                          <Flame className="relative h-8 w-8 text-ink transition-transform group-hover:scale-110" />
                        </motion.button>

                        <TaskList
                          tasks={tasks}
                          loading={loadingTasks[mission.id]}
                          newTitle={newTaskTitles[mission.id] || ""}
                          setNewTitle={(v) => setNewTaskTitles((prev) => ({ ...prev, [mission.id]: v }))}
                          onAdd={() => handleAddTask(mission.id)}
                          onToggle={(id) => handleToggleTask(mission.id, id)}
                          onDelete={(id) => handleDeleteTask(mission.id, id)}
                        />

                        {tasks.length === 0 && (
                          <div className="space-y-2">
                            <label htmlFor={`tc-${mission.id}`} className="t-label block">Tasks you finished</label>
                            <select
                              id={`tc-${mission.id}`}
                              value={tasksCompletedInput[mission.id] || "0"}
                              onChange={(e) => setTasksCompletedInput({ ...tasksCompletedInput, [mission.id]: e.target.value })}
                              className={`${fieldClass} h-12 appearance-none`}
                            >
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                <option key={n} value={String(n)} className="bg-surface text-ink">
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <ActionButton onClick={() => initiateFinishSession(mission)}>
                          <Check className="h-5 w-5" strokeWidth={2.75} /> Finish{tasks.length > 0 ? ` · ${doneTasks}/${tasks.length}` : ""}
                        </ActionButton>

                      </div>
                    )}

                    {/* Executing: the host follows along and keeps the shared checklist */}
                    {executing && hostOfGroup && (
                      <div className="space-y-4">
                        <Panel>
                          <div className="flex items-center gap-3">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
                            </span>
                            <p className="text-subhead text-ink-2">
                              <span className="text-ink">{mission.participant_name}</span> checked in and is locked in.
                            </p>
                          </div>
                          {mission.work_started_at && (
                            <LiveSessionClock
                              startedAt={mission.work_started_at}
                              targetMinutes={mission.work_duration || mission.focus_duration || 0}
                            />
                          )}
                        </Panel>
                        <TaskList
                          tasks={tasks}
                          loading={loadingTasks[mission.id]}
                          newTitle={newTaskTitles[mission.id] || ""}
                          setNewTitle={(v) => setNewTaskTitles((prev) => ({ ...prev, [mission.id]: v }))}
                          onAdd={() => handleAddTask(mission.id)}
                          onToggle={(id) => handleToggleTask(mission.id, id)}
                          onDelete={(id) => handleDeleteTask(mission.id, id)}
                        />
                      </div>
                    )}

                    {/* Rate the other person once the session is over */}
                    {canRate && (() => {
                      const other = (hostOfGroup ? mission.participant_name : mission.creator_name) || "them";
                      const first = other.split(" ")[0];
                      const pending = pendingRate && pendingRate.missionId === mission.id ? pendingRate : null;
                      return (
                        <div className="space-y-3 border-t border-line pt-4">
                          {pending ? (
                            <div className="flex items-center justify-between gap-3" role="status">
                              <p className="text-subhead text-ink-2">
                                You rated {first} <span className="font-medium text-ink">{pending.rating}</span>. Sending…
                              </p>
                              <button type="button" onClick={() => setPendingRate(null)} className="btn-ghost h-11 shrink-0 px-5">
                                Undo
                              </button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-headline text-ink">How did {first} show up?</p>
                                <p className="mt-1 text-footnote leading-relaxed text-ink-2">
                                  W means they came and did the work: +2 {POINTS_NAME} for them. L means they didn&apos;t: −1. One rating each, after the session.
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <VibeButton onClick={() => setPendingRate({ missionId: mission.id, rating: "W", name: other })} label="W" sub="Showed up" good />
                                <VibeButton onClick={() => setPendingRate({ missionId: mission.id, rating: "L", name: other })} label="L" sub="Didn't" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {!active && errors[mission.id] && (
                      <p role="alert" className="text-center text-subhead font-medium text-crimson">
                        {errors[mission.id]}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                      {/* Participant: Withdraw pending join request */}
                      {isRequest && !isCreator && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(mission)}
                          disabled={deletingId === mission.id}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-raised text-subhead font-medium text-ink transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4 text-crimson" />
                          <span>{deletingId === mission.id ? "Withdrawing..." : "Withdraw request"}</span>
                        </button>
                      )}

                      {/* Participant: Dismiss declined request */}
                      {isRejected && !isCreator && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(mission)}
                          disabled={deletingId === mission.id}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-raised text-subhead font-medium text-ink transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4 text-crimson" />
                          <span>{deletingId === mission.id ? "Removing..." : "Dismiss from queue"}</span>
                        </button>
                      )}

                      {/* Host: Delete pending unstarted mission */}
                      {mission.status === "Pending" && isCreator && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(mission)}
                          disabled={deletingId === mission.id}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-raised text-subhead font-medium text-ink transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4 text-crimson" />
                          <span>{deletingId === mission.id ? "Deleting..." : "Delete mission"}</span>
                        </button>
                      )}

                      {/* Chat for active group missions */}
                      {!isSolo && !isRequest && !isRejected && mission.status !== "Pending" && (
                        <button
                          type="button"
                          onClick={() => setChatMission(mission)}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-subhead font-medium text-ink transition-colors hover:bg-raised"
                        >
                          <MessageSquare className="h-4 w-4 text-ink-3" /> Chat
                        </button>
                      )}

                      {/* Solo unstarted mission: Delete option */}
                      {isSolo && !executing && mission.status !== "Completed" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(mission)}
                          disabled={deletingId === mission.id}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-subhead font-medium text-ink-3 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson disabled:opacity-50"
                          title="Delete mission"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </button>
                      )}

                      {/* Active group mission before execution: Give up / Cancel */}
                      {active && !executing && !isSolo && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(mission)}
                          disabled={deletingId === mission.id}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-subhead font-medium text-ink-3 transition-colors hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson disabled:opacity-50"
                          title={isCreator ? "Cancel mission" : "Leave mission"}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>{isCreator ? "Cancel" : "Give up"}</span>
                        </button>
                      )}

                      {/* Completed mission: Recap */}
                      {mission.status === "Completed" && !hostOfGroup && (
                        <button
                          type="button"
                          onClick={() => handleViewMissionRecap(mission.id)}
                          className="btn-primary h-11 flex-1"
                        >
                          <Trophy className="h-4 w-4" /> Recap
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              </Reveal.Item>
            );
  };

  return (
    <section className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 pt-2 md:max-w-[1240px] md:px-12 md:pt-14 md:space-y-10">
      {/* Title */}
      <div>
        <p className="t-section">Queue</p>
        <h1 className="t-display mt-3 text-large-title text-ink md:mt-6 md:text-[88px] md:leading-[0.92] md:tracking-[-0.045em]">Your missions</h1>
        <p className="mt-1 text-subhead text-ink-3 md:mt-5 md:text-body">
          {loading
            ? "Loading your missions…"
            : sections.needs.length > 0
            ? `${sections.needs.length} need${sections.needs.length === 1 ? "s" : ""} you now`
            : sections.live.length > 0
              ? "You're locked in"
              : "Nothing needs you right now"}
        </p>
      </div>

      {/* Summary: what's where, at a glance */}
      {!loading && missions.length > 0 && (
        <nav aria-label="Queue sections" className="-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none md:mx-0 md:px-0">
          {SECTION_ORDER.map((key) => {
            const n = sections[key].length;
            const urgent = key === "needs" && n > 0;
            return (
              <button
                key={key}
                type="button"
                disabled={!n}
                onClick={() => {
                  if (key === "history") setShowPastMissions(true);
                  document.getElementById(`queue-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex h-11 shrink-0 items-center gap-2.5 rounded-[2px] border px-4 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors disabled:opacity-40 ${
                  urgent ? "border-signal/70 text-ink" : "border-line text-ink-2 hover:border-ink/30 hover:text-ink"
                }`}
              >
                {urgent && <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />}
                {SECTION_META[key].short}
                <span className={`tabular ${urgent ? "text-crimson" : "text-ink-3"}`}>{n}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Queue */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 rounded-card" />
          ))}
        </div>
      ) : missions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface/50 px-8 py-16 text-center"
        >
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <LockinMark size={56} color="rgb(var(--ink-3))" />
          </motion.div>
          <h2 className="t-display mt-6 text-title-1 text-ink">Nothing queued</h2>
          <p className="mt-2 max-w-[260px] text-subhead leading-relaxed text-ink-2">
            Lock in to a mission from the deck, or launch your own. It'll show up here.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-10">
          {SECTION_ORDER.map((key) => {
            const list = sections[key];
            if (!list.length) return null;
            const meta = SECTION_META[key];
            const collapsed = key === "history" && !showPastMissions;
            return (
              <section key={key} id={`queue-${key}`} aria-labelledby={`queue-${key}-title`} className="scroll-mt-24">
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-3">
                  <div className="flex items-baseline gap-3">
                    <h2 id={`queue-${key}-title`} className={`t-section ${key === "needs" ? "text-crimson" : "text-ink-2"}`}>
                      {meta.title}
                    </h2>
                    <span className="tabular text-footnote text-ink-3">{list.length}</span>
                  </div>
                  {key === "history" ? (
                    <button
                      type="button"
                      onClick={() => setShowPastMissions(!showPastMissions)}
                      aria-expanded={!collapsed}
                      className="flex h-9 items-center gap-1.5 text-footnote text-ink-3 transition-colors hover:text-ink"
                    >
                      {collapsed ? "Show" : "Hide"}
                      <motion.span animate={{ rotate: collapsed ? 0 : 180 }} transition={spring.snap}>
                        <ChevronDown className="h-4 w-4" />
                      </motion.span>
                    </button>
                  ) : (
                    <p className="hidden text-footnote text-ink-3 sm:block">{meta.hint}</p>
                  )}
                </div>
                {!collapsed && (
                  <Reveal className="grid grid-cols-1 gap-4 md:grid-cols-2" each={0.05}>
                    {list.map((mission) => renderCard(mission))}
                  </Reveal>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Portal>
      <AnimatePresence>
        {chatMission && <Chat mission={chatMission} user={user} onClose={() => setChatMission(null)} api={api} socketUrl={socketUrl} />}
      </AnimatePresence>
      </Portal>

      {recapData && <RecapCard isOpen={showRecapCard} onClose={() => setShowRecapCard(false)} recapData={recapData} />}

      {selectedUserId && (
        <PublicProfile userId={selectedUserId} viewerId={user.id} isOpen={!!selectedUserId} onClose={() => setSelectedUserId(null)} api={api} />
      )}

      {/* Reflection */}
      <Dialog open={!!activeReflectionMission} onOpenChange={(open) => !open && setActiveReflectionMission(null)}>
        <DialogContent className="sm:max-w-lg max-w-full overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Session done</DialogTitle>
            <DialogDescription>
              {activeReflectionMission?.title} ·{" "}
              {activeReflectionMission
                ? (missionTasks[activeReflectionMission.id] || []).length > 0
                  ? (missionTasks[activeReflectionMission.id] || []).filter((t) => t.completed).length
                  : Number(tasksCompletedInput[activeReflectionMission.id] || 0)
                : 0}{" "}
              tasks finished
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Key Output / Metric (Strava-style personal accomplishment) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="r-metric" className="t-label block">Key Output / Stat (Optional)</label>
                <span className="text-[10px] uppercase tracking-wider text-ink-3">Story Highlight</span>
              </div>
              <Input
                id="r-metric"
                value={customMetric}
                onChange={(e) => setCustomMetric(e.target.value)}
                placeholder="e.g. 8 questions solved, 5 km run, Back & biceps, 4 PRs"
                className="h-11 text-subhead bg-surface"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {["8 questions solved", "5.0 km run", "Back & biceps", "4 PRs merged", "Unit 1 & 2 revision", "100 pushups"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCustomMetric(chip)}
                    className="rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[11px] font-medium text-ink-3 transition-colors hover:border-ink/40 hover:text-ink hover:bg-raised"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="r-how" className="t-label block">How did it go?</label>
              <Textarea id="r-how" value={reflectionText} onChange={(e) => setReflectionText(e.target.value)} placeholder="What you got done, what got in the way." />
            </div>

            <div className="space-y-2">
              <label htmlFor="r-next" className="t-label block">Next time</label>
              <Textarea id="r-next" value={lessonsLearned} onChange={(e) => setLessonsLearned(e.target.value)} placeholder="One thing you'd change." />
            </div>

            <div className="space-y-2">
              <p className="t-label">Proof</p>
              {screenshotBase64 ? (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative aspect-video w-full overflow-hidden rounded-xl border border-line">
                  <img src={screenshotBase64} alt="Attached screenshot" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setScreenshotBase64(null)}
                    aria-label="Remove screenshot"
                    className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-ink backdrop-blur"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ) : (
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-raised text-ink-3 transition-colors hover:border-ink-3/50 hover:text-ink-2">
                  <Plus className="h-5 w-5" />
                  <span className="text-subhead">Add a screenshot</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) {
                        uploadImage(file).then(setScreenshotBase64).catch((err) => alert(err.message));
                      }
                    }}
                  />
                </label>
              )}
              <Input type="url" inputMode="url" placeholder="Link (repo, doc, video)" value={attachLink} onChange={(e) => setAttachLink(e.target.value)} aria-label="Project link" />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isPublicReflection}
              onClick={() => setIsPublicReflection(!isPublicReflection)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-raised p-4 text-left"
            >
              <span>
                <span className="block text-subhead font-medium text-ink">Post to feed</span>
                <span className="block text-footnote text-ink-3">Your campus sees the recap.</span>
              </span>
              <span className={`relative flex h-7 w-12 shrink-0 items-center rounded-sm border border-line p-1 transition-colors ${isPublicReflection ? "bg-signal" : "bg-overlay"}`}>
                <motion.span layout transition={spring.snap} className={`h-5 w-5 rounded-sm bg-ink ${isPublicReflection ? "ml-auto" : ""}`} />
              </span>
            </button>

            <ActionButton onClick={submitFinishSession} disabled={submittingReflection}>
              {submittingReflection ? "Saving" : "Save recap"}
            </ActionButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Host Event Roster Dialog */}
      <Dialog open={!!rosterMission} onOpenChange={(open) => { if (!open) setRosterMission(null); }}>
        <DialogContent className="sm:max-w-xl max-w-full max-h-[85vh] overflow-x-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="rounded-sm border border-signal/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-crimson">
                {rosterMission?.is_event ? "Event Roster" : "Group Roster"}
              </span>
              <span className="text-caption text-ink-3">#{rosterMission?.id}</span>
            </div>
            <DialogTitle className="truncate">{rosterMission?.title}</DialogTitle>
            <DialogDescription>
              {rosterMission?.location} · {rosterMission?.datetime ? new Date(rosterMission.datetime).toLocaleString() : "Anytime"}
            </DialogDescription>
          </DialogHeader>

          {/* Broadcast bar */}
          <form onSubmit={handleBroadcast} className="rounded-xl border border-line bg-raised/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-crimson animate-pulse" />
                Broadcast to Attendees
              </span>
              {broadcastSuccess && <span className="text-[11px] text-success font-medium">Broadcast sent</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Alert all attendees (e.g. room update, running 5m late)..."
                className="h-10 text-subhead"
              />
              <button
                type="submit"
                disabled={sendingBroadcast || !broadcastText.trim()}
                className="btn-primary h-10 px-4 text-footnote font-semibold shrink-0"
              >
                {sendingBroadcast ? "Sending" : "Send"}
              </button>
            </div>
          </form>

          {/* Roster Tabs */}
          <div className="flex gap-1 border-b border-line pt-1">
            <button
              type="button"
              onClick={() => setRosterTab("going")}
              className={`px-3 py-2 text-footnote font-semibold uppercase tracking-wider transition border-b-2 -mb-px ${
                rosterTab === "going"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              Confirmed ({rosterMission?.roster?.going?.length ?? rosterMission?.attendees?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setRosterTab("pending")}
              className={`px-3 py-2 text-footnote font-semibold uppercase tracking-wider transition border-b-2 -mb-px flex items-center gap-1.5 ${
                rosterTab === "pending"
                  ? "border-crimson text-crimson"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              <span>Pending Requests</span>
              {(rosterMission?.roster?.pending?.length ?? 0) > 0 && (
                <span className="tabular rounded-sm bg-signal px-1.5 py-0.5 text-[11px] font-medium text-ink">
                  {rosterMission!.roster!.pending.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[220px]">
            {rosterTab === "going" && (
              <div className="space-y-2">
                {(!rosterMission?.roster?.going || rosterMission.roster.going.length === 0) && (
                  <p className="text-subhead text-ink-3 py-8 text-center">No confirmed guests yet.</p>
                )}
                {rosterMission?.roster?.going?.map((guest: any) => (
                  <div
                    key={guest.participant_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-footnote font-bold text-ink">
                        {getInitials(guest.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-subhead font-semibold text-ink truncate">{guest.name}</p>
                        <p className="text-caption text-ink-3 truncate">{guest.department || "SRM Student"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {guest.showed_up ? (
                        <span className="inline-flex items-center gap-1 rounded bg-success/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-success">
                          <Check className="h-3 w-3" /> Checked In
                        </span>
                      ) : (
                        // Guests check themselves in with your 4-digit code.
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Not checked in</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rosterTab === "pending" && (
              <div className="space-y-3">
                {(!rosterMission?.roster?.pending || rosterMission.roster.pending.length === 0) && (
                  <p className="text-subhead text-ink-3 py-8 text-center">No pending join requests.</p>
                )}
                {rosterMission?.roster?.pending?.map((applicant: any) => (
                  <div
                    key={applicant.participant_id}
                    className="rounded-xl border border-line bg-surface p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-footnote font-bold text-ink">
                          {getInitials(applicant.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-subhead font-semibold text-ink truncate">{applicant.name}</p>
                          <p className="text-caption text-ink-3 truncate">{applicant.department || "SRM Student"}</p>
                        </div>
                      </div>
                      <span className="rounded border border-signal/60 bg-signal/10 px-2 py-0.5 text-caption font-semibold text-crimson">
                        {applicant.reputation_points} {POINTS_NAME}
                      </span>
                    </div>

                    {applicant.application_note && (
                      <div className="rounded-lg border border-line bg-raised p-2.5">
                        <p className="t-label mb-1">
                          Applicant Response
                        </p>
                        <div className="text-subhead text-ink whitespace-pre-wrap text-xs">
                          {applicant.application_note}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDecline(rosterMission.id, applicant.participant_id)}
                        className="btn-ghost flex-1 h-9 text-footnote"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(rosterMission.id, applicant.participant_id)}
                        className="btn-primary flex-1 h-9 text-footnote font-semibold"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen focus */}
      <Portal>
      <AnimatePresence>
        {activeFocusMission && focusOverlayOpen && (
          <FocusOverlay
            mission={activeFocusMission}
            time={formatTime(timeLeftSeconds)}
            progress={activeTimerDuration > 0 ? 1 - timeLeftSeconds / activeTimerDuration : (timeLeftSeconds % 3600) / 3600}
            countdown={activeTimerDuration > 0}
            running={timerRunning}
            onToggle={toggleFocus}
            onMinimize={() => setFocusOverlayOpen(false)}
            onFinish={() => initiateFinishSession(activeFocusMission)}
          >
            <TaskList
              tasks={missionTasks[activeFocusMission.id] || []}
              newTitle={newTaskTitles[activeFocusMission.id] || ""}
              setNewTitle={(v) => setNewTaskTitles((prev) => ({ ...prev, [activeFocusMission.id]: v }))}
              onAdd={() => handleAddTask(activeFocusMission.id)}
              onToggle={(id) => handleToggleTask(activeFocusMission.id, id)}
            />
          </FocusOverlay>
        )}
      </AnimatePresence>
      </Portal>
    </section>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */


/* ─── Queue sections & next steps ───────────────────────────────────── */

type SectionKey = "needs" | "live" | "next" | "history";
const SECTION_ORDER: SectionKey[] = ["needs", "live", "next", "history"];
const SECTION_META: Record<SectionKey, { title: string; short: string; hint: string }> = {
  needs: { title: "Needs you", short: "Needs you", hint: "Approve, check in, or rate." },
  live: { title: "Live now", short: "Live", hint: "Sessions in progress." },
  next: { title: "Up next", short: "Up next", hint: "Waiting on time or on someone else." },
  history: { title: "History", short: "Done", hint: "" }
};

const firstName = (name?: string | null) => (name || "").trim().split(/\s+/)[0] || "them";
const isSoloMission = (m: Mission) => m.mission_type === "solo";
const isHostView = (m: Mission) => m.role === "creator" || isSoloMission(m);
const checkInIsOpen = (m: Mission) => !m.datetime || new Date(m.datetime).getTime() - 15 * 60e3 <= Date.now();

function owesRating(m: Mission) {
  if (isSoloMission(m)) return false;
  if (m.status !== "Completed") return false;
  const hostOfGroup = m.role === "creator";
  return !(hostOfGroup ? m.creator_vibe_rating : m.participant_vibe_rating);
}

function sectionOf(m: Mission): SectionKey {
  if (m.status === "Executing") return "live";
  if (m.status === "Completed") return owesRating(m) ? "needs" : "history";
  if (m.status === "Missed") return "history";
  if (m.status === "Requested") return "needs";
  if (m.status === "Rejected") return "needs";
  if (m.status === "Accepted" && !isSoloMission(m) && checkInIsOpen(m)) return "needs";
  return "next";
}

function untilLabel(datetime?: string | null) {
  if (!datetime) return "soon";
  const diff = new Date(datetime).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3600e3);
  const min = Math.max(1, Math.ceil((diff % 3600e3) / 60e3));
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${min}m` : `${min} min`;
}

/** The one thing to do next on this card, in plain words. */
function nextStep(m: Mission): { text: string; urgent: boolean } {
  const solo = isSoloMission(m);
  const host = isHostView(m) && !solo;
  const partner = firstName(m.participant_name);
  const hostName = firstName(m.creator_name);
  switch (m.status) {
    case "Pending":
      return { text: "Live on the deck. Waiting for someone to lock in.", urgent: false };
    case "Requested":
      return host
        ? { text: `${m.participant_name || "Someone"} wants to join. Approve them below.`, urgent: true }
        : { text: `Waiting for ${hostName} to approve you. Withdraw below if you changed your mind.`, urgent: false };
    case "Rejected":
      return { text: "Join request was declined.", urgent: false };
    case "Accepted":
      if (solo) return { text: "Ready when you are. Start a focus session.", urgent: false };
      if (!checkInIsOpen(m)) return { text: `Starts in ${untilLabel(m.datetime)}. Check-in opens 15 min before.`, urgent: false };
      return host
        ? { text: `Show ${partner} your code when they arrive.`, urgent: true }
        : { text: `Enter ${hostName}'s 4-digit code when you get there.`, urgent: true };
    case "Executing":
      if (host) return { text: `${partner} is locked in. You'll rate them when they finish.`, urgent: false };
      return { text: "You're locked in. Tap Finish when you're done.", urgent: true };
    case "Completed":
      if (owesRating(m)) return { text: `Rate ${host ? partner : hostName} to close this out.`, urgent: true };
      return { text: host ? "Done." : "Done. Your recap is saved.", urgent: false };
    case "Missed":
      return { text: "Missed. It happens. Lock in to the next one.", urgent: false };
    default:
      return { text: "", urgent: false };
  }
}

function Panel({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "muted" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-4 rounded-xl border p-4 ${tone === "muted" ? "border-line bg-raised/50" : "border-line bg-raised"}`}
    >
      {children}
    </motion.div>
  );
}

function ActionButton({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      transition={spring.snap}
      className={`flex h-12 w-full items-center justify-center gap-2 btn-primary ${className}`}
    >
      {children}
    </motion.button>
  );
}

function VibeButton({ onClick, label, sub, good }: { onClick: () => void; label: string; sub: string; good?: boolean }) {
  const [hit, setHit] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={() => {
        setHit(true);
        onClick();
      }}
      whileTap={{ scale: 0.85 }}
      animate={hit ? { scale: [1, 1.2, 1] } : {}}
      transition={spring.pop}
      aria-label={`Rate ${label}: ${sub}`}
      className={`flex h-12 items-center justify-center gap-2 rounded-sm border px-3 font-display text-title-3 font-medium ${
        good ? "border-ink text-ink hover:bg-ink hover:text-bg" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
      }`}
    >
      {label}
      <span className="text-footnote font-normal">{sub}</span>
    </motion.button>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        aria-label="4-digit check-in code"
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="flex justify-center gap-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const ch = value[i];
          const isCaret = i === value.length;
          return (
            <motion.div
              key={i}
              animate={ch ? { scale: [1.12, 1] } : { scale: 1 }}
              transition={spring.pop}
              className={`t-display tabular flex h-16 w-14 items-center justify-center rounded-xl border bg-bg text-large-title transition-colors ${
                ch ? "border-ink-3 text-ink" : isCaret ? "border-signal peer-focus:border-signal" : "border-line text-ink-3"
              }`}
            >
              {ch ?? (isCaret ? <motion.span className="h-7 w-[2px] bg-signal" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} /> : "")}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

type TaskT = { id: number; title: string; completed: boolean };

function TaskList({
  tasks,
  loading,
  newTitle,
  setNewTitle,
  onAdd,
  onToggle,
  onDelete
}: {
  tasks: TaskT[];
  loading?: boolean;
  newTitle: string;
  setNewTitle: (v: string) => void;
  onAdd: () => void;
  onToggle: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  const done = tasks.filter((t) => t.completed).length;
  const pct = tasks.length ? done / tasks.length : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="t-label">Checklist</p>
        {tasks.length > 0 && (
          <span className="tabular text-subhead font-medium text-ink-2">
            {done}/{tasks.length}
          </span>
        )}
      </div>
      {tasks.length > 0 && (
        <div className="h-px bg-line">
          <motion.div className="h-full rounded-full bg-signal" initial={false} animate={{ width: `${pct * 100}%` }} transition={spring.glide} />
        </div>
      )}

      {loading ? (
        <Skeleton className="h-12" />
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }}
                className="flex items-center gap-1 rounded-xl border border-line bg-bg/40 pr-1"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={t.completed}
                  onClick={() => onToggle(t.id)}
                  className="flex min-h-[48px] flex-1 items-center gap-3 px-3 text-left"
                >
                  <motion.span
                    animate={t.completed ? { scale: [0.8, 1.15, 1] } : { scale: 1 }}
                    transition={spring.pop}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${t.completed ? "border-signal bg-signal" : "border-ink-3/60 bg-transparent"}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                      <motion.path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="white"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ pathLength: t.completed ? 1 : 0, opacity: t.completed ? 1 : 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      />
                    </svg>
                  </motion.span>
                  <span className="relative min-w-0 truncate text-subhead text-ink">
                    <span className={t.completed ? "text-ink-3" : ""}>{t.title}</span>
                    <motion.span
                      className="absolute left-0 top-1/2 h-px w-full origin-left bg-ink-3"
                      initial={false}
                      animate={{ scaleX: t.completed ? 1 : 0 }}
                      transition={{ duration: 0.25 }}
                    />
                  </span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    aria-label={`Delete ${t.title}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:text-crimson"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task"
          aria-label="New task"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onAdd}
          aria-label="Add task"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ink transition-colors hover:bg-overlay"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>
    </div>
  );
}

/** Host's view of the partner's session: elapsed time since check-in, from the server's timestamp. */
function LiveSessionClock({ startedAt, targetMinutes }: { startedAt: string; targetMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sync = () => setNow(Date.now());
    const id = setInterval(sync, 1000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const start = new Date(startedAt).getTime();
  const elapsed = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  const target = targetMinutes * 60;
  const pct = target > 0 ? Math.min(1, elapsed / target) : 0;
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <span className="t-label">Their session</span>
        <span className="t-display tabular text-title-2 text-ink">
          {formatClock(elapsed)}
          {target > 0 && <span className="text-subhead text-ink-3"> / {formatClock(target)}</span>}
        </span>
      </div>
      {target > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full bg-signal transition-[width] duration-1000" style={{ width: `${pct * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function FocusOverlay({
  mission,
  time,
  progress,
  countdown,
  running,
  onToggle,
  onMinimize,
  onFinish,
  children
}: {
  mission: Mission;
  time: string;
  progress: number;
  countdown: boolean;
  running: boolean;
  onToggle: () => void;
  onMinimize: () => void;
  onFinish: () => void;
  children: React.ReactNode;
}) {
  const R = 130;
  const C = 2 * Math.PI * R;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="fixed inset-0 z-[990] flex select-none flex-col overflow-y-auto bg-bg text-ink"
      role="dialog"
      aria-modal="true"
      aria-label={`Focus: ${mission.title}`}
    >
      {/* Breathing atmosphere */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(60% 45% at 50% 40%, rgb(var(--cherry) / 0.16), transparent 70%)" }}
        animate={running ? { opacity: [0.5, 0.9, 0.5], scale: [1, 1.06, 1] } : { opacity: 0.25, scale: 1 }}
        transition={running ? { duration: 6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6 }}
      />

      <div className="relative flex items-center justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 className="t-display truncate text-title-2 text-ink">{mission.title}</h2>
        </div>
        <button
          type="button"
          onClick={onMinimize}
          className="flex h-11 shrink-0 items-center rounded-xl border border-line bg-surface/70 px-4 text-subhead font-medium text-ink-2 backdrop-blur transition-colors hover:text-ink"
        >
          Minimize
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-10 px-5 py-8">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring.glide, delay: 0.1 }}
          className="relative flex h-[300px] w-[300px] items-center justify-center"
        >
          <svg viewBox="0 0 300 300" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="150" cy="150" r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="4" />
            <motion.circle
              cx="150"
              cy="150"
              r={R}
              fill="none"
              stroke="rgb(var(--signal))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              animate={{ strokeDashoffset: C * (1 - Math.min(1, Math.max(0, progress))) }}
              transition={{ duration: 0.9, ease: "linear" }}
              
            />
          </svg>
          <div className="text-center">
            <motion.p
              key={running ? "run" : "pause"}
              initial={{ opacity: 0.4 }}
              animate={running ? { opacity: 1 } : { opacity: [1, 0.35, 1] }}
              transition={running ? { duration: 0.2 } : { duration: 1.4, repeat: Infinity }}
              className="t-display tabular text-[64px] leading-none text-ink"
            >
              {time}
            </motion.p>
            <p className="t-label mt-3">{running ? (countdown ? "Remaining" : "Elapsed") : "Paused"}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="w-full rounded-card border border-line bg-surface/80 p-4 backdrop-blur">
          {children}
        </motion.div>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={onToggle}
          aria-label={running ? "Pause" : "Resume"}
          className="btn-ghost h-14 w-14 shrink-0 tracking-normal"
        >
          {running ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onFinish}
          className="flex h-14 flex-1 items-center justify-center gap-2 btn-primary"
        >
          <Check className="h-5 w-5" strokeWidth={2.75} /> Finish
        </motion.button>
      </div>
    </motion.div>
  );
}
