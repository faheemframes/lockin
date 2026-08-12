"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Trophy,
  MapPin,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Instagram,
  Github,
  ChevronRight,
  Flame,
  LayoutGrid,
  Users,
  ListTodo,
  Calendar as CalendarIcon,
  LogOut
} from "lucide-react";
import { User, Mission } from "../app/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import RecapCard from "./RecapCard";
import HeatMap from "./HeatMap";
import PublicProfile from "./PublicProfile";
import { uploadImage, supabase } from "../lib/supabase";
import FollowListModal from "./FollowListModal";

interface ProfileProps {
  user: User;
  refreshUser: () => Promise<void>;
  api: (path: string, options?: RequestInit) => Promise<any>;
}

interface LeaderboardEntry {
  id: number;
  name: string;
  department: string;
  reputation_score: number;
  interests?: string;
}

const TABS = ["Stats", "Leaderboard", "Missions", "Gallery"] as const;
type Tab = (typeof TABS)[number];

export default function Profile({ user, refreshUser, api }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Stats");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pastMissions, setPastMissions] = useState<Mission[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    name: user.name || "",
    department: user.department || "",
    bio: user.bio || "",
    instagram: user.instagram || "",
    github: user.github || "",
    location: user.location || "",
    avatarUrl: user.avatar_url || "",
  });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    setForm({
      name: user.name || "",
      department: user.department || "",
      bio: user.bio || "",
      instagram: user.instagram || "",
      github: user.github || "",
      location: user.location || "",
      avatarUrl: user.avatar_url || "",
    });
  }, [user, showEdit]);

  const [recapData, setRecapData] = useState<any | null>(null);
  const [showRecapCard, setShowRecapCard] = useState(false);
  const [recapsList, setRecapsList] = useState<any[]>([]);
  const [loadingRecaps, setLoadingRecaps] = useState(false);

  const [theme] = useState<"dark" | "light">("dark");

  // Gallery filters/sorters
  const [gallerySort, setGallerySort] = useState("newest");
  const [galleryCategory, setGalleryCategory] = useState("all");
  const [galleryYear, setGalleryYear] = useState("all");

  // V2 stats & public profiles
  const [profileStats, setProfileStats] = useState<any | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  const [selectedLeaderboardUserId, setSelectedLeaderboardUserId] = useState<number | null>(null);
  const [leaderboardProfileOpen, setLeaderboardProfileOpen] = useState(false);
  const [isFollowListOpen, setIsFollowListOpen] = useState(false);
  const [followListInitialTab, setFollowListInitialTab] = useState<"followers" | "following">("followers");

  async function loadProfileStats() {
    setLoadingStats(true);
    try {
      const data = await api(`/users/${user.id}/public`);
      setProfileStats(data.stats);
      setFollowersCount(data.followersCount);
      setFollowingCount(data.followingCount);
    } catch (err) {
      console.error("Failed to load profile stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    loadProfileStats();
  }, [user.id]);

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout API call failed", e);
    }
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem("lockin_user_id");
    window.location.reload();
  }

  async function loadRecaps() {
    setLoadingRecaps(true);
    try {
      const list = await api(
        `/recaps/user/${user.id}?sortBy=${gallerySort}&category=${galleryCategory}&year=${galleryYear}`
      );
      setRecapsList(list);
    } catch (err) {
      console.error(err);
      setRecapsList([]);
    } finally {
      setLoadingRecaps(false);
    }
  }

  useEffect(() => {
    if (activeTab === "Gallery") {
      loadRecaps();
    }
  }, [activeTab, gallerySort, galleryCategory, galleryYear]);

  async function handleGenerateWrapped(recapType: "weekly" | "monthly" | "yearly") {
    try {
      const result = await api("/recaps/generate", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, recapType })
      });
      setRecapData(result);
      setShowRecapCard(true);
    } catch (err: any) {
      alert(err.message || "Failed to generate Wrapped card.");
    }
  }

  async function handleGenerateTeamSummary() {
    try {
      const list = await api(`/recaps/user/${user.id}`);
      const teamRecap = list.find((r: any) => r.participantCount && r.participantCount > 1);
      
      if (!teamRecap) {
        alert("No collaborative team focus runs found in your history.");
        return;
      }
      
      setRecapData({
        ...teamRecap,
        recapType: "team"
      });
      setShowRecapCard(true);
    } catch (err: any) {
      alert(err.message || "Failed to generate team summary.");
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

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const idx = TABS.indexOf(activeTab);
    const el = tabRefs.current[idx];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "Leaderboard" && user.campus_id) {
      setLoadingLeaderboard(true);
      api(`/users/leaderboard?campusId=${user.campus_id}`)
        .then(setLeaderboard)
        .catch(() => setLeaderboard([]))
        .finally(() => setLoadingLeaderboard(false));
    }
  }, [activeTab, user.campus_id]);

  useEffect(() => {
    if (activeTab === "Missions") {
      setLoadingMissions(true);
      api(`/missions/active/${user.id}`)
        .then((data: Mission[]) => {
          const past = data.filter(
            (m) => m.status === "Completed" || m.status === "Missed" || m.showed_up !== undefined
          );
          setPastMissions(past);
        })
        .catch(() => setPastMissions([]))
        .finally(() => setLoadingMissions(false));
    }
  }, [activeTab, user.id]);

  const initials = user.name
    ? user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const aura = user.reputation_score ?? 0;

  async function handleSync() {
    setSyncing(true);
    try {
      await refreshUser();
      await loadProfileStats();
    } catch {}
    setTimeout(() => setSyncing(false), 800);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError("");
    try {
      const publicUrl = await uploadImage(file);
      setForm((f) => ({ ...f, avatarUrl: publicUrl }));
    } catch (err: any) {
      setError(err.message || "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    setUpdating(true);
    setError("");
    try {
      await api(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      await refreshUser();
      await loadProfileStats();
      setShowEdit(false);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md md:max-w-5xl px-4 py-6 pb-24 md:pb-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left Column: Profile Card */}
        <div className="md:col-span-1">
          {/* ── Profile header ── */}
          <div className="relative overflow-hidden rounded-2xl border border-luxuryMaroon/15 bg-noirBlack/60 p-5 md:p-6.5">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || "User"}
              className="h-14 w-14 md:h-16 md:w-16 shrink-0 rounded-2xl object-cover border border-cherryRed/35 bg-cherryRed/5 shadow-[0_0_24px_rgba(129,1,0,0.15)]"
            />
          ) : (
            <div className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-2xl border border-cherryRed/35 bg-cherryRed/5 text-lg md:text-xl font-black text-white shadow-[0_0_24px_rgba(129,1,0,0.15)]">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <h2 className="text-base md:text-xl font-black text-white leading-tight">{user.name}</h2>
            <p className="text-[11px] md:text-xs text-zinc-500 font-semibold mt-1 truncate">{user.department}</p>
            {user.bio && (
              <p className="text-[11px] md:text-xs text-white/70 mt-1.5 leading-snug line-clamp-2">{user.bio}</p>
            )}
          </div>
        </div>

        {/* Aura + location pills */}
        <div className="mt-4 md:mt-5 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-cherryRed/30 bg-cherryRed/[0.08] px-2.5 md:px-3.5 py-1 md:py-1.5 text-[10px] md:text-xs font-sans font-black text-cherryRed uppercase tracking-wider">
            <img src="/aura-bolt.png" alt="Aura" className="h-3.5 w-3.5 object-contain shrink-0" />
            {aura} Aura
          </span>
          {user.location && (
            <span className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 md:px-3.5 py-1 md:py-1.5 text-[10px] md:text-xs font-semibold text-zinc-500">
              <MapPin className="h-3 w-3" />
              {user.location}
            </span>
          )}
          {user.interests && (
            <span className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 md:px-3.5 py-1 md:py-1.5 text-[10px] md:text-xs font-semibold text-zinc-500 truncate max-w-[160px]">
              {user.interests}
            </span>
          )}
        </div>

        {/* Follow counts */}
        <div className="mt-2.5 flex gap-2.5 text-[10px] font-bold text-zinc-500 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
          <div
            onClick={() => {
              setFollowListInitialTab("followers");
              setIsFollowListOpen(true);
            }}
            className="cursor-pointer hover:text-white transition-colors"
          >
            <span className="text-white font-black mr-0.5">{followersCount}</span> Followers
          </div>
          <div className="w-px bg-white/10" />
          <div
            onClick={() => {
              setFollowListInitialTab("following");
              setIsFollowListOpen(true);
            }}
            className="cursor-pointer hover:text-white transition-colors"
          >
            <span className="text-white font-black mr-0.5">{followingCount}</span> Following
          </div>
        </div>

        {/* Socials row */}
        {(user.instagram || user.github) && (
          <div className="mt-3.5 flex gap-3.5">
            {user.instagram && (
              <a
                href={`https://instagram.com/${user.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-zinc-500 hover:text-white transition"
              >
                <Instagram className="h-3.5 w-3.5 md:h-4 md:w-4" />@{user.instagram}
              </a>
            )}
            {user.github && (
              <a
                href={`https://github.com/${user.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-zinc-500 hover:text-white transition"
              >
                <Github className="h-3.5 w-3.5 md:h-4 md:w-4" />@{user.github}
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 md:mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex h-9 md:h-11 items-center justify-center gap-2 rounded-xl border border-cherryRed/20 bg-cherryRed/5 text-[11px] md:text-xs font-black uppercase tracking-wider text-white transition hover:bg-cherryRed/10 hover:text-white disabled:opacity-50"
          >
            <Activity className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="flex h-9 md:h-11 items-center justify-center gap-2 rounded-xl border border-cherryRed/20 bg-cherryRed/5 text-[11px] md:text-xs font-black uppercase tracking-wider text-white transition hover:bg-cherryRed/10 hover:text-white"
          >
            Edit Profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 md:h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-[11px] md:text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white transition hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log Out
          </button>
        </div>
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="md:col-span-2 space-y-5">
          {/* ── Tab bar ── */}
          <div className="relative flex gap-0 rounded-xl border border-white/5 bg-black/60 p-1">
        <motion.div
          className="absolute top-1 bottom-1 rounded-lg bg-cherryRed/15 border border-cherryRed/30"
          animate={{ left: indicator.left, width: indicator.width }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
        {TABS.map((tab, idx) => (
          <button
            key={tab}
            ref={(el) => { tabRefs.current[idx] = el; }}
            onClick={() => setActiveTab(tab)}
            className={`relative z-10 flex-1 py-2 md:py-2.5 text-[11px] md:text-xs font-black uppercase tracking-wider transition ${
              activeTab === tab ? "text-white" : "text-zinc-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "Stats" && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Aura bar */}
            <div className="rounded-2xl border border-white/5 bg-black/60 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Aura Points</span>
                <span className="text-sm font-black text-cherryRed">{aura}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (aura / 500) * 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-red-950 to-cherryRed"
                />
              </div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold text-left">
                {aura < 100 ? "Initiate" : aura < 250 ? "Executor" : aura < 500 ? "Specialist" : "Elite"}
                {" — "}{Math.max(0, 500 - aura)} Aura to Elite
              </p>
            </div>

            {/* Info tiles */}
            <div className="space-y-2">
              {[
                { label: "Institution", value: user.college },
                { label: "Email / Reg ID", value: user.college_id },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/5 bg-black/40 px-4 py-3 flex justify-between items-center"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{item.label}</span>
                  <span className="text-[11px] font-semibold text-white max-w-[200px] truncate text-right">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Execution Metrics Grid */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left pl-1">
                Execution Metrics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Missions Completed", value: profileStats?.totalMissions ?? 0, icon: Flame, color: "text-cherryRed" },
                  { label: "Focus Hours", value: `${profileStats?.focusHours ?? 0}h`, icon: Clock, color: "text-cherryRed" },
                  { label: "Completion Rate", value: `${profileStats?.completionRate ?? 100}%`, icon: CheckCircle2, color: "text-emerald-500" },
                  { label: "Current Streak", value: `${profileStats?.currentStreak ?? 0}d`, icon: Zap, color: "text-amber-500" },
                  { label: "Tasks Completed", value: profileStats?.tasksCompleted ?? 0, icon: ListTodo, color: "text-white" },
                  { label: "Active Days", value: profileStats?.activeDays ?? 0, icon: CalendarIcon, color: "text-sky-500" },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-xl border border-white/5 bg-black/40 p-3 flex flex-col justify-between space-y-2 text-left">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 leading-tight">{stat.label}</span>
                        <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                      </div>
                      <span className="text-lg font-black text-white leading-none">{stat.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LOCKIN Heatmap */}
            <HeatMap userId={user.id} userJoinedAt={user.verified_at} api={api} />

            {/* Wrapped Recaps Action Block */}
            <div className="rounded-2xl border border-white/5 bg-black/60 p-4 space-y-4">
              <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">
                Wrapped Achievement Cards
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleGenerateWrapped("weekly")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#09090b]/50 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white hover:bg-cherryRed/10 hover:border-cherryRed/30 transition group"
                >
                  <Zap className="h-3.5 w-3.5 text-white transition-colors duration-200 group-hover:text-cherryRed" /> Weekly Wrapped
                </button>
                <button
                  onClick={() => handleGenerateWrapped("monthly")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#09090b]/50 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white hover:bg-cherryRed/10 hover:border-cherryRed/30 transition group"
                >
                  <Trophy className="h-3.5 w-3.5 text-white transition-colors duration-200 group-hover:text-cherryRed" /> Monthly Wrapped
                </button>
                <button
                  onClick={() => handleGenerateWrapped("yearly")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#09090b]/50 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white hover:bg-cherryRed/10 hover:border-cherryRed/30 transition group"
                >
                  <Activity className="h-3.5 w-3.5 text-white transition-colors duration-200 group-hover:text-cherryRed" /> Yearly Wrapped
                </button>
                <button
                  onClick={handleGenerateTeamSummary}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#09090b]/50 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white hover:bg-cherryRed/10 hover:border-cherryRed/30 transition group"
                >
                  <Users className="h-3.5 w-3.5 text-white transition-colors duration-200 group-hover:text-cherryRed" /> Team Summary
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "Leaderboard" && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {!user.campus_id ? (
              <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-8 text-center">
                <Trophy className="h-6 w-6 mx-auto text-zinc-700 mb-3" />
                <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Campus not set</p>
                <p className="text-[11px] text-zinc-700 mt-1">Re-register with a campus to see rankings.</p>
              </div>
            ) : loadingLeaderboard ? (
              <div className="py-12 text-center text-[11px] font-bold text-zinc-700 uppercase tracking-widest">
                Loading...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-8 text-center">
                <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No data yet</p>
                <p className="text-[11px] text-zinc-700 mt-1">Complete missions to appear on the board.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-zinc-950/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-cherryRed" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Campus Leaderboard</span>
                </div>
                <div className="divide-y divide-white/4">
                  {leaderboard.map((entry, idx) => {
                    const isYou = entry.id === user.id;
                    const rankColor =
                      idx === 0
                        ? "text-cherryRed font-black"
                        : idx === 1
                        ? "text-zinc-300 font-black"
                        : idx === 2
                        ? "text-zinc-500 font-bold"
                        : "text-zinc-700 font-bold";
                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          if (!isYou) {
                            setSelectedLeaderboardUserId(entry.id);
                            setLeaderboardProfileOpen(true);
                          }
                        }}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          isYou ? "bg-cherryRed/5" : "cursor-pointer hover:bg-white/2"
                        }`}
                      >
                        <span className={`w-5 text-xs shrink-0 text-right ${rankColor}`}>
                          {idx === 0 ? "①" : idx === 1 ? "②" : idx === 2 ? "③" : `${idx + 1}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isYou ? "text-cherryRed" : "text-white"}`}>
                            {entry.name} {isYou && <span className="text-[9px] text-zinc-600">(you)</span>}
                          </p>
                          <p className="text-[10px] text-zinc-600 truncate">{entry.department}</p>
                        </div>
                        <span className="text-xs font-black text-white shrink-0">
                          {entry.reputation_score}
                          <span className="text-[9px] text-zinc-600 ml-0.5 font-normal">Aura</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "Missions" && (
          <motion.div
            key="missions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {loadingMissions ? (
              <div className="py-12 text-center text-[11px] font-bold text-zinc-700 uppercase tracking-widest">
                Loading...
              </div>
            ) : pastMissions.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-8 text-center">
                <LayoutGrid className="h-6 w-6 mx-auto text-zinc-700 mb-3" />
                <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No missions yet</p>
                <p className="text-[11px] text-zinc-700 mt-1">Accept a mission from the feed to get started.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-zinc-950/60 overflow-hidden">
                <div className="divide-y divide-white/4">
                  {pastMissions.map((m) => {
                    const done = m.status === "Completed";
                    const missed = m.status === "Missed";
                    return (
                      <div key={`${m.id}-${m.role}`} className="flex items-center gap-3 px-4 py-3">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
                        ) : missed ? (
                          <XCircle className="h-4 w-4 shrink-0 text-boxRed" />
                        ) : (
                          <Clock className="h-4 w-4 shrink-0 text-zinc-600" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">{m.title}</p>
                          <p className="text-[10px] text-zinc-600">
                            {m.role === "creator" ? "You hosted" : `Partner: ${m.creator_name}`}
                            {" · "}
                            {m.datetime
                              ? new Date(m.datetime).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "Flexible"}
                          </p>
                        </div>
                        {done && (
                          <button
                            onClick={() => handleViewMissionRecap(m.id)}
                            className="text-[9px] font-black uppercase border border-cherryRed/30 bg-cherryRed/5 px-2.5 py-1 rounded-lg text-cherryRed hover:bg-cherryRed/10 transition mr-2"
                          >
                            View Recap
                          </button>
                        )}
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            done
                              ? "border-white/20 bg-white/5 text-white"
                              : missed
                              ? "border-cherryRed/25 bg-cherryRed/8 text-cherryRed"
                              : "border-white/10 text-zinc-600"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "Gallery" && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Filters bar */}
            <div className="flex flex-wrap gap-2.5 items-center justify-between bg-zinc-950/60 p-3 rounded-2xl border border-white/5">
              <div className="flex flex-1 gap-2 min-w-[200px]">
                <select
                  value={galleryCategory}
                  onChange={(e) => setGalleryCategory(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-white/10 bg-zinc-900 text-[10px] font-black uppercase tracking-wider text-white px-2 outline-none focus:border-cherryRed"
                >
                  <option value="all">All Categories</option>
                  <option value="Programming">Programming</option>
                  <option value="Study">Study</option>
                  <option value="Design">Design</option>
                  <option value="Writing">Writing</option>
                  <option value="Research">Research</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={galleryYear}
                  onChange={(e) => setGalleryYear(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-white/10 bg-zinc-900 text-[10px] font-black uppercase tracking-wider text-white px-2 outline-none focus:border-cherryRed"
                >
                  <option value="all">All Years</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>

              <select
                value={gallerySort}
                onChange={(e) => setGallerySort(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-900 text-[10px] font-black uppercase tracking-wider text-white px-2 outline-none focus:border-cherryRed"
              >
                <option value="newest">Newest First</option>
                <option value="longest">Longest Session</option>
                <option value="tasks">Most Tasks</option>
              </select>
            </div>

            {/* Gallery Grid */}
            {loadingRecaps ? (
              <div className="py-12 text-center text-[11px] font-bold text-zinc-700 uppercase tracking-widest">
                Loading recaps...
              </div>
            ) : recapsList.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-12 text-center">
                <LayoutGrid className="h-6 w-6 mx-auto text-zinc-700 mb-3" />
                <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Gallery Empty</p>
                <p className="text-[11px] text-zinc-700 mt-1">Complete focus runs to accumulate achievement cards.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recapsList.map((recap) => {
                  const durationHrs = Math.floor(recap.sessionDuration / 60);
                  const durationMins = recap.sessionDuration % 60;
                  const durationText = durationHrs > 0 ? `${durationHrs}h ${durationMins}m` : `${durationMins}m`;

                  return (
                    <motion.div
                      key={recap.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setRecapData(recap);
                        setShowRecapCard(true);
                      }}
                      className="cursor-pointer group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/40 p-5 flex flex-col justify-between hover:border-cherryRed/30 transition shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <span className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-white/5 text-zinc-500 font-display">
                          {recap.categorySnapshot || "Other"}
                        </span>
                        <span className="text-[8px] font-bold text-zinc-500 font-display">
                          {new Date(recap.generatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-black text-white line-clamp-1 group-hover:text-cherryRed transition">
                        {recap.missionTitle || "Focus Sprint"}
                      </h4>
                      
                      <div className="mt-4 flex items-center justify-between border-t border-white/4 pt-3 text-[10px] font-bold text-zinc-400 font-display">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-cherryRed" />
                          <span>{durationText}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                          <span>{recap.tasksCompleted} Tasks</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </div>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="border-white/10 bg-zinc-950/98 text-white max-w-sm rounded-3xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black tracking-widest text-white uppercase">
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-3 mt-1">
            {/* Profile Picture Upload Section */}
            <div className="flex flex-col items-center gap-2.5 py-1">
              <div
                onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                className="relative group cursor-pointer w-20 h-20 rounded-2xl overflow-hidden border border-white/[0.08] hover:border-cherryRed/40 transition-colors"
              >
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt="PFP Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-lg font-black text-zinc-500 uppercase">
                    {initials}
                  </div>
                )}
                {uploadingAvatar ? (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-t-cherryRed border-white/20 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[9px] font-black uppercase text-white tracking-wider">Change</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {[
              { label: "Full Name", key: "name", placeholder: "Your Name" },
              { label: "Department & Year", key: "department", placeholder: "e.g. CSE, 3rd Year" },
              { label: "Meet Spot", key: "location", placeholder: "e.g. Library, Block B Canteen..." },
              { label: "Bio", key: "bio", placeholder: "What are you building?" },
              { label: "Instagram", key: "instagram", placeholder: "@username" },
              { label: "GitHub", key: "github", placeholder: "@username" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  {label}
                </label>
                <Input
                  value={(form as any)[key]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="h-10 border-white/10 bg-black/40 text-xs text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-1 focus:ring-cherryRed/10"
                />
              </div>
            ))}


            {error && (
              <p className="text-[11px] font-bold text-cherryRed">{error}</p>
            )}

            <button
              type="submit"
              disabled={updating}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-boxRed/20 bg-boxRed text-xs font-black uppercase tracking-wider text-white transition hover:bg-boxRed/90 disabled:opacity-50"
            >
              <Flame className="h-3.5 w-3.5 fill-current" />
              {updating ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recap Card Modal */}
      {recapData && (
        <RecapCard
          isOpen={showRecapCard}
          onClose={() => setShowRecapCard(false)}
          recapData={recapData}
        />
      )}

      {/* Leaderboard Public Profile Overlay */}
      {selectedLeaderboardUserId && (
        <PublicProfile
          userId={selectedLeaderboardUserId}
          viewerId={user.id}
          isOpen={leaderboardProfileOpen}
          onClose={() => {
            setLeaderboardProfileOpen(false);
            setSelectedLeaderboardUserId(null);
          }}
          api={api}
        />
      )}

      {/* Followers & Following listing modal */}
      <FollowListModal
        isOpen={isFollowListOpen}
        onClose={() => setIsFollowListOpen(false)}
        userId={user.id}
        initialTab={followListInitialTab}
        onViewProfile={(profileId) => {
          setSelectedLeaderboardUserId(profileId);
          setLeaderboardProfileOpen(true);
        }}
        api={api}
      />
    </section>
  );
}
