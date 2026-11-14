"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { X, Check, Plus, AlertCircle, Share2, RefreshCw, ImagePlus, Trash2, ChevronDown } from "lucide-react";
import { LockinMark } from "./ui/LockinLogo";
import { uploadImage } from "../lib/supabase";
import { User, Mission } from "../app/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, fieldClass } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { spring } from "../lib/motion";
import { STARTER_QUESTS, StarterQuest, getStarterQuestsByPillar, getStarterQuestGroups } from "../lib/starterQuests";
import QuickFocusModal from "./QuickFocusModal";
import QuickFocusDock from "./QuickFocusDock";

const SWIPE_THRESHOLD = 120;

const getDefaultDatetime = () => {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const initials = (name = "?") =>
  name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const formatDate = (value?: string | null) => {
  if (!value) return "Anytime";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "Anytime";
    return new Intl.DateTimeFormat("en", {
      weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric"
    }).format(d);
  } catch {
    return "Anytime";
  }
};

const CORE_CATEGORIES = [
  { id: "all", name: "All" },
  { id: "side_quest", name: "Side Quests" },
  { id: "1", name: "Coding" },
  { id: "8", name: "Fitness" },
  { id: "9", name: "Study" },
  { id: "19", name: "Discipline" }
];

interface FeedProps {
  user: User;
  refreshUser: () => Promise<void>;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
  setTab?: (tab: string) => void;
}

type Dir = "left" | "right";

export default function Feed({ user, refreshUser, locked, setLocked, api, setTab }: FeedProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [categories, setCategories] = useState<{ id: number; categoryName: string; emoji?: string; colorHex?: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickModalDuration, setQuickModalDuration] = useState(45);
  const [exitDir, setExitDir] = useState<Dir>("left");
  const [busy, setBusy] = useState(false);
  const [lockedFlash, setLockedFlash] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: user.location || "SRM KTR Library",
    datetime: getDefaultDatetime(),
    categoryId: "1",
    missionType: "group"
  });
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCustomizeCover, setShowCustomizeCover] = useState(false);
  const [coverColor, setCoverColor] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<string>("All");

  // Event Mode V2 states
  const [isEvent, setIsEvent] = useState(false);
  const [showEventSettings, setShowEventSettings] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [registrationQuestions, setRegistrationQuestions] = useState<string[]>(["What are you building or studying?"]);
  const [secretInfo, setSecretInfo] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [rsvpingMission, setRsvpingMission] = useState<Mission | null>(null);
  const [rsvpAnswers, setRsvpAnswers] = useState<{ [qIndex: number]: string }>({});
  const [submittingRsvp, setSubmittingRsvp] = useState(false);

  const getQuestions = (qStr?: string | null): string[] => {
    if (!qStr) return [];
    try {
      const parsed = JSON.parse(qStr);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
    } catch {}
    return [qStr];
  };

  const applyStarterQuest = useCallback((quest: StarterQuest) => {
    setSelectedQuestId(quest.id);
    const isSolo = quest.missionType === "solo";
    setForm({
      title: quest.title,
      description: quest.description,
      location: isSolo ? "Solo" : (user.location || quest.defaultLocation),
      datetime: isSolo ? new Date().toISOString().slice(0, 16) : getDefaultDatetime(),
      categoryId: String(quest.categoryId),
      missionType: quest.missionType
    });
    setTasks([...quest.tasks]);
    if (quest.coverColor) setCoverColor(quest.coverColor);
    if (quest.coverImage) setCoverImage(quest.coverImage);
  }, [user.location]);

  const addTask = () => {
    if (newTaskTitle.trim()) {
      setTasks([...tasks, newTaskTitle.trim()]);
      setNewTaskTitle("");
    }
  };

  const removeTask = (idx: number) => setTasks(tasks.filter((_, i) => i !== idx));

  async function load(catId: string = "all") {
    try {
      if (catId === "side_quest") {
        const questMissions: Mission[] = STARTER_QUESTS.map((q, idx) => ({
          id: 9000 + idx,
          creator_id: null,
          title: q.title,
          description: q.description,
          location: q.defaultLocation,
          datetime: null,
          creator_name: null,
          creator_department: "Side Quest",
          is_system: true,
          category_name: q.categoryName,
          category_id: q.categoryId,
          mission_type: "side_quest",
          focus_duration: q.focusDuration,
          cover_color: q.coverColor,
          cover_image: q.coverImage,
          locked_in_count: 0,
          attendees: []
        }));
        setMissions(questMissions);
        setIndex(0);
        return;
      }

      const [feed, lock] = await Promise.all([
        api(`/missions/feed?userId=${user.id}&categoryId=${catId}`),
        api(`/users/${user.id}/lock`).catch(() => ({ locked: false }))
      ]);
      setLocked(Boolean(lock?.locked));
      if (typeof window !== "undefined") {
        localStorage.removeItem(`lockin_passed_${user.id}`);
      }
      let missionList: Mission[] = Array.isArray(feed) ? feed : [];

      if (missionList.length === 0) {
        // Guarantee that side quests are always available in card swipe format
        const filteredQuests =
          catId === "all"
            ? STARTER_QUESTS
            : catId === "1"
            ? STARTER_QUESTS.filter((q) => q.pillar === "Grind" || q.categoryId === 1)
            : catId === "8"
            ? STARTER_QUESTS.filter((q) => q.pillar === "Physical" || q.categoryId === 8)
            : catId === "9"
            ? STARTER_QUESTS.filter((q) => q.pillar === "Academics" || q.categoryId === 9 || q.pillar === "Grind")
            : STARTER_QUESTS.filter((q) => q.pillar === "Discipline" || q.pillar === "Research");

        missionList = filteredQuests.map((q, idx) => ({
          id: 9000 + idx,
          creator_id: null,
          title: q.title,
          description: q.description,
          location: q.defaultLocation,
          datetime: null,
          creator_name: null,
          creator_department: "Side Quest",
          is_system: true,
          category_name: q.categoryName,
          category_id: q.categoryId,
          mission_type: "side_quest",
          focus_duration: q.focusDuration,
          cover_color: q.coverColor,
          cover_image: q.coverImage,
          locked_in_count: 0,
          attendees: []
        }));
      }

      setMissions(missionList);
      setIndex(0);
    } catch (err: any) {
      console.error("Feed load error:", err);
      // Guarantee swipe cards even on network error
      setMissions(
        STARTER_QUESTS.map((q, idx) => ({
          id: 9000 + idx,
          creator_id: null,
          title: q.title,
          description: q.description,
          location: q.defaultLocation,
          datetime: null,
          creator_name: null,
          creator_department: "Side Quest",
          is_system: true,
          category_name: q.categoryName,
          category_id: q.categoryId,
          mission_type: "side_quest",
          focus_duration: q.focusDuration,
          cover_color: q.coverColor,
          cover_image: q.coverImage,
          locked_in_count: 0,
          attendees: []
        }))
      );
      setIndex(0);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(activeCategory); }, [user.id, activeCategory]);
  useEffect(() => {
    api("/missions/categories")
      .then((data) => setCategories(data))
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  // Prompt user to launch a focus mission when they log in / start app
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const key = `lockin_timer_${user.id}`;
    const hasActiveTimer = localStorage.getItem(key);
    const dismissedThisSession = sessionStorage.getItem("lockin_launch_prompt_dismissed");
    if (!hasActiveTimer && !dismissedThisSession) {
      const timer = setTimeout(() => {
        setShowQuickModal(true);
        sessionStorage.setItem("lockin_launch_prompt_dismissed", "1");
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [user.id]);

  const currentMission = missions[Math.min(index, Math.max(0, missions.length - 1))];
  // The last pass, kept for a few seconds so it can be undone.
  const [lastPassed, setLastPassed] = useState<Mission | null>(null);
  useEffect(() => {
    if (!lastPassed) return;
    const t = setTimeout(() => setLastPassed(null), 5000);
    return () => clearTimeout(t);
  }, [lastPassed]);
  function undoPass() {
    if (!lastPassed) return;
    const m = lastPassed;
    setLastPassed(null);
    setExitDir("left");
    setMissions((ms) => (ms.some((x) => x.id === m.id) ? ms : [m, ...ms]));
  }

  const handleAction = useCallback(async (action: "accept" | "pass") => {
    if (!currentMission || busy) return;
    if (action === "accept" && locked) {
      setError("Mission queue full. Finish an active mission first.");
      return;
    }
    const mission = currentMission;

    // If this is an event with a required registration question, prompt for RSVP note first
    if (action === "accept" && mission.is_event && mission.registration_q) {
      setRsvpingMission(mission);
      setRsvpAnswers({});
      return;
    }

    setError("");
    setExitDir(action === "accept" ? "right" : "left");
    // Optimistic: the card leaves immediately; the server catches up behind it.
    setMissions((ms) => ms.filter((m) => m.id !== mission.id));

    if (action === "pass") {
      setLastPassed(mission);
      if (mission.id < 9000) {
        api(`/missions/${mission.id}/pass`, { method: "POST" }).catch(() => {});
      }
      return;
    }
    setLastPassed(null);

    setBusy(true);
    setLockedFlash(true);
    const minFlash = new Promise((r) => setTimeout(r, 900));
    try {
      if (mission.id >= 9000) {
        // Direct launch into active solo mission
        await api("/missions", {
          method: "POST",
          body: JSON.stringify({
            title: mission.title,
            description: mission.description,
            creator_id: user.id,
            location: mission.location || "Solo",
            datetime: new Date().toISOString(),
            categoryId: mission.category_id || 1,
            focusDuration: mission.focus_duration || 25,
            missionType: "solo",
            // Not started yet: the queue shows "Start session" and the clock
            // begins when the user actually starts (server default is start now).
            startNow: false,
            coverColor: mission.cover_color || null,
            coverImage: mission.cover_image || null
          })
        });
      } else {
        try {
          await api(`/missions/${mission.id}/accept`, { method: "POST", body: JSON.stringify({}) });
        } catch (err: any) {
          // A retry after a lost response: the first attempt already joined.
          if (err?.status !== 409) throw err;
        }
      }
      refreshUser().catch(() => {});
      await minFlash;
      setLockedFlash(false);
      setTab?.("active");
    } catch (err: any) {
      setLockedFlash(false);
      const status = err?.status;
      // Gone or already happened: leave it off the deck.
      if (status !== 404 && status !== 410) setMissions((ms) => (ms.some((m) => m.id === mission.id) ? ms : [mission, ...ms]));
      if (status === 423) setLocked(true);
      setError(err?.message || "Couldn't lock in. Try again.");
    } finally {
      setBusy(false);
    }
  }, [currentMission, busy, locked, api, refreshUser, setTab, setLocked]);

  async function submitRsvp(e: React.FormEvent) {
    e.preventDefault();
    if (!rsvpingMission) return;
    setSubmittingRsvp(true);
    const mission = rsvpingMission;
    const questions = getQuestions(mission.registration_q);
    const combinedNote = questions.length > 0
      ? questions.map((q, idx) => `Q: ${q}\nA: ${rsvpAnswers[idx]?.trim() || "Attending"}`).join("\n\n")
      : "";

    try {
      setRsvpingMission(null);
      setExitDir("right");
      setMissions((ms) => ms.filter((m) => m.id !== mission.id));
      setLockedFlash(true);
      const minFlash = new Promise((r) => setTimeout(r, 900));
      await api(`/missions/${mission.id}/accept`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id, applicationNote: combinedNote })
      });
      setRsvpAnswers({});
      refreshUser().catch(() => {});
      await minFlash;
      setLockedFlash(false);
      setTab?.("active");
    } catch (err: any) {
      setLockedFlash(false);
      setError(err?.message || "Failed to submit RSVP.");
    } finally {
      setSubmittingRsvp(false);
    }
  }

  // Keyboard: ← pass, → lock in
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showCreate || rsvpingMission) return;
      const t = e.target as HTMLElement | null;
      // Arrows belong to whatever has focus (tabs, buttons, fields, dialogs) before the deck.
      if (t && t.closest && t.closest('input, textarea, select, button, a, [role="tab"], [role="dialog"], [contenteditable="true"]')) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowLeft") handleAction("pass");
      if (e.key === "ArrowRight") handleAction("accept");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleAction, showCreate, rsvpingMission]);

  async function handleCreateMission(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setCreateError("");
    setError("");
    try {
      const isSolo = form.missionType === "solo";
      const payload = {
        ...form,
        creator_id: user.id,
        categoryId: Number(form.categoryId),
        location: isSolo ? "Solo" : form.location,
        datetime: isSolo ? new Date().toISOString() : (form.datetime ? new Date(form.datetime).toISOString() : new Date().toISOString()),
        coverColor: coverColor || null,
        coverImage: coverImage || null,
        isEvent: isSolo ? false : isEvent,
        requireApproval: isSolo ? false : requireApproval,
        registrationQ: (!isSolo && isEvent && requireApproval)
          ? (registrationQuestions.filter((q) => q.trim()).length > 0
              ? JSON.stringify(registrationQuestions.filter((q) => q.trim()))
              : null)
          : null,
        secretInfo: (!isSolo && isEvent && secretInfo.trim()) ? secretInfo.trim() : null,
        maxCapacity: (!isSolo && isEvent && maxCapacity.trim()) ? Number(maxCapacity) : null,
        // Solo missions wait in the queue until the user taps Start.
        ...(isSolo ? { startNow: false } : {})
      };
      const newMission = await api("/missions", { method: "POST", body: JSON.stringify(payload) });
      if (tasks.length > 0 && newMission?.id) {
        // The mission exists now. A task hiccup must not leave the form open,
        // or a retry would launch the mission twice.
        await api("/tasks/batch", {
          method: "POST",
          body: JSON.stringify({ missionId: newMission.id, tasks: tasks.map((t, idx) => ({ title: t, position: idx })) })
        }).catch(() => setError("Mission launched, but its tasks didn't save. Add them from your queue."));
      }
      setShowCreate(false);
      setTab?.("active");
      setForm({
        title: "", description: "", location: user.location || "SRM KTR Library",
        datetime: getDefaultDatetime(), categoryId: categories[0]?.id ? String(categories[0].id) : "1", missionType: "group"
      });
      setTasks([]);
      setCoverColor("");
      setCoverImage("");
      setShowCustomizeCover(false);
      setSelectedQuestId(null);
      setIsEvent(false);
      setShowEventSettings(false);
      setRequireApproval(false);
      setRegistrationQuestions(["What are you building or studying?"]);
      setSecretInfo("");
      setMaxCapacity("");
      await load(activeCategory);
    } catch (err: any) {
      setCreateError(err.message || "Could not launch mission.");
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = missions.length;
  const deck = missions.slice(index + 1, index + 3);

  return (
    <section className="mx-auto w-full max-w-md flex-1 px-5 pt-3 md:max-w-[1240px] md:px-12 md:pt-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-line pb-3 md:items-end md:pb-8">
        <div>
          <p className="t-section hidden md:block">Campus · Live</p>
          <h1 className="t-display text-title-1 text-ink md:mt-3 md:text-[56px] md:leading-none">Missions</h1>
          <p className="mt-2 hidden text-subhead text-ink-3 md:block">
            {loaded ? (remaining > 0 ? `${remaining} waiting on your call` : "You're all caught up") : "Scanning campus…"}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => setShowCreate(true)}
          whileTap={{ scale: 0.95 }}
          whileHover="hover"
          transition={spring.snap}
          className="group btn-primary h-11 shrink-0 px-3.5 md:h-12 md:px-6"
        >
          <motion.span variants={{ hover: { rotate: 90 } }} transition={spring.snap} className="flex">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </motion.span>
          Launch
        </motion.button>
      </div>

      {/* Categories: 5 Clean Pillars */}
      <div className="-mx-5 flex gap-1.5 overflow-x-auto border-b border-line px-5 py-1 scrollbar-none md:mx-0 md:py-2.5 md:justify-center md:px-0" role="tablist" aria-label="Mission categories">
        {CORE_CATEGORIES.map((c) => {
          const selected = activeCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => { setActiveCategory(c.id); setError(""); }}
              className={`relative flex h-11 shrink-0 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors rounded-sm ${selected ? "text-ink bg-raised" : "text-ink-3 hover:text-ink-2 hover:bg-raised/40"}`}
            >
              {c.name}
              {selected && <motion.span layoutId="cat-active" className="absolute inset-x-3 bottom-0 h-0.5 bg-signal" transition={spring.glide} />}
            </button>
          );
        })}
      </div>

      {/* The deck: one card, centred, the whole point of the page */}
      <div className="mx-auto mt-4 w-full max-w-[640px] md:mt-10">
        {/* Quick Focus / Pomodoro Dock & Active Session Beacon */}
        <QuickFocusDock
          user={user}
          onOpenModal={(mins) => {
            setQuickModalDuration(mins || 45);
            setShowQuickModal(true);
          }}
          setTab={setTab}
        />

        <div className="relative perspective-distant">
          {deck.slice().reverse().map((m) => {
            const depth = missions.indexOf(m) - index; // 1 or 2
            return (
              <motion.div
                key={`deck-${m.id}`}
                aria-hidden="true"
                initial={false}
                animate={{ scale: 1 - depth * 0.045, y: depth * 14, opacity: 1 - depth * 0.38 }}
                transition={spring.card}
                className="pointer-events-none absolute inset-0 rounded-sm border border-line bg-surface"
              />
            );
          })}

          <AnimatePresence custom={exitDir} initial={false} mode="popLayout">
            {currentMission ? (
              <SwipeCard key={currentMission.id} mission={currentMission} exitDir={exitDir} onSwipe={(dir) => handleAction(dir === "right" ? "accept" : "pass")} />
            ) : loaded ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring.glide}
                className="relative flex min-h-[460px] w-full flex-col justify-between overflow-hidden rounded-sm border border-line bg-surface p-6 md:min-h-[560px] md:p-10"
              >
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-signal" />
                
                <div className="flex items-start justify-between">
                  <p className="t-section text-ink-3">Deck cleared</p>
                  <LockinMark size={48} className="text-ink/15 md:size-[72px]" />
                </div>
                
                <div className="my-auto py-8 text-center">
                  <span className="inline-block rounded-full border border-signal/40 bg-signal/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">
                    All caught up
                  </span>
                  <h2 className="t-display mt-4 text-[28px] leading-[1.05] text-ink sm:text-[36px] md:text-[44px]">
                    Deck cleared.
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-subhead text-ink-2 md:text-body">
                    Ready to keep moving? Reset the deck to swipe through side quests again.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        localStorage.removeItem(`lockin_passed_${user.id}`);
                      }
                      load(activeCategory);
                    }}
                    className="btn-primary h-14 sm:flex-1"
                  >
                    <RefreshCw className="h-4 w-4" strokeWidth={2} />
                    Reset &amp; swipe side quests
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="btn-ghost h-14 sm:px-6"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} /> Launch custom
                  </button>
                </div>
              </motion.div>
            ) : (
              <div key="loading" className="min-h-[360px] w-full animate-pulse rounded-sm border border-line bg-surface md:min-h-[560px]" />
            )}
          </AnimatePresence>

          {/* Lock-in moment */}
          <AnimatePresence>
            {lockedFlash && (
              <motion.div
                key="flash"
                role="status"
                aria-live="assertive"
                className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden rounded-sm bg-signal text-ink"
                initial={{ clipPath: "circle(0% at 70% 85%)" }}
                animate={{ clipPath: "circle(150% at 70% 85%)" }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <LockinMark size={72} color="rgb(var(--ink))" animate delay={0.05} />
                <motion.p
                  initial={{ opacity: 0, y: 10, letterSpacing: "0.5em" }}
                  animate={{ opacity: 1, y: 0, letterSpacing: "0.3em" }}
                  transition={{ delay: 0.25, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-6 text-title-3 font-medium uppercase"
                >
                  Locked in
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                  className="mt-2 text-subhead text-ink/80"
                >
                  It&apos;s in your Queue.
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-center text-subhead text-crimson">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {(currentMission || lastPassed) && (
          <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 -mx-5 mt-3 border-t border-line bg-bg/95 px-5 pb-2.5 pt-2.5 backdrop-blur md:static md:mx-0 md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            {locked && currentMission && (
              <p className="-mt-1 mb-1.5 flex items-center justify-between gap-3 text-footnote text-ink-2">
                <span className="flex min-w-0 items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-crimson" strokeWidth={1.75} />
                  <span className="truncate">Queue full<span className="hidden sm:inline">: finish one of your 3 missions first</span></span>
                </span>
                <button type="button" onClick={() => setTab?.("active")} className="h-11 shrink-0 text-footnote font-medium text-ink underline underline-offset-4">
                  Open Queue
                </button>
              </p>
            )}
            {currentMission && (
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <motion.button type="button" onClick={() => handleAction("pass")} disabled={busy} whileTap={{ scale: 0.97 }} transition={spring.snap} className="btn-ghost h-12 md:h-16">
                <X className="h-4 w-4" strokeWidth={1.75} /> Pass
              </motion.button>
              <motion.button type="button" onClick={() => handleAction("accept")} disabled={locked || busy} whileTap={{ scale: 0.97 }} transition={spring.snap} className="btn-primary h-12 md:h-16">
                <Check className="h-4 w-4" strokeWidth={1.75} /> {currentMission.is_event ? (currentMission.require_approval ? "Request to join" : "RSVP") : "Lock in"}
              </motion.button>
            </div>
            )}
            <div className={`${lastPassed ? "flex" : "hidden md:flex"} mt-1.5 min-h-[28px] items-center justify-center md:mt-4`} aria-live="polite">
              {lastPassed ? (
                <p className="flex items-center gap-3 text-footnote text-ink-2">
                  <span className="max-w-[200px] truncate">Passed {lastPassed.title}</span>
                  <button type="button" onClick={undoPass} className="h-11 px-2 font-medium text-ink underline underline-offset-4">
                    Undo
                  </button>
                </p>
              ) : (
                <p className="t-label text-center">
                  <span className="md:hidden">Swipe right to lock in · left to pass</span>
                  <span className="hidden md:inline">Swipe, or ← pass · → lock in</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create mission */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl max-w-full overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Launch a mission</DialogTitle>
            <DialogDescription>Say what you're doing, when and where. People on your campus can lock in with you.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMission} className="space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
            {/* Starter Quest Templates Selector */}
            <div className="rounded-xl border border-line bg-raised/70 p-3.5 space-y-3 w-full min-w-0 max-w-full overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="t-label text-[11px] font-semibold text-ink">Side Quest Templates (1-Tap Fill)</span>
                {selectedQuestId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQuestId(null);
                      setForm({
                        title: "",
                        description: "",
                        location: user.location || "SRM KTR Library",
                        datetime: getDefaultDatetime(),
                        categoryId: categories[0]?.id ? String(categories[0].id) : "1",
                        missionType: "group"
                      });
                      setTasks([]);
                      setCoverColor("");
                      setCoverImage("");
                    }}
                    className="text-caption font-medium uppercase tracking-wider text-crimson hover:text-ink transition-colors"
                  >
                    Clear template
                  </button>
                )}
              </div>

              {/* Side Quest Dropdown Selector */}
              <div className="relative w-full">
                <select
                  id="side-quest-dropdown"
                  value={selectedQuestId || ""}
                  onChange={(e) => {
                    const qId = e.target.value;
                    if (!qId) {
                      setSelectedQuestId(null);
                      return;
                    }
                    const found = STARTER_QUESTS.find((q) => q.id === qId);
                    if (found) applyStarterQuest(found);
                  }}
                  className={`${fieldClass} h-11 appearance-none pr-9 text-subhead bg-surface/90 border-line text-ink cursor-pointer focus:border-crimson`}
                >
                  <option value="" className="bg-surface text-ink-3">
                    Choose a Side Quest template (1-Tap Fill)...
                  </option>
                  {getStarterQuestGroups().map((group) => (
                    <optgroup key={group.label} label={group.label} className="bg-surface text-ink font-semibold">
                      {group.quests.map((q) => (
                        <option key={q.id} value={q.id} className="bg-surface text-ink-2 font-normal">
                          {q.shortTitle} · {q.badge} ({q.focusDuration}m {q.missionType})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
              </div>

              {/* Pillar filters */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 w-full min-w-0">
                {["All", "Academics", "CS Grind", "App Research", "Physical", "Discipline", "Social"].map((pillar) => (
                  <button
                    key={pillar}
                    type="button"
                    onClick={() => setSelectedPillar(pillar)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition shrink-0 ${
                      selectedPillar === pillar
                        ? "bg-ink text-bg font-semibold"
                        : "bg-surface text-ink-3 hover:text-ink hover:bg-overlay"
                    }`}
                  >
                    {pillar}
                  </button>
                ))}
              </div>

              {/* Templates scroller */}
              <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1 w-full min-w-0">
                {getStarterQuestsByPillar(selectedPillar).map((q) => {
                  const isSelected = selectedQuestId === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => applyStarterQuest(q)}
                      className={`flex w-44 shrink-0 flex-col justify-between rounded-lg border p-2.5 text-left transition ${
                        isSelected
                          ? "border-crimson bg-surface ring-1 ring-crimson shadow-[0_0_12px_rgba(210,4,45,0.15)]"
                          : "border-line bg-surface hover:border-ink/50 hover:bg-overlay"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-crimson">{q.badge}</span>
                        <span className="text-[9px] uppercase tracking-wider text-ink-3">{q.pillar}</span>
                      </div>
                      <p className="text-subhead font-medium text-ink line-clamp-1">{q.title}</p>
                      <p className="text-[11px] text-ink-3 mt-1">{q.focusDuration} min · {q.missionType}</p>
                    </button>
                  );
                })}
              </div>

              {selectedQuestId && (
                <div className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-footnote text-ink-2 border border-line">
                  <span className="text-crimson font-bold text-xs">✓</span>
                  <span>Template loaded · You can customize any title, tasks, time, or location below.</span>
                </div>
              )}
            </div>

            {createError && (
              <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-signal/70 bg-surface p-3 text-subhead text-ink">
                <AlertCircle className="h-5 w-5 shrink-0 text-crimson" />
                <span>{createError}</span>
              </div>
            )}

            <Field label="Type">
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-raised p-1" role="radiogroup">
                {["group", "solo"].map((t) => {
                  const on = form.missionType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm({ ...form, missionType: t })}
                      className={`relative h-10 rounded-sm text-footnote font-medium uppercase tracking-[0.22em] transition-colors ${on ? "text-bg" : "text-ink-3 hover:text-ink-2"}`}
                    >
                      {on && <motion.span layoutId="type-active" className="absolute inset-0 rounded-sm bg-ink" transition={spring.snap} />}
                      <span className="relative">{t === "group" ? "Group" : "Solo"}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Mission" htmlFor="m-title">
              <Input id="m-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="LeetCode lock-in" required />
            </Field>

            <Field label="What gets done" htmlFor="m-desc">
              <Textarea id="m-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Five mediums on graphs. No phones." required />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <Field label="Category" htmlFor="m-cat">
                <select
                  id="m-cat"
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className={`${fieldClass} h-12 appearance-none`}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-surface text-ink">
                      {c.categoryName}
                    </option>
                  ))}
                </select>
              </Field>

              {form.missionType === "group" && (
                <Field label="Where" htmlFor="m-loc">
                  <Input id="m-loc" list="campus-locations-list" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Central Library" required />
                  <datalist id="campus-locations-list">
                    <option value="SRM KTR Library" />
                    <option value="SRM KTR Tech Park" />
                    <option value="SRM KTR Java Canteen" />
                    <option value="SRM KTR Bio-Tech Block" />
                    <option value="SRM KTR UB Block" />
                    <option value="Campus Central Library" />
                    <option value="Hostel Common Room" />
                    <option value="Online / Discord" />
                  </datalist>
                </Field>
              )}
            </div>

            {form.missionType === "group" && (
              <Field label="When" htmlFor="m-when">
                <Input
                  id="m-when"
                  type="datetime-local"
                  value={form.datetime}
                  min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setForm({ ...form, datetime: e.target.value })}
                  required
                />
              </Field>
            )}

            <Field label="Checklist" hint="Optional. Tasks count toward your outcome." htmlFor="m-task">
              <div className="flex gap-2">
                <Input
                  id="m-task"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a task"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
                />
                <button type="button" onClick={addTask} className="h-12 shrink-0 rounded-xl border border-line bg-raised px-4 text-subhead font-semibold text-ink transition-colors hover:bg-overlay">
                  Add
                </button>
              </div>
              <AnimatePresence initial={false}>
                {tasks.map((t, idx) => (
                  <motion.div
                    key={`${t}-${idx}`}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                    className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-line bg-raised py-1 pl-3.5 pr-1"
                  >
                    <span className="truncate text-subhead text-ink">{t}</span>
                    <button type="button" onClick={() => removeTask(idx)} aria-label={`Remove ${t}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:text-crimson">
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Field>

            {/* Event Mode toggle & options */}
            {form.missionType === "group" && (
              <div className="rounded-xl border border-line bg-surface/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-subhead font-semibold text-ink">Event Mode</p>
                    <p className="text-caption text-ink-3">For meetups, workshops, and large group sessions</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEvent}
                    onClick={() => {
                      const next = !isEvent;
                      setIsEvent(next);
                      if (next) setShowEventSettings(true);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEvent ? "bg-signal" : "bg-raised border border-line"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEvent ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {isEvent && (
                  <div className="flex items-center justify-between pt-2 border-t border-line text-caption text-ink-2">
                    <div>
                      <span>{maxCapacity ? `Cap: ${maxCapacity}` : "Unlimited"}</span>
                      <span className="mx-1.5">·</span>
                      <span>{requireApproval ? `${registrationQuestions.filter((q) => q.trim()).length || 1} questions` : "Open RSVP"}</span>
                      {secretInfo.trim() && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="text-ink-2">Private info set</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEventSettings(true)}
                      className="text-footnote font-semibold text-crimson hover:underline"
                    >
                      Configure Event
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cover */}
            <div className="border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setShowCustomizeCover(!showCustomizeCover)}
                aria-expanded={showCustomizeCover}
                className="flex w-full items-center justify-between py-1 text-left"
              >
                <span className="t-label">Cover &amp; accent</span>
                <motion.span animate={{ rotate: showCustomizeCover ? 45 : 0 }} transition={spring.snap}>
                  <Plus className="h-5 w-5 text-ink-3" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {showCustomizeCover && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center gap-3">
                        {[
                          { name: "Crimson", value: "#B11226" },
                          { name: "Emerald", value: "#10B981" },
                          { name: "Gold", value: "#C5A880" },
                          { name: "Indigo", value: "#6366F1" },
                          { name: "Violet", value: "#8B5CF6" }
                        ].map((color) => (
                          <motion.button
                            key={color.name}
                            type="button"
                            whileTap={{ scale: 0.85 }}
                            onClick={() => setCoverColor(coverColor === color.value ? "" : color.value)}
                            aria-label={`${color.name} accent`}
                            aria-pressed={coverColor === color.value}
                            className="flex h-11 w-11 items-center justify-center rounded-full"
                          >
                            <span
                              className={`h-7 w-7 rounded-sm ring-1 ring-offset-2 ring-offset-surface transition ${coverColor === color.value ? "ring-ink" : "ring-transparent"}`}
                              style={{ backgroundColor: color.value }}
                            />
                          </motion.button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { name: "Ember", value: "linear-gradient(135deg, #2a0705 0%, #0b0b0b 100%)" },
                          { name: "Night", value: "linear-gradient(135deg, #141414 0%, #050505 100%)" },
                          { name: "Brass", value: "linear-gradient(135deg, #241b10 0%, #0b0b0b 100%)" },
                          { name: "Deep", value: "linear-gradient(135deg, #0f1c1e 0%, #0b0b0b 100%)" }
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setCoverImage(coverImage === preset.value ? "" : preset.value)}
                            aria-pressed={coverImage === preset.value}
                            className={`h-12 rounded-xl border text-footnote font-semibold text-ink transition ${
                              coverImage === preset.value ? "border-ink" : "border-line"
                            }`}
                            style={{ background: preset.value }}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          id="cover-upload"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) {
                              setCreateError("");
                              uploadImage(file).then(setCoverImage).catch((err) => setCreateError(err.message));
                            }
                          }}
                        />
                        <label
                          htmlFor="cover-upload"
                          className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-raised px-4 text-subhead font-medium text-ink transition-colors hover:bg-overlay"
                        >
                          <ImagePlus className="h-4 w-4" /> Upload image
                        </label>
                        {coverImage && !coverImage.includes("gradient") && <span className="text-subhead text-success">Image added</span>}
                        {coverImage && (
                          <button type="button" onClick={() => setCoverImage("")} className="text-subhead text-ink-3 hover:text-ink">
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              className="flex h-14 w-full items-center justify-center gap-2 disabled:opacity-50 btn-primary"
            >
              {submitting ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="h-5 w-5" />
                </motion.span>
              ) : (
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              )}
              {submitting ? "Launching" : "Launch mission"}
            </motion.button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event Setup Sheet / Dialog */}
      <Dialog open={showEventSettings} onOpenChange={setShowEventSettings}>
        <DialogContent className="sm:max-w-lg max-w-full overflow-x-hidden max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Configuration</DialogTitle>
            <DialogDescription>
              Set capacity, screening questions, and private access details for your event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <Field label="Guest Capacity" hint="Optional" htmlFor="evt-cap">
                <Input
                  id="evt-cap"
                  type="number"
                  min="2"
                  max="500"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  placeholder="e.g. 25"
                />
              </Field>

              <div className="flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-subhead text-ink">
                  <input
                    type="checkbox"
                    checked={requireApproval}
                    onChange={(e) => setRequireApproval(e.target.checked)}
                    className="rounded border-line bg-raised accent-crimson h-4 w-4"
                  />
                  <span>Require Vetting</span>
                </label>
                <p className="text-[11px] text-ink-3 mt-1">Screen each guest before approving</p>
              </div>
            </div>

            {requireApproval && (
              <div className="space-y-3 rounded-xl border border-line bg-raised/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-semibold uppercase tracking-wider text-ink">
                    Screening Questions
                  </span>
                  <button
                    type="button"
                    onClick={() => setRegistrationQuestions((qs) => [...qs, ""])}
                    className="text-xs font-semibold text-crimson hover:underline flex items-center gap-1"
                  >
                    + Add Question
                  </button>
                </div>
                <div className="space-y-2.5">
                  {registrationQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={q}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegistrationQuestions((qs) => qs.map((item, i) => (i === idx ? val : item)));
                        }}
                        placeholder={`Question ${idx + 1} (e.g. What is your GitHub or major?)`}
                      />
                      {registrationQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRegistrationQuestions((qs) => qs.filter((_, i) => i !== idx))}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:text-crimson transition-colors"
                          aria-label={`Remove question ${idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Field label="Secret Access Details" hint="Revealed to guests once approved (e.g. WhatsApp group, Discord, private room pin)" htmlFor="evt-sec">
              <Textarea
                id="evt-sec"
                value={secretInfo}
                onChange={(e) => setSecretInfo(e.target.value)}
                placeholder="e.g. WhatsApp Group: https://chat.whatsapp.com/... or Room 402, passcode: 1024"
                rows={3}
              />
            </Field>

            <button
              type="button"
              onClick={() => setShowEventSettings(false)}
              className="btn-primary w-full h-12"
            >
              Save Event Settings
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RSVP Registration Dialog */}
      <Dialog open={!!rsvpingMission} onOpenChange={(open) => { if (!open) setRsvpingMission(null); }}>
        <DialogContent className="sm:max-w-md max-w-full overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>RSVP: {rsvpingMission?.title}</DialogTitle>
            <DialogDescription>
              {rsvpingMission?.require_approval
                ? "This event requires host vetting. Answer the questions below to submit your join request."
                : "Confirm your attendance for this event."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRsvp} className="space-y-4 w-full min-w-0">
            {rsvpingMission?.registration_q && (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {getQuestions(rsvpingMission.registration_q).map((q, idx) => (
                  <Field key={idx} label={`Question ${idx + 1}`} htmlFor={`rsvp-q-${idx}`} hint="Reviewed by the event host">
                    <p className="mb-2 text-subhead font-medium text-ink">{q}</p>
                    <Textarea
                      id={`rsvp-q-${idx}`}
                      value={rsvpAnswers[idx] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRsvpAnswers((prev) => ({ ...prev, [idx]: val }));
                      }}
                      placeholder="Your answer..."
                      required
                      rows={2}
                    />
                  </Field>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRsvpingMission(null)}
                className="btn-ghost flex-1 h-12"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRsvp || (!!rsvpingMission?.registration_q && getQuestions(rsvpingMission.registration_q).some((_, i) => !(rsvpAnswers[i] || "").trim()))}
                className="btn-primary flex-1 h-12"
              >
                {submittingRsvp ? "Submitting..." : rsvpingMission?.require_approval ? "Request to Join" : "Confirm RSVP"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Pomodoro Launch Modal */}
      <QuickFocusModal
        open={showQuickModal}
        onOpenChange={setShowQuickModal}
        user={user}
        api={api}
        setTab={setTab}
        refreshUser={refreshUser}
        initialDuration={quickModalDuration}
      />
    </section>
  );
}

/* ───────────────────────── Card pieces ───────────────────────── */

/* ───────────────────────── Departures board ───────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

function clock(now: number) {
  const d = new Date(now);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "02:41:09", "2D 04H", or "NOW". */
function countdown(target?: string | null, now: number = Date.now()) {
  if (!target) return { text: "NOW", soon: false, live: true };
  const ms = new Date(target).getTime() - now;
  if (isNaN(ms) || ms <= 0) return { text: "NOW", soon: true, live: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 1) return { text: `${d}D ${pad(h)}H`, soon: false, live: false };
  return { text: `${pad(h)}:${pad(m)}:${pad(s % 60)}`, soon: ms < 3600e3, live: false };
}

const handleOf = (name?: string) => (name || "host").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

/** Split-flap digits: each character flips in when it changes. */
function Flap({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`tabular inline-flex ${className}`} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span key={i} className="relative inline-flex overflow-hidden" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch + i}
              className="inline-block"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch === " " ? " " : ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="t-label block">{label}</label>
      {children}
      {hint && <p className="text-footnote text-ink-3">{hint}</p>}
    </div>
  );
}

/**
 * Ticking clock for countdowns. Lives in the card, not the whole board, so the
 * page doesn't re-render every second (that made swiping feel laggy on phones).
 */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CardBody({ mission }: { mission: Mission }) {
  const now = useNow();
  const isSystem = Boolean(mission.is_system || mission.mission_type === "side_quest" || !mission.creator_id || !mission.creator_name);
  const t = countdown(mission.datetime, now);
  const hoursUntil = mission.datetime ? (new Date(mission.datetime).getTime() - now) / 3600e3 : 0;
  const soon = Math.min(1, Math.max(0.04, 1 - hoursUntil / 48));
  const photo = mission.cover_image && !mission.cover_image.includes("gradient") ? mission.cover_image : null;
  const crew = mission.locked_in_count ?? 0;

  return (
    <div className="relative flex flex-1 flex-col p-5 md:min-h-[560px] md:p-10">
      <div className="relative flex items-start justify-between gap-3">
        {isSystem ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-sm border border-signal/60 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-crimson">
              Side quest
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
              · {mission.category_name || "Side Quest"}
            </span>
          </div>
        ) : mission.is_event ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-sm border border-signal/60 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-crimson">
              Event · RSVP
            </span>
            {mission.require_approval && (
              <span className="inline-flex items-center rounded-sm border border-line px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-2">
                Host approves
              </span>
            )}
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
              · {mission.category_name || "Event"}
            </span>
          </div>
        ) : (
          <p className="t-section">
            Mission #{pad(mission.id).padStart(4, "0")} · {mission.category_name || (mission.mission_type === "solo" ? "Solo" : "Group")}
          </p>
        )}
        <button
          type="button"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const origin = typeof window !== "undefined" ? window.location.origin : "https://lockin.top";
            const text = isSystem
              ? `*Side Quest: ${mission.title}* on LOCKIN\n${mission.description}\n\nDuration: ${mission.focus_duration || 25} min focus\nLocation: ${mission.location || "Anywhere"}\n\nLock in: ${origin}`
              : mission.is_event
                ? `*Event: ${mission.title}* on LOCKIN\n${mission.description}\n\nWhere: ${mission.location || "Campus"}\nWhen: ${mission.datetime ? formatDate(mission.datetime) : "Anytime"}\nHost: ${mission.creator_name || "Campus peer"}\n\nRSVP: ${origin}`
                : `*${mission.title}* on LOCKIN\n${mission.description}\n\nWhere: ${mission.location || "Campus"}\nWhen: ${mission.datetime ? formatDate(mission.datetime) : "Anytime"}\nHost: ${mission.creator_name || "Campus peer"}\n\nLock in: ${origin}`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
          }}
          aria-label="Share mission on WhatsApp"
          className="-mr-2 -mt-3 flex h-11 w-11 shrink-0 items-center justify-center text-ink-3 transition-colors hover:text-ink"
        >
          <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </div>

      <h2 className="t-display relative mt-4 line-clamp-3 text-[32px] leading-[1.04] text-ink md:mt-8 md:text-[60px] md:leading-[0.98] md:tracking-[-0.04em]">
        {mission.title}
      </h2>

      {photo && (
        <div className="relative mt-5 h-36 overflow-hidden rounded-sm border border-line md:h-52">
          <img src={photo} alt="" className="h-full w-full object-cover grayscale-[35%]" />
        </div>
      )}

      <p className={`relative mt-3 max-w-[52ch] text-subhead leading-relaxed text-ink-2 md:mt-5 md:text-[17px] ${photo ? "line-clamp-2" : "line-clamp-2 md:line-clamp-3"}`}>{mission.description}</p>

      <div className="relative mt-auto pt-6 md:pt-8">
        <div className="flex items-end justify-between gap-4">
          {isSystem ? (
            <div>
              <p className="t-label">Focus session</p>
              <p className="t-display mt-2 text-[34px] leading-none text-ink md:text-[56px]">
                {mission.focus_duration || 25} <span className="text-[20px] md:text-[28px] font-light text-ink-3">MIN</span>
              </p>
            </div>
          ) : (
            <div>
              <p className="t-label">{t.live ? "Started" : "Leaves in"}</p>
              <p className={`t-display mt-2 text-[34px] leading-none md:text-[56px] ${t.soon ? "text-crimson" : "text-ink"}`}>
                {t.live ? "Now" : <Flap text={t.text} />}
              </p>
            </div>
          )}
          <p className="t-label shrink-0 pb-1 text-right">
            {isSystem ? (
              <>
                <span className="block text-callout normal-case tracking-normal text-ink">Start anytime</span>
                No set time
              </>
            ) : (
              <>
                <span className="block text-callout normal-case tracking-normal text-ink">
                  {mission.is_event && mission.max_capacity ? `${crew} / ${mission.max_capacity}` : crew}
                </span>
                {mission.is_event ? "attending" : "locked in"}
              </>
            )}
          </p>
        </div>

        <div className="relative mt-4 h-px bg-line">
          {isSystem ? (
            <div className="absolute inset-y-0 left-0 w-1/3 bg-signal" />
          ) : (
            <motion.div className="absolute inset-y-0 left-0 bg-signal" initial={{ width: 0 }} animate={{ width: `${soon * 100}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
          )}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
          <p className="t-label truncate">
            {isSystem ? `Anytime · ${mission.location || "Anywhere"}` : `${mission.datetime ? formatDate(mission.datetime) : "Anytime"} · ${mission.location || "Campus"}`}
          </p>
          <p className="t-label truncate">
            {isSystem ? (
              <span>By LOCKIN</span>
            ) : (
              `@${mission.creator_username || handleOf(mission.creator_name || undefined)}`
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

const flyOut = {
  exit: (dir: Dir) => ({
    x: dir === "right" ? 520 : -520,
    rotate: dir === "right" ? 24 : -24,
    opacity: 0,
    transition: { duration: 0.42, ease: [0.4, 0, 0.6, 1] }
  })
};

const SwipeCard = React.forwardRef<HTMLElement, { mission: Mission; exitDir: Dir; onSwipe: (dir: Dir) => void }>(function SwipeCard({ mission, exitDir, onSwipe }, forwarded) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-8, 8]);
  const acceptOpacity = useTransform(x, [30, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, -30], [1, 0]);
  const acceptScale = useTransform(x, [30, SWIPE_THRESHOLD], [0.8, 1]);
  const passScale = useTransform(x, [-SWIPE_THRESHOLD, -30], [1, 0.8]);
  const edgeGlow = useTransform(x, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [
    "0 0 0 1px rgb(120,118,115)",
    "0 0 0 1px rgb(32,32,32)",
    "0 0 0 1px rgb(244,242,238)"
  ]);

  // Fine-pointer tilt + glare
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const sx = useSpring(tx, { stiffness: 250, damping: 28 });
  const sy = useSpring(ty, { stiffness: 250, damping: 28 });
  const rotateX = useTransform(sy, [-0.5, 0.5], ["3deg", "-3deg"]);
  const rotateY = useTransform(sx, [-0.5, 0.5], ["-3deg", "3deg"]);
  const gx = useTransform(sx, [-0.5, 0.5], [0, 100]);
  const gy = useTransform(sy, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.14), transparent 55%)`;
  const ref = useRef<HTMLElement | null>(null);

  return (
    <motion.article
      ref={(el: HTMLElement | null) => {
        (ref as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof forwarded === "function") forwarded(el);
        else if (forwarded) (forwarded as React.MutableRefObject<HTMLElement | null>).current = el;
      }}
      custom={exitDir}
      variants={flyOut}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        const power = info.offset.x + info.velocity.x * 0.2;
        if (power > SWIPE_THRESHOLD) onSwipe("right");
        else if (power < -SWIPE_THRESHOLD) onSwipe("left");
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        tx.set((e.clientX - r.left) / r.width - 0.5);
        ty.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { tx.set(0); ty.set(0); }}
      initial={{ scale: 0.95, y: 14, opacity: 0.65 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit="exit"
      whileDrag={{ scale: 1.03, cursor: "grabbing" }}
      transition={spring.card}
      style={{ x, rotate, rotateX, rotateY, boxShadow: edgeGlow }}
      className="relative z-10 flex w-full cursor-grab touch-pan-y select-none flex-col overflow-hidden rounded-sm bg-surface transform-3d"
      aria-roledescription="Mission card"
      aria-label={mission.title}
    >
      <CardBody mission={mission} />


      {/* Stamps */}
      <motion.div
        style={{ opacity: acceptOpacity, scale: acceptScale }}
        className="pointer-events-none absolute left-6 top-1/2 z-30 -rotate-6 rounded-sm border border-ink bg-bg px-4 py-2 text-footnote font-medium uppercase tracking-[0.32em] text-ink"
      >
        {mission.is_event ? (mission.require_approval ? "Request" : "RSVP") : "Lock in"}
      </motion.div>
      <motion.div
        style={{ opacity: passOpacity, scale: passScale }}
        className="pointer-events-none absolute right-6 top-1/2 z-30 rotate-6 rounded-sm border border-ink-3 bg-bg px-4 py-2 text-footnote font-medium uppercase tracking-[0.32em] text-ink-3"
      >
        Pass
      </motion.div>
    </motion.article>
  );
});
