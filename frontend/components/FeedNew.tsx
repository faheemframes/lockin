"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Flame, CalendarClock, MapPin, X, Check, Plus, AlertCircle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { User, Mission } from "../app/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface FeedProps {
  user: User;
  refreshUser: () => Promise<void>;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
  setTab?: (tab: string) => void;
}

export default function FeedNew({ user, refreshUser, locked, setLocked, api, setTab }: FeedProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [categories, setCategories] = useState<{ id: number; categoryName: string; emoji?: string; colorHex?: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

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
  const datetimeMinRef = useRef(
    new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)
  );

  const addTask = () => {
    if (newTaskTitle.trim()) {
      setTasks([...tasks, newTaskTitle.trim()]);
      setNewTaskTitle("");
    }
  };

  const removeTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacityAccept = useTransform(x, [0, 100], [0, 1]);
  const opacityPass = useTransform(x, [-100, 0], [1, 0]);

  async function load(catId: string = "all") {
    try {
      const [feed, lock] = await Promise.all([
        api(`/missions/feed?userId=${user.id}&categoryId=${catId}`),
        api(`/users/${user.id}/lock`)
      ]);
      setLocked(lock.locked);
      const passed = JSON.parse(localStorage.getItem(`lockin_passed_${user.id}`) || "[]");
      setMissions(feed.filter((item: Mission) => !passed.includes(item.id)));
      setIndex(0);
    } catch (err: any) {
      setError(err.message || "Failed to load feed.");
    }
  }

  useEffect(() => {
    load(activeCategory);
  }, [user.id, activeCategory]);

  useEffect(() => {
    api("/missions/categories")
      .then((data) => setCategories(data))
      .catch((err) => console.error("Error loading categories:", err));
  }, []);

  const currentMission = missions[index];

  async function handleAction(action: "accept" | "pass") {
    if (!currentMission) return;
    setError("");
    try {
      if (action === "accept") {
        await api(`/missions/${currentMission.id}/accept`, {
          method: "POST",
          body: JSON.stringify({ userId: user.id })
        });
        await refreshUser();
        setTab?.("active");
      } else {
        await api(`/missions/${currentMission.id}/pass`, { method: "POST" });
        const key = `lockin_passed_${user.id}`;
        const passed = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([...new Set([...passed, currentMission.id])]));
      }
      setIndex((curr) => curr + 1);
      x.set(0);
    } catch (err: any) {
      if (err.message && err.message.includes("limit")) {
        setLocked(true);
      }
      setError(err.message || "Operation failed.");
      x.set(0);
    }
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
        datetime: isSolo ? new Date().toISOString() : form.datetime
      };

      const newMission = await api("/missions", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (tasks.length > 0 && newMission?.id) {
        await api("/tasks/batch", {
          method: "POST",
          body: JSON.stringify({
            missionId: newMission.id,
            tasks: tasks.map((t, idx) => ({ title: t, position: idx }))
          })
        });
      }

      setShowCreate(false);
      setTab?.("active");
      setForm({
        title: "",
        description: "",
        location: user.location || "SRM KTR Library",
        datetime: "",
        categoryId: categories[0]?.id ? String(categories[0].id) : "1",
        missionType: "group"
      });
      setTasks([]);
      await load(activeCategory);
    } catch (err: any) {
      setError(err.message || "Could not launch mission.");
    } finally {
      setSubmitting(false);
    }
  }

  const initials = (name = "?") => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formatDate = (value: string | null) => {
    if (!value) return "Flexible";
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  };

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    setError("");
  };

  return (
    <section className="mx-auto flex w-full max-w-md md:max-w-xl flex-1 flex-col px-4 pt-4 pb-24 md:pb-6 select-none">
      {/* Title bar */}
      <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-cherryRed animate-pulse" /> V3 beta discovery
          </span>
          <h2 className="text-xl md:text-3xl font-black text-white tracking-tight mt-1">Active Runways</h2>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cherryRed/30 bg-cherryRed/5 text-cherryRed hover:bg-cherryRed/20 hover:scale-[1.03] transition-all shadow-[0_0_15px_rgba(210,4,45,0.1)] active:scale-[0.97]"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Categories Bar */}
      <div className="relative mb-5 group">
        <button
          type="button"
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-950/95 text-zinc-400 hover:text-white hover:bg-zinc-900 transition opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-none shrink-0 -mx-4 px-4 scroll-smooth"
        >
          <button
            onClick={() => handleCategoryChange("all")}
            className={`h-9 rounded-full border px-4.5 text-[10px] md:text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              activeCategory === "all"
                ? "border-cherryRed bg-cherryRed/10 text-cherryRed shadow-[0_0_15px_rgba(210,4,45,0.15)]"
                : "border-white/5 bg-zinc-900/60 text-zinc-500 hover:text-white hover:bg-zinc-800/40"
            }`}
          >
            All Runways
          </button>
          {categories.map((c) => {
            const selected = activeCategory === String(c.id);
            return (
              <button
                key={c.id}
                onClick={() => handleCategoryChange(String(c.id))}
                className="flex items-center gap-1.5 h-9 rounded-full border px-4.5 text-[10px] md:text-xs font-black uppercase tracking-wider transition-all shrink-0"
                style={{
                  borderColor: selected ? (c.colorHex || "#DE211E") : "rgba(255,255,255,0.05)",
                  backgroundColor: selected ? `${c.colorHex || "#DE211E"}18` : "rgba(24,24,27,0.6)",
                  color: selected ? (c.colorHex || "#DE211E") : "rgba(255,255,255,0.45)",
                  boxShadow: selected ? `0 0 15px ${c.colorHex || "#DE211E"}20` : undefined
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
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-950/95 text-zinc-400 hover:text-white hover:bg-zinc-900 transition opacity-0 group-hover:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Soft Limit Warning Banner */}
      {locked && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-3 rounded-2xl border border-cherryRed/30 bg-cherryRed/5 p-4 shadow-[0_4px_15px_rgba(222,33,30,0.1)]"
        >
          <AlertCircle className="h-5 w-5 text-cherryRed shrink-0 mt-0.5 animate-pulse" />
          <div className="text-left">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Runway Locked
            </h4>
            <p className="text-[11px] font-semibold text-zinc-400 leading-normal mt-1">
              You already have 3 active runs in queue. Please finish your pending work to unlock.
            </p>
          </div>
        </motion.div>
      )}

      {/* Card stack container */}
      <div className="relative flex flex-1 items-center justify-center min-h-[440px] md:min-h-[500px]">
        {/* Background stack sheets */}
        <div className="absolute inset-x-5 top-5 h-[420px] md:h-[480px] rounded-[32px] border border-white/5 bg-[#1B1716]/20 scale-[0.93] translate-y-3 opacity-30 -z-20" />
        <div className="absolute inset-x-2.5 top-2.5 h-[420px] md:h-[480px] rounded-[32px] border border-white/5 bg-[#1B1716]/40 scale-[0.97] translate-y-1.5 opacity-55 -z-10" />

        {/* Halo Glow effect */}
        {currentMission && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(210,4,45,0.06),transparent_65%)] blur-[40px] pointer-events-none -z-30" />
        )}

        <AnimatePresence mode="wait">
          {currentMission ? (
            <motion.article
              key={currentMission.id}
              style={{ x, rotate }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.65}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.x > 120) {
                  if (locked) {
                    setError("Complete your active runs to unlock accepting new missions.");
                    x.set(0);
                  } else {
                    handleAction("accept");
                  }
                } else if (info.offset.x < -120) {
                  handleAction("pass");
                }
              }}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: -20 }}
              whileDrag={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="relative flex h-[420px] md:h-[480px] w-full touch-none flex-col justify-between overflow-hidden rounded-[32px] border border-white/10 bg-[#161211]/90 p-7 md:p-9 shadow-2xl backdrop-blur-xl"
            >
              {/* Swipe Overlays */}
              <motion.div
                style={{ opacity: opacityAccept }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-cherryRed/10 backdrop-blur-[2px]"
              >
                <div className="rounded-2xl border-2 border-cherryRed/40 bg-black/95 px-5 py-2.5 text-xs md:text-sm font-black tracking-[0.2em] text-white uppercase shadow-[0_0_30px_rgba(210,4,45,0.35)] flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-cherryRed stroke-[3]" /> Lock In
                </div>
              </motion.div>

              <motion.div
                style={{ opacity: opacityPass }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/5 backdrop-blur-[2px]"
              >
                <div className="rounded-2xl border-2 border-white/20 bg-black/95 px-5 py-2.5 text-xs md:text-sm font-black tracking-[0.2em] text-white uppercase shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center gap-1.5">
                  <X className="h-4 w-4 text-white stroke-[3]" /> Pass
                </div>
              </motion.div>

              <div className="space-y-4 md:space-y-6">
                {/* Creator info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900 text-xs font-black text-cotton shadow-inner">
                      {initials(currentMission.creator_name)}
                    </div>
                    <div className="text-left">
                      <h3 className="text-xs md:text-sm font-black text-white leading-tight">
                        {currentMission.creator_name}
                      </h3>
                      <p className="text-[9px] md:text-xs font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                        {currentMission.creator_department || "Department"}
                      </p>
                    </div>
                  </div>
                   <span
                    className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[8px] md:text-[10px] font-black tracking-widest uppercase shadow-sm"
                    style={{
                      borderColor: currentMission.category_color ? `${currentMission.category_color}45` : "rgba(255,255,255,0.05)",
                      backgroundColor: currentMission.category_color ? `${currentMission.category_color}12` : "rgba(255,255,255,0.02)",
                      color: currentMission.category_color || "#ffa3a3"
                    }}
                  >
                    {currentMission.category_name || "Other"}
                  </span>
                </div>

                <div className="space-y-2 md:space-y-3 text-left">
                  <h3 className="text-lg md:text-xl lg:text-2xl font-black text-white leading-snug tracking-tight">
                    {currentMission.title}
                  </h3>
                  <p className="text-xs md:text-sm font-medium leading-relaxed text-zinc-400 line-clamp-6">
                    {currentMission.description}
                  </p>
                </div>
              </div>

              {/* Timing & Location block */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-950/60 p-3 shadow-inner">
                  <CalendarClock className="h-4.5 w-4.5 text-white shrink-0" />
                  <span className="text-xs md:text-sm font-bold text-white/95">
                    {formatDate(currentMission.datetime)}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-950/60 p-3 shadow-inner">
                  <MapPin className="h-4.5 w-4.5 text-cherryRed shrink-0" />
                  <span className="text-xs md:text-sm font-bold text-white/95 truncate">
                    {currentMission.location}
                  </span>
                </div>
              </div>
            </motion.article>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-[420px] md:h-[480px] w-full flex-col items-center justify-center rounded-[32px] border border-white/5 bg-zinc-950/20 p-6 md:p-8 text-center backdrop-blur-md"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cherryRed/20 bg-cherryRed/5 shadow-[0_0_25px_rgba(129,1,0,0.1)] mb-4">
                <Flame className="h-7 w-7 text-cherryRed animate-pulse" />
              </div>
              <h3 className="text-sm font-black text-cotton uppercase tracking-widest">Runway Clear</h3>
              <p className="mt-2 text-xs md:text-sm font-semibold text-zinc-600 leading-relaxed max-w-[240px] mx-auto">
                All coordinates cleared. Swap category filter or launch your own.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe guides */}
      {currentMission && (
        <div className="flex justify-between items-center w-full px-2 mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 select-none pointer-events-none">
          <div className="flex items-center gap-1 opacity-70">
            <span>← Swipe Left to Pass</span>
          </div>
          <div className="flex items-center gap-1 text-cherryRed/85">
            <span>Swipe Right to Lock In →</span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-xs md:text-sm font-black text-cherryRed animate-pulse uppercase tracking-wider">
          {error}
        </p>
      )}

      {/* Swipe buttons */}
      {currentMission && (
        <div className="mt-5 grid grid-cols-2 gap-3 shrink-0">
          <button
            onClick={() => handleAction("pass")}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-white/5 bg-white/5 text-xs font-black uppercase tracking-wider text-zinc-400 transition hover:text-white hover:bg-white/10 active:scale-[0.98]"
          >
            <X className="h-4.5 w-4.5" /> Pass Runway
          </button>
          <button
            onClick={() => !locked && handleAction("accept")}
            disabled={locked}
            className={`flex h-12 items-center justify-center gap-1.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition active:scale-[0.98] ${
              locked
                ? "border-white/5 bg-zinc-950/45 text-zinc-700 cursor-not-allowed"
                : "border-cherryRed/50 bg-cherryRed text-white shadow-[0_0_20px_rgba(210,4,45,0.2)] hover:bg-cherryRed/95"
            }`}
          >
            <Check className="h-4.5 w-4.5 stroke-[3]" /> Lock In
          </button>
        </div>
      )}

      {/* Launch Mission Dialog Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-white/10 bg-zinc-950/95 text-white max-w-sm rounded-[32px] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cherryRed" />
              LAUNCH RUNWAY
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMission} className="space-y-4 mt-2">
            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                Runway Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-black/45 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, missionType: "group" })}
                  className={`h-8.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${
                    form.missionType === "group"
                      ? "bg-cherryRed text-cotton shadow-sm"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Group Runway
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, missionType: "solo" })}
                  className={`h-8.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${
                    form.missionType === "solo"
                      ? "bg-cherryRed text-cotton shadow-sm"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Solo Session
                </button>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                Mission Title
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. LeetCode Grind"
                className="h-10.5 border-white/10 bg-black/40 text-xs text-white"
                required
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                Detailed Description
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What exactly needs to get executed?"
                className="min-h-20 border-white/10 bg-black/40 text-xs text-white resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Category
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="h-10.5 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none focus:border-cherryRed/40 cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-zinc-950 text-white">
                      {c.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              {form.missionType === "group" && (
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    Meet Location
                  </label>
                  <select
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="h-10.5 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none focus:border-cherryRed/40 cursor-pointer"
                  >
                    {[
                      "SRM KTR Library",
                      "SRM KTR Tech Park",
                      "SRM KTR Java Canteen",
                      "SRM KTR Bio-Tech Block",
                      "SRM KTR Cafe Court",
                      "SRM KTR UB Block"
                    ].map((spot) => (
                      <option key={spot} value={spot} className="bg-zinc-950 text-white">
                        {spot}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {form.missionType === "group" && (
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Schedule (Future Date)
                </label>
                <Input
                  type="datetime-local"
                  value={form.datetime}
                  min={datetimeMinRef.current}
                  onChange={(e) => setForm((prev) => ({ ...prev, datetime: e.target.value }))}
                  className="h-10.5 border-white/10 bg-black/40 text-xs text-white"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5 text-left border-t border-white/5 pt-3">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                Runway Checklist (Optional)
              </label>
              <div className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add item..."
                  className="h-9 border-white/10 bg-black/40 text-xs text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addTask}
                  className="h-9 px-3 rounded-lg border border-cherryRed/30 bg-cherryRed/5 text-xs text-cherryRed font-black uppercase hover:bg-cherryRed/15 transition"
                >
                  Add
                </button>
              </div>
              {tasks.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1.5 bg-black/30 p-2 rounded-xl border border-white/5 scrollbar-thin">
                  {tasks.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-2 bg-zinc-900/60 px-2.5 py-1 rounded-lg">
                      <span className="text-[11px] text-white/90 truncate font-semibold">{t}</span>
                      <button
                        type="button"
                        onClick={() => removeTask(idx)}
                        className="text-[9px] text-cherryRed font-black uppercase hover:text-red-400 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-cherryRed/30 bg-cherryRed text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(210,4,45,0.25)] hover:bg-cherryRed/95 transition active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              {submitting ? "Launching..." : "Launch Runway"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
