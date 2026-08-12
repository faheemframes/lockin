"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, useSpring, useMotionTemplate } from "framer-motion";
import { Flame, CalendarClock, MapPin, X, Check, Plus, AlertCircle, ChevronLeft, ChevronRight, Users, Clock, Sparkles } from "lucide-react";
import { User, Mission } from "../app/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { CometCard } from "./ui/comet-card";

// Feature flag: set to false to completely revert the 3D card tilt animation back to original card styling
const ENABLE_3D_COMET_TILT = true;

interface FeedProps {
  user: User;
  refreshUser: () => Promise<void>;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
  setTab?: (tab: string) => void;
}

export default function Feed({ user, refreshUser, locked, setLocked, api, setTab }: FeedProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [categories, setCategories] = useState<{ id: number; categoryName: string; emoji?: string; colorHex?: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const loadGenRef = useRef(0);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => scrollContainerRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  const scrollRight = () => scrollContainerRef.current?.scrollBy({ left: 200, behavior: "smooth" });

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: user.location || "SRM KTR Library",
    datetime: "",
    categoryId: "1",
    missionType: "group"
  });
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const actingRef = useRef(false);
  const [showCustomizeCover, setShowCustomizeCover] = useState(false);
  const [coverColor, setCoverColor] = useState("");
  const [coverImage, setCoverImage] = useState("");
  // Stable min so datetime-local doesn't jitter on parent re-renders
  const datetimeMinRef = useRef(
    new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)
  );

  function getPassedKey() {
    return `lockin_passed_${user.id}`;
  }

  function markDismissed(missionId: string | number) {
    const key = getPassedKey();
    const passed = JSON.parse(localStorage.getItem(key) || "[]");
    localStorage.setItem(
      key,
      JSON.stringify([...new Set([...passed, String(missionId)])])
    );
  }

  function clearDismissals(keepIds: Array<string | number> = []) {
    const kept = [...new Set(keepIds.map(String))];
    localStorage.setItem(getPassedKey(), JSON.stringify(kept));
  }

  /** When every card is swiped away, reshuffle the same feed so the stack never stays empty. */
  function recycleFeedItems(feedItems: Mission[], keepDismissed: Array<string | number> = []) {
    clearDismissals(keepDismissed);
    const keep = new Set(keepDismissed.map(String));
    return feedItems.filter((item) => !keep.has(String(item.id)));
  }

  const addTask = () => {
    if (newTaskTitle.trim()) {
      setTasks([...tasks, newTaskTitle.trim()]);
      setNewTaskTitle("");
    }
  };

  const removeTask = (idx: number) => setTasks(tasks.filter((_, i) => i !== idx));

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacityAccept = useTransform(x, [20, 100], [0, 1]);
  const opacityPass = useTransform(x, [-100, -20], [1, 0]);

  // 3D Tilt properties
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const mouseXSpring = useSpring(tiltX, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(tiltY, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["-12deg", "12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const translateX = useTransform(mouseXSpring, [-0.5, 0.5], ["-8px", "8px"]);
  const translateY = useTransform(mouseYSpring, [-0.5, 0.5], ["8px", "-8px"]);

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.25) 10%, rgba(255, 255, 255, 0.15) 20%, rgba(255, 255, 255, 0) 80%)`;

  const cardRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ENABLE_3D_COMET_TILT || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    tiltX.set(mouseX / width - 0.5);
    tiltY.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  async function load(catId: string = "all", opts?: { silent?: boolean }) {
    const gen = ++loadGenRef.current;
    if (!opts?.silent) setLoading(true);
    try {
      const [feed, lock] = await Promise.all([
        api(`/missions/feed?userId=${user.id}&categoryId=${catId}`),
        api(`/users/${user.id}/lock`)
      ]);
      // Ignore stale responses (Strict Mode double-fetch / category race)
      if (gen !== loadGenRef.current) return;
      setLocked(lock.locked);
      const feedItems: Mission[] = Array.isArray(feed) ? feed : [];
      const passed = JSON.parse(localStorage.getItem(getPassedKey()) || "[]");
      let next = feedItems.filter(
        (item: Mission) => !passed.includes(String(item.id))
      );
      // All cards dismissed — bring the full stack back
      if (next.length === 0 && feedItems.length > 0) {
        next = recycleFeedItems(feedItems);
      }
      setMissions((prev) => {
        // Keep the current front card if it still exists — avoids flash/swap
        const currentId = prev[0] ? String(prev[0].id) : null;
        if (currentId) {
          const stillIdx = next.findIndex((m: Mission) => String(m.id) === currentId);
          if (stillIdx > 0) {
            const kept = next.splice(stillIdx, 1)[0];
            next.unshift(kept);
          }
        }
        return next;
      });
      setIndex(0);
    } catch (err: any) {
      if (gen !== loadGenRef.current) return;
      setError(err.message || "Failed to load feed.");
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    load(activeCategory);
    return () => {
      // Invalidate in-flight loads on unmount / dep change (Strict Mode safe)
      loadGenRef.current += 1;
    };
  }, [user.id, activeCategory]);
  useEffect(() => {
    api("/missions/categories")
      .then((data) => setCategories(data))
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  const currentMission = missions[index];
  const isSideQuest = Boolean(currentMission?.is_side_quest);

  async function handleAction(action: "accept" | "pass") {
    if (!currentMission || actingRef.current) return;
    actingRef.current = true;
    setIsActing(true);
    setError("");

    const mission = currentMission;
    const remaining = missions.filter((m) => String(m.id) !== String(mission.id));
    x.set(0);

    if (remaining.length > 0) {
      // Pass stays dismissed until the whole stack is cleared
      if (action === "pass") {
        markDismissed(mission.id);
      }
      setMissions(remaining);
    } else {
      // Last card — clear dismissals and refill so the stack never stays empty.
      // Keep the accepted mission dismissed so it doesn't immediately reappear.
      clearDismissals(action === "accept" ? [mission.id] : []);
      await load(activeCategory, { silent: true });
    }

    try {
      if (action === "accept") {
        if (mission.is_side_quest) {
          if (!mission.template_id) throw new Error("Side Quest template missing.");
          setSubmitting(true);
          await api("/missions/from-template", {
            method: "POST",
            body: JSON.stringify({
              templateId: mission.template_id,
              creator_id: user.id,
              missionType: "solo"
            })
          });
        } else {
          await api(`/missions/${mission.id}/accept`, {
            method: "POST",
            body: JSON.stringify({ userId: user.id })
          });
        }
        markDismissed(mission.id);
        await refreshUser();
        setTab?.("active");
      } else if (!mission.is_side_quest) {
        await api(`/missions/${mission.id}/pass`, { method: "POST" });
      }
    } catch (err: any) {
      if (err.message && err.message.includes("limit")) setLocked(true);
      setError(err.message || "Operation failed.");
    } finally {
      actingRef.current = false;
      setIsActing(false);
      setSubmitting(false);
    }
  }

  async function handleLockInSolo() {
    if (!currentMission?.is_side_quest || !currentMission.template_id) return;
    await handleAction("accept");
  }

  function handleMakeGroupFromTemplate() {
    if (!currentMission?.is_side_quest) return;
    const templateTasks = currentMission.default_tasks || [];
    setForm({
      title: currentMission.title,
      description: currentMission.description,
      location: user.location || "SRM KTR Library",
      datetime: "",
      categoryId: currentMission.category_id ? String(currentMission.category_id) : "1",
      missionType: "group"
    });
    setTasks([...templateTasks]);
    setCoverColor(currentMission.cover_color || "");
    setCoverImage(currentMission.cover_image || "");
    setShowCreate(true);
  }

  async function handleCreateMission(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const isSolo = form.missionType === "solo";
      const payload = {
        ...form,
        creator_id: user.id,
        categoryId: Number(form.categoryId),
        location: isSolo ? "Solo" : form.location,
        datetime: isSolo ? new Date().toISOString() : form.datetime,
        coverColor: coverColor || null,
        coverImage: coverImage || null
      };
      const newMission = await api("/missions", { method: "POST", body: JSON.stringify(payload) });
      if (tasks.length > 0 && newMission?.id) {
        await api("/tasks/batch", {
          method: "POST",
          body: JSON.stringify({ missionId: newMission.id, tasks: tasks.map((t, idx) => ({ title: t, position: idx })) })
        });
      }
      setShowCreate(false);
      setTab?.("active");
      setForm({
        title: "", description: "", location: user.location || "SRM KTR Library",
        datetime: "", categoryId: categories[0]?.id ? String(categories[0].id) : "1", missionType: "group"
      });
      setTasks([]);
      setCoverColor("");
      setCoverImage("");
      setShowCustomizeCover(false);
      await load(activeCategory, { silent: true });
    } catch (err: any) {
      setError(err.message || "Could not launch mission.");
    } finally {
      setSubmitting(false);
    }
  }

  const initials = (name = "?") =>
    name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en", {
      weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric"
    }).format(new Date(value));

  return (
    <section className="mx-auto flex w-full max-w-md md:max-w-xl flex-1 flex-col px-4 pt-4 pb-24 md:pb-6">
      {/* Title bar */}
      <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-cherryRed/80">
            Discovery
          </span>
          <h2 className="text-[22px] font-bold text-white tracking-tight mt-0.5 leading-tight">Active Runways</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Categories */}
      <div className="relative mb-5 group">
        <button
          type="button"
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-[#0D0B0A]/95 text-zinc-400 hover:text-white transition shadow-lg opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0 -mx-4 px-4 scroll-smooth"
        >
          <button
            onClick={() => { setActiveCategory("all"); setError(""); }}
            className={`cat-pill h-8 rounded-full border px-4 text-[10px] font-semibold transition shrink-0 ${
              activeCategory === "all"
                ? "border-cherryRed/60 bg-cherryRed/90 text-white shadow-[0_0_14px_rgba(129,1,0,.3)]"
                : "border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]"
            }`}
          >
            All
          </button>
          {categories.map((c) => {
            const selected = activeCategory === String(c.id);
            return (
              <button
                key={c.id}
                onClick={() => { setActiveCategory(String(c.id)); setError(""); }}
                className="cat-pill flex items-center gap-1.5 h-8 rounded-full border px-4 text-[10px] font-semibold transition shrink-0"
                style={{
                  borderColor: selected ? `${c.colorHex}60` : "rgba(255,255,255,.06)",
                  backgroundColor: selected ? `${c.colorHex}18` : "rgba(255,255,255,.025)",
                  color: selected ? c.colorHex || "#fff" : "rgba(255,255,255,.4)",
                  boxShadow: selected ? `0 0 14px ${c.colorHex}28` : "none"
                }}
              >
                {c.categoryName}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-[#0D0B0A]/95 text-zinc-400 hover:text-white transition shadow-lg opacity-0 group-hover:opacity-100"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Locked warning */}
      {locked && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-cherryRed/25 bg-cherryRed/[0.06] p-4">
          <AlertCircle className="h-4 w-4 text-cherryRed shrink-0 mt-0.5 animate-pulse" />
          <div className="text-left">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-white">Runway Full</h4>
            <p className="text-[10px] font-medium text-zinc-500 leading-relaxed mt-0.5">
              3 active missions running. Mark attendance or clear to unlock.
            </p>
          </div>
        </div>
      )}

      {/* Card stack */}
      <div className="relative flex flex-1 items-center justify-center min-h-[460px] perspective-distant">
        {/* Stack ghost cards */}
        <div className="absolute inset-x-6 top-6 h-[420px] rounded-[28px] border border-white/[0.04] bg-white/[0.015] scale-[0.93] translate-y-4 -z-20" />
        <div className="absolute inset-x-3 top-3 h-[420px] rounded-[28px] border border-white/[0.055] bg-white/[0.025] scale-[0.97] translate-y-2 -z-10" />
 
        <AnimatePresence mode="wait">
          {loading && !currentMission ? (
            <motion.div
              key="feed-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-[430px] w-full flex-col items-center justify-center rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-8 text-center backdrop-blur-md"
            >
              <div className="h-8 w-8 rounded-full border-2 border-cherryRed/25 border-t-cherryRed animate-spin mb-4" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Loading runways...
              </p>
            </motion.div>
          ) : currentMission ? (
            <motion.article
              key={currentMission.id}
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              drag={isActing ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.55}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (actingRef.current) return;
                if (info.offset.x > 120) {
                  if (locked) {
                    setError("Runway limit reached. Complete active queue first.");
                    x.set(0);
                  } else {
                    handleAction("accept");
                  }
                } else if (info.offset.x < -120) {
                  handleAction("pass");
                }
              }}
              initial={{ opacity: 0, scale: 0.93, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: -24 }}
              whileDrag={{ scale: 1.015, cursor: "grabbing" }}
              whileHover={ENABLE_3D_COMET_TILT ? { scale: 1.025, z: 20 } : undefined}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="mission-card-inner relative flex h-[430px] w-full touch-none flex-col justify-between overflow-hidden rounded-[28px] border bg-[#161210]/80 p-0 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl transform-3d"
              style={{
                x,
                rotate,
                rotateX: ENABLE_3D_COMET_TILT ? rotateX : 0,
                rotateY: ENABLE_3D_COMET_TILT ? rotateY : 0,
                translateX: ENABLE_3D_COMET_TILT ? translateX : 0,
                translateY: ENABLE_3D_COMET_TILT ? translateY : 0,
                transformStyle: ENABLE_3D_COMET_TILT ? "preserve-3d" : undefined,
                borderColor: currentMission.cover_color ? `${currentMission.cover_color}55` : "rgba(255,255,255,0.08)",
                boxShadow: currentMission.cover_color ? `0 24px 70px rgba(0,0,0,0.65), 0 0 20px ${currentMission.cover_color}18` : undefined
              }}
            >
              {(() => {
                const innerJSX = (
                  <>
                    {/* Optional Mission Cover Background */}
                    {currentMission.cover_image && (
                      <div 
                        className="absolute inset-0 z-0 opacity-[0.18] pointer-events-none rounded-[28px]"
                        style={{ 
                          background: currentMission.cover_image.includes("gradient") 
                            ? currentMission.cover_image 
                            : `url(${currentMission.cover_image}) center/cover no-repeat`
                        }}
                      />
                    )}
                    {/* Swipe overlay — accept */}
                    <motion.div
                      style={{ opacity: opacityAccept }}
                      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-gradient-to-br from-cherryRed/[0.12] to-transparent backdrop-blur-[2px]"
                    >
                      <div className="rounded-2xl border border-cherryRed/40 bg-black/90 px-5 py-2.5 text-[11px] font-black tracking-[0.2em] text-white uppercase shadow-[0_0_30px_rgba(210,4,45,.35)] flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-cherryRed stroke-[3]" /> {isSideQuest ? "Lock In Solo" : "Lock In"}
                      </div>
                    </motion.div>

                    {/* Swipe overlay — pass */}
                    <motion.div
                      style={{ opacity: opacityPass }}
                      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-gradient-to-br from-white/[0.08] to-transparent backdrop-blur-[2px]"
                    >
                      <div className="rounded-2xl border border-white/20 bg-black/90 px-5 py-2.5 text-[11px] font-black tracking-[0.2em] text-white uppercase shadow-[0_0_30px_rgba(255,255,255,.1)] flex items-center gap-1.5">
                        <X className="h-4 w-4 text-white stroke-[3]" /> Pass
                      </div>
                    </motion.div>

                    {/* Inner top highlight */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

                    <div className="space-y-5 z-10">
                      {/* Creator row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] border text-[12px] font-black ${
                            isSideQuest
                              ? "border-cherryRed/25 bg-cherryRed/[0.1] text-cherryRed"
                              : "border-white/[0.07] bg-white/[0.04] text-cotton/90"
                          }`}>
                            {isSideQuest ? <Sparkles className="h-4 w-4" /> : initials(currentMission.creator_name)}
                          </div>
                          <div className="text-left">
                            {isSideQuest ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full border border-cherryRed/35 bg-cherryRed/[0.12] px-2 py-0.5 text-[8px] font-black tracking-[0.16em] text-cherryRed uppercase">
                                    Side Quest
                                  </span>
                                </div>
                                <p className="text-[10px] font-medium text-zinc-500 mt-1 uppercase tracking-wide">
                                  Curated by LOCKIN
                                </p>
                              </>
                            ) : (
                              <>
                                <h3 className="text-[13px] font-semibold text-cotton/95 leading-tight">
                                  {currentMission.creator_name}
                                </h3>
                                <p className="text-[10px] font-medium text-zinc-500 mt-0.5 uppercase tracking-wide">
                                  {currentMission.creator_department || "Department"}
                                </p>
                                {currentMission.locked_in_count !== undefined && currentMission.locked_in_count > 2 && (
                                  <div className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase text-zinc-500">
                                    <Users className="h-3 w-3 text-luxuryGold" />
                                    <span>{currentMission.locked_in_count} people locked in</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.14em] uppercase"
                          style={{
                            borderColor: currentMission.category_color ? `${currentMission.category_color}45` : "rgba(129,1,0,.3)",
                            backgroundColor: currentMission.category_color ? `${currentMission.category_color}12` : "rgba(129,1,0,.08)",
                            color: currentMission.category_color || "#ffa3a3"
                          }}
                        >
                          {currentMission.category_name || "Mission"}
                        </span>
                      </div>

                      <div className="space-y-2 text-left">
                        <h3 className="text-[18px] font-black text-cotton leading-snug tracking-tight">
                          {currentMission.title}
                        </h3>
                        <p className="text-[12px] font-normal leading-relaxed text-zinc-400 line-clamp-5">
                          {currentMission.description}
                        </p>
                        {isSideQuest && (currentMission.default_tasks?.length ?? 0) > 0 && (
                          <p className="text-[10px] font-medium text-zinc-500">
                            {currentMission.default_tasks!.length} checklist items ready
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Meta block */}
                    <div className="space-y-2 z-10">
                      {isSideQuest ? (
                        <>
                          <div className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.06] bg-black/30 p-3">
                            <Clock className="h-4 w-4 text-white shrink-0 opacity-80" />
                            <span className="text-[12px] font-medium text-cotton/85">
                              ~{currentMission.estimated_duration || currentMission.focus_duration || 25} min
                              {currentMission.difficulty ? ` · ${currentMission.difficulty}` : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeGroupFromTemplate();
                            }}
                            className="w-full text-left rounded-[14px] border border-white/[0.06] bg-black/30 p-3 hover:bg-white/[0.04] transition"
                          >
                            <span className="text-[11px] font-semibold text-cotton/85">Want company?</span>
                            <span className="block text-[10px] text-zinc-500 mt-0.5">Make it a Group Mission →</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.06] bg-black/30 p-3">
                            <CalendarClock className="h-4 w-4 text-white shrink-0 opacity-80" />
                            <span className="text-[12px] font-medium text-cotton/85">
                              {currentMission.datetime ? formatDate(currentMission.datetime) : "Flexible"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.06] bg-black/30 p-3">
                            <MapPin className="h-4 w-4 text-cherryRed shrink-0 opacity-80" />
                            <span className="text-[12px] font-medium text-cotton/85 truncate">
                              {currentMission.location}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );

                return (
                  <div className="relative w-full h-full flex flex-col justify-between p-6">
                    {innerJSX}
                    {ENABLE_3D_COMET_TILT && (
                      <motion.div
                        className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-[28px] mix-blend-overlay"
                        style={{
                          background: glareBackground,
                          opacity: 0.4,
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </motion.article>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-[430px] w-full flex-col items-center justify-center rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-8 text-center backdrop-blur-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cherryRed/20 bg-cherryRed/[0.06] shadow-[0_0_24px_rgba(129,1,0,.12)] mb-5">
                <Flame className="h-6 w-6 text-cherryRed animate-pulse" />
              </div>
              <h3 className="text-[14px] font-black text-cotton uppercase tracking-wider">Feed Cleared</h3>
              <p className="mt-2 text-[12px] font-normal text-zinc-500 leading-relaxed max-w-[220px]">
                No runways nearby. Refresh for Side Quests or launch one yourself.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe hints */}
      {currentMission && (
        <div className="flex justify-between items-center w-full px-1 mt-4">
          <span className="swipe-hint">← Pass</span>
          <div className="flex gap-1">
            {missions.slice(index, index + 4).map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all ${i === 0 ? "w-5 bg-cherryRed/60" : "w-1.5 bg-white/10"}`} />
            ))}
          </div>
          <span className="swipe-hint text-cherryRed/70">{isSideQuest ? "Lock In Solo →" : "Lock In →"}</span>
        </div>
      )}

      {error && (
        <p className="mt-3 text-center text-[11px] font-bold text-cherryRed">
          {error}
        </p>
      )}

      {/* Action buttons */}
      {currentMission && (
        <div className={`mt-5 grid gap-3 shrink-0 ${isSideQuest ? "grid-cols-1" : "grid-cols-2"}`}>
          {isSideQuest ? (
            <>
              <button
                onClick={() => !locked && !isActing && handleLockInSolo()}
                disabled={locked || isActing || submitting}
                className={`flex h-11 items-center justify-center gap-2 rounded-[14px] border text-[12px] font-black uppercase tracking-wider transition active:scale-[0.97] ${
                  locked || isActing || submitting
                    ? "border-white/[0.04] bg-white/[0.02] text-zinc-700 cursor-not-allowed"
                    : "border-cherryRed/40 bg-cherryRed text-cotton shadow-[0_0_24px_rgba(129,1,0,0.3)] hover:bg-cherryRed/90"
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.5]" /> {submitting || isActing ? "Locking In..." : "Lock In Solo"}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => !isActing && handleAction("pass")}
                  disabled={isActing}
                  className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-white/[0.07] bg-white/[0.03] text-[12px] font-bold uppercase tracking-wider text-zinc-400 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" /> Pass
                </button>
                <button
                  onClick={handleMakeGroupFromTemplate}
                  className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-white/[0.1] bg-white/[0.04] text-[11px] font-bold uppercase tracking-wider text-cotton/80 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.97]"
                >
                  <Users className="h-4 w-4" /> Group
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => !isActing && handleAction("pass")}
                disabled={isActing}
                className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-white/[0.07] bg-white/[0.03] text-[12px] font-bold uppercase tracking-wider text-zinc-400 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" /> Pass
              </button>
              <button
                onClick={() => !locked && !isActing && handleAction("accept")}
                disabled={locked || isActing}
                className={`flex h-11 items-center justify-center gap-2 rounded-[14px] border text-[12px] font-black uppercase tracking-wider transition active:scale-[0.97] ${
                  locked || isActing
                    ? "border-white/[0.04] bg-white/[0.02] text-zinc-700 cursor-not-allowed"
                    : "border-cherryRed/40 bg-cherryRed text-cotton shadow-[0_0_24px_rgba(129,1,0,0.3)] hover:bg-cherryRed/90"
                }`}
              >
                <Check className="h-4 w-4 stroke-[2.5]" /> {isActing ? "Locking In..." : "Lock In"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Create Mission Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-white/[0.08] bg-[#0F0D0C]/98 text-white max-w-sm rounded-3xl backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.85)]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-black tracking-tight text-white uppercase">
              Launch Mission
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMission} className="space-y-4 mt-1">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Runway Type</label>
              <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-[14px] border border-white/[0.06]">
                {["group", "solo"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, missionType: t })}
                    className={`h-9 rounded-[11px] text-[10px] font-black uppercase tracking-wider transition ${
                      form.missionType === t
                        ? "bg-cherryRed text-cotton shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t === "group" ? "Group" : "Solo"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Mission Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. LeetCode Lock-In"
                className="h-10 border-white/[0.08] bg-black/40 text-[12px] text-white placeholder:text-zinc-700"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What exactly needs to get executed?"
                className="min-h-[72px] border-white/[0.08] bg-black/40 text-[12px] text-white placeholder:text-zinc-700 resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/40 px-2.5 text-[12px] text-white outline-none focus:border-luxuryGold/40 cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-zinc-950 text-white">
                      {c.emoji ? `${c.emoji} ` : ""}{c.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              {form.missionType === "group" && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Location</label>
                  <select
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/40 px-2.5 text-[12px] text-white outline-none focus:border-luxuryGold/40 cursor-pointer"
                  >
                    {["SRM KTR Library","SRM KTR Tech Park","SRM KTR Java Canteen","SRM KTR Bio-Tech Block","SRM KTR Cafe Court","SRM KTR UB Block"].map((spot) => (
                      <option key={spot} value={spot} className="bg-zinc-950 text-white">{spot}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {form.missionType === "group" && (
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Schedule (Future Only)</label>
                <Input
                  type="datetime-local"
                  value={form.datetime}
                  min={datetimeMinRef.current}
                  onChange={(e) => setForm((prev) => ({ ...prev, datetime: e.target.value }))}
                  className="h-10 border-white/[0.08] bg-black/40 text-[12px] text-white"
                  required
                />
              </div>
            )}

            <div className="space-y-2 border-t border-white/[0.05] pt-3">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Checklist (Optional)</label>
              <div className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a task..."
                  className="h-9 border-white/[0.08] bg-black/40 text-[12px] text-white placeholder:text-zinc-700"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
                />
                <button
                  type="button"
                  onClick={addTask}
                  className="h-9 px-3.5 rounded-lg border border-white/[0.07] bg-white/[0.04] text-[11px] text-cotton font-bold hover:bg-white/[0.08] transition"
                >
                  Add
                </button>
              </div>
              {tasks.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1 bg-black/25 p-2 rounded-xl border border-white/[0.05]">
                  {tasks.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-2 bg-white/[0.03] px-2.5 py-1.5 rounded-lg">
                      <span className="text-[11px] text-cotton/80 truncate">{t}</span>
                      <button type="button" onClick={() => removeTask(idx)} className="text-[10px] text-cherryRed font-bold hover:text-red-400 shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Custom Cover & Theme (Optional) */}
            <div className="space-y-2 border-t border-white/[0.05] pt-3">
              <button
                type="button"
                onClick={() => setShowCustomizeCover(!showCustomizeCover)}
                className="flex items-center justify-between w-full text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-cotton transition"
              >
                <span>Customize Cover & Theme (Optional)</span>
                <span className="text-[12px]">{showCustomizeCover ? "−" : "+"}</span>
              </button>

              {showCustomizeCover && (
                <div className="space-y-3 bg-black/25 p-3 rounded-xl border border-white/[0.05] text-left">
                  {/* Theme Colors */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">Accent Color</label>
                    <div className="flex gap-2">
                      {[
                        { name: "Crimson", value: "#B11226" },
                        { name: "Emerald", value: "#10B981" },
                        { name: "Gold", value: "#F59E0B" },
                        { name: "Indigo", value: "#6366F1" },
                        { name: "Violet", value: "#8B5CF6" },
                      ].map((color) => (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setCoverColor(color.value)}
                          className={`h-5 w-5 rounded-full border transition ${
                            coverColor === color.value ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                      {coverColor && (
                        <button
                          type="button"
                          onClick={() => setCoverColor("")}
                          className="text-[8px] font-bold uppercase text-zinc-500 hover:text-white"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preset Covers */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">Preset Patterns</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { name: "Cosmic", value: "linear-gradient(135deg, #1b0f1c 0%, #0e0d10 100%)" },
                        { name: "Aqua", value: "linear-gradient(135deg, #0f1c1e 0%, #0d0f11 100%)" },
                        { name: "Amber Glow", value: "linear-gradient(135deg, #1f120c 0%, #110d0c 100%)" },
                        { name: "Midnight", value: "linear-gradient(135deg, #121212 0%, #080808 100%)" },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setCoverImage(preset.value)}
                          className={`h-8 rounded-lg border text-[9px] font-bold uppercase tracking-wider text-cotton/85 transition ${
                            coverImage === preset.value ? "border-white" : "border-white/10"
                          }`}
                          style={{ background: preset.value }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Image Upload */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">Custom Cover Image</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="cover-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setCoverImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="cover-upload"
                        className="flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] font-bold uppercase tracking-wider text-cotton hover:bg-white/10 transition cursor-pointer"
                      >
                        Upload Image
                      </label>
                      {coverImage && !coverImage.includes("gradient") && (
                        <span className="text-[8px] text-emerald-500 font-bold truncate max-w-[120px]">Image Loaded</span>
                      )}
                      {coverImage && (
                        <button
                          type="button"
                          onClick={() => setCoverImage("")}
                          className="text-[8px] font-bold uppercase text-zinc-500 hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-cherryRed/25 bg-cherryRed text-[12px] font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(210,4,45,0.22)] hover:bg-cherryRed/90 transition active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              {submitting ? "Launching..." : "Launch Runway"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
