"use client";

import React, { useState, useEffect, useRef } from "react";
import UsernameField, { UsernameState } from "./inbox/UsernameField";
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
  LogOut,
  RefreshCw,
  Camera,
  KeyRound
} from "lucide-react";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { User, Mission } from "../app/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, fieldClass } from "./ui/input";
import { CountUp, Reveal, Skeleton, Spotlight } from "./ui/motion";
import { spring } from "../lib/motion";
import { AuraAvatar } from "./ui/AuraAvatar";
import RecapCard from "./RecapCard";
import HeatMap from "./HeatMap";
import PublicProfile from "./PublicProfile";
import { uploadImage, supabase } from "../lib/supabase";
import FollowListModal from "./FollowListModal";
import { POINTS_NAME } from "../lib/brand";

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
  const [showPassword, setShowPassword] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    name: user.name || "",
    username: user.username || "",
    department: user.department || "",
    bio: user.bio || "",
    instagram: user.instagram || "",
    github: user.github || "",
    location: user.location || "",
    avatarUrl: user.avatar_url || "",
  });
  const [updating, setUpdating] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [usernameError, setUsernameError] = useState("");
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    setForm({
      name: user.name || "",
      username: user.username || "",
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
    localStorage.removeItem("lockin_demo_active");
    localStorage.removeItem("lockin_demo_user");
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

  async function handleViewMissionRecap(missionId: number) {
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
    const usernameChanged = form.username !== (user.username || "");
    if (usernameChanged && usernameState !== "available") {
      setUsernameError(usernameState === "checking" ? "Still checking that username…" : "Pick an available username.");
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
      if (err?.status === 409 || (err?.status === 400 && /username/i.test(err.message || ""))) setUsernameError(err.message);
      else setError(err.message || "Failed to update profile.");
    } finally {
      setUpdating(false);
    }
  }

  const tier = aura < 100 ? { name: "Initiate", floor: 0, ceil: 100 } : aura < 250 ? { name: "Executor", floor: 100, ceil: 250 } : aura < 500 ? { name: "Specialist", floor: 250, ceil: 500 } : { name: "Elite", floor: 500, ceil: 500 };
  const tierProgress = tier.ceil === tier.floor ? 1 : (aura - tier.floor) / (tier.ceil - tier.floor);

  const streak = Number(profileStats?.currentStreak ?? 0);
  const stats = [
    { label: "Missions", value: Number(profileStats?.totalMissions ?? 0), suffix: "" },
    { label: "Focus hours", value: Number(profileStats?.focusHours ?? 0), suffix: "" },
    { label: "Completion", value: Number(profileStats?.completionRate ?? 0), suffix: "%" },
    { label: "Tasks done", value: Number(profileStats?.tasksCompleted ?? 0), suffix: "" }
  ];

  return (
    <section className="mx-auto w-full max-w-md space-y-5 px-5 pt-2 md:max-w-[1240px] md:px-12 md:pt-14">
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
        {/* ── Identity ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.glide}
          className="relative overflow-hidden rounded-card border border-line bg-surface md:sticky md:top-20"
        >
          <div className="relative flex flex-col items-center px-5 pb-5 pt-8 text-center">
            <AuraAvatar src={user.avatar_url} initials={initials} progress={tierProgress} />

            <h1 className="t-display mt-5 text-title-1 text-ink">{user.name}</h1>
            {user.username && <p className="mt-1 text-subhead text-ink-2">@{user.username}</p>}
            <p className="mt-1 text-subhead text-ink-3">{user.department}</p>
            {user.bio && <p className="mt-3 max-w-[280px] text-subhead leading-relaxed text-ink-2">{user.bio}</p>}

            {!user.avatar_url && (
              <button type="button" onClick={() => setShowEdit(true)} className="mt-3 h-11 px-3 text-footnote text-ink-2 underline decoration-line underline-offset-4 hover:text-ink">
                Add a photo so people recognise you
              </button>
            )}

            <div className="mt-5 w-full rounded-sm bg-signal p-4 text-left text-ink">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2">
                  <CountUp value={aura} className="t-display tabular text-[40px] leading-none" />
                  <span className="t-label text-ink/80">{POINTS_NAME}</span>
                </span>
                <span className="t-label text-ink">{tier.name}</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden bg-ink/25" aria-hidden="true">
                <div className="h-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, tierProgress * 100))}%` }} />
              </div>
              <p className="mt-2 text-footnote text-ink/85">
                {tier.ceil === tier.floor ? "Top rank. Keep showing up." : `${Math.max(0, tier.ceil - aura)} to the next rank`}
              </p>
            </div>

            {/* Follow counts */}
            <div className="mt-5 grid w-full grid-cols-2 divide-x divide-line rounded-xl border border-line">
              {(
                [
                  { tab: "followers", n: followersCount, label: "Followers" },
                  { tab: "following", n: followingCount, label: "Following" }
                ] as const
              ).map((f) => (
                <button
                  key={f.tab}
                  type="button"
                  onClick={() => {
                    setFollowListInitialTab(f.tab);
                    setIsFollowListOpen(true);
                  }}
                  className="flex flex-col items-center py-3 transition-colors hover:bg-raised"
                >
                  <CountUp value={f.n} className="t-display text-title-2 text-ink" />
                  <span className="t-label mt-0.5">{f.label}</span>
                </button>
              ))}
            </div>

            {(user.location || user.instagram || user.github) && (
              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-subhead">
                {user.location && (
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <MapPin className="h-4 w-4 text-crimson" />
                    {user.location}
                  </span>
                )}
                {user.instagram && (
                  <a href={`https://instagram.com/${user.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink">
                    <Instagram className="h-4 w-4" />@{user.instagram}
                  </a>
                )}
                {user.github && (
                  <a href={`https://github.com/${user.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink">
                    <Github className="h-4 w-4" />@{user.github}
                  </a>
                )}
              </div>
            )}

            <div className="mt-5 grid w-full grid-cols-[1fr_auto_auto] gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowEdit(true)}
                className="btn-primary h-11"
              >
                Edit profile
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleSync}
                disabled={syncing}
                aria-label="Refresh"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:text-ink"
              >
                <motion.span animate={syncing ? { rotate: 360 } : { rotate: 0 }} transition={syncing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0 }} className="flex">
                  <RefreshCw className="h-[18px] w-[18px]" />
                </motion.span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowPassword(true)}
                aria-label="Change password"
                title="Change password"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:text-ink"
              >
                <KeyRound className="h-[18px] w-[18px]" />
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleLogout}
                aria-label="Log out"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:border-signal/70 hover:text-crimson"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Content ── */}
        <div className="space-y-5 md:col-span-2">
          <div className="flex rounded-xl border border-line bg-surface p-1" role="tablist">
            {TABS.map((tab) => {
              const on = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveTab(tab)}
                  className={`relative h-11 flex-1 rounded-sm text-[11px] font-medium uppercase tracking-[0.2em] transition-colors ${on ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
                >
                  {on && <motion.span layoutId="profile-tab" className="absolute inset-0 rounded-lg bg-raised shadow-[inset_0_-2px_0_rgb(var(--signal))]" transition={spring.glide} />}
                  <span className="relative">{tab === "Leaderboard" ? "Ranks" : tab}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "Stats" && (
              <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} className="space-y-5">
                {/* Tier */}
                <div className="rounded-card border border-line bg-surface p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="t-label">Level</p>
                      <p className="t-display mt-1 text-title-1 text-ink">{tier.name}</p>
                    </div>
                    <p className="text-right text-subhead text-ink-2">
                      {tier.name === "Elite" ? "Top tier" : (
                        <>
                          <span className="tabular font-semibold text-ink">{Math.max(0, tier.ceil - aura)}</span> to next
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-5 h-px bg-line">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, tierProgress * 100)}%` }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                      className="relative h-full bg-signal"
                    >
                      <span className="absolute right-0 top-1/2 h-[5px] w-[5px] -translate-y-1/2 translate-x-1/2 bg-signal" />
                    </motion.div>
                  </div>
                </div>

                {/* Metrics bento: the streak leads, four figures share one surface */}
                <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-4" each={0.06}>
                  <Reveal.Item className="col-span-2 sm:row-span-2">
                    <Spotlight className="h-full overflow-hidden rounded-card border border-line bg-surface">
                      <div className="relative flex h-full min-h-[148px] flex-col justify-between p-5">
                        <div className="relative flex items-center justify-between">
                          <p className="text-headline text-ink">Streak</p>
                          <Flame className={`h-6 w-6 ${streak > 0 ? "text-crimson" : "text-ink-3"}`} />
                        </div>
                        <div className="relative">
                          <p className="t-display text-[64px] leading-none text-ink">
                            {loadingStats ? "–" : <CountUp value={streak} />}
                            <span className="ml-1 text-title-2 text-ink-3">{streak === 1 ? "day" : "days"}</span>
                          </p>
                          <p className="mt-2 text-subhead text-ink-2">{streak > 0 ? "Don't break it today." : "Finish a mission to start one."}</p>
                        </div>
                      </div>
                    </Spotlight>
                  </Reveal.Item>
                  <Reveal.Item className="col-span-2 sm:row-span-2">
                    <dl className="grid h-full grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-card border border-line bg-surface [&>div:nth-child(2)]:border-t-0 [&>div:nth-child(odd)]:border-l-0">
                      {stats.map((s) => (
                        <div key={s.label} className="flex flex-col justify-end p-4">
                          <dd className="t-display text-title-1 text-ink">
                            {loadingStats ? "–" : <><CountUp value={s.value} />{s.suffix}</>}
                          </dd>
                          <dt className="mt-1 text-footnote text-ink-3">{s.label}</dt>
                        </div>
                      ))}
                    </dl>
                  </Reveal.Item>
                </Reveal>

                <HeatMap userId={user.id} userJoinedAt={user.verified_at} api={api} />

                {/* Wrapped */}
                <div className="rounded-card border border-line bg-surface p-5">
                  <p className="t-label">Wrapped</p>
                  <p className="mt-1 text-subhead text-ink-2">A shareable card of your recent work.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { label: "This week", icon: Zap, run: () => handleGenerateWrapped("weekly") },
                      { label: "This month", icon: Trophy, run: () => handleGenerateWrapped("monthly") },
                      { label: "This year", icon: Activity, run: () => handleGenerateWrapped("yearly") },
                      { label: "Team runs", icon: Users, run: handleGenerateTeamSummary }
                    ].map((w) => (
                      <motion.button
                        key={w.label}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={w.run}
                        className="group flex h-14 items-center gap-3 rounded-xl border border-line bg-raised px-4 text-left transition-colors hover:border-signal/70"
                      >
                        <w.icon className="h-5 w-5 text-ink-3 transition-colors group-hover:text-crimson" />
                        <span className="text-subhead font-medium text-ink">{w.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="rounded-card border border-line bg-surface">
                  {[
                    { label: "College", value: user.college },
                    { label: "Account", value: user.college_id }
                  ].map((item, i) => (
                    <div key={item.label} className={`flex items-center justify-between gap-4 px-5 py-4 ${i ? "border-t border-line" : ""}`}>
                      <span className="t-label">{item.label}</span>
                      <span className="truncate text-right text-subhead text-ink-2">{item.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "Leaderboard" && (
              <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}>
                {!user.campus_id ? (
                  <Empty icon={Trophy} title="No campus set" body="Add your college to see where you rank." />
                ) : loadingLeaderboard ? (
                  <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
                ) : leaderboard.length === 0 ? (
                  <Empty icon={Trophy} title="No ranks yet" body="Finish a mission to get on the board." />
                ) : (
                  <div className="space-y-4">
                    {/* Podium */}
                    {leaderboard.length >= 3 && (
                      <div className="grid grid-cols-3 items-end gap-2">
                        {[1, 0, 2].map((rank) => {
                          const e = leaderboard[rank];
                          const h = rank === 0 ? "h-36" : rank === 1 ? "h-28" : "h-24";
                          return (
                            <motion.button
                              key={e.id}
                              type="button"
                              onClick={() => {
                                if (e.id !== user.id) {
                                  setSelectedLeaderboardUserId(e.id);
                                  setLeaderboardProfileOpen(true);
                                }
                              }}
                              initial={{ opacity: 0, y: 30 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ ...spring.pop, delay: 0.1 + (2 - rank) * 0.1 }}
                              className="flex flex-col items-center gap-2 text-center"
                            >
                              <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-title-3 font-bold ${rank === 0 ? "border-signal/70 bg-raised text-crimson" : "border-line bg-raised text-ink"}`}>
                                {e.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                              <span className="w-full truncate text-footnote font-medium text-ink">{e.name.split(" ")[0]}</span>
                              <div
                                className={`flex w-full flex-col items-center justify-start rounded-t-xl border border-b-0 pt-3 ${h} ${
                                  rank === 0 ? "border-signal/70 bg-raised" : "border-line bg-gradient-to-b from-raised to-transparent"
                                }`}
                              >
                                <span className={`t-display text-title-1 ${rank === 0 ? "text-crimson" : "text-ink-2"}`}>{rank + 1}</span>
                                <span className="tabular text-footnote text-ink-3">{e.reputation_score}</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    <Reveal className="overflow-hidden rounded-card border border-line bg-surface" each={0.03}>
                      {leaderboard.map((entry, idx) => {
                        if (leaderboard.length >= 3 && idx < 3) return null;
                        const isYou = entry.id === user.id;
                        return (
                          <Reveal.Item key={entry.id}>
                            <button
                              type="button"
                              disabled={isYou}
                              onClick={() => {
                                setSelectedLeaderboardUserId(entry.id);
                                setLeaderboardProfileOpen(true);
                              }}
                              className={`flex w-full items-center gap-4 border-t border-line px-5 py-3.5 text-left first:border-t-0 ${isYou ? "bg-signal/[0.07]" : "transition-colors hover:bg-raised"}`}
                            >
                              <span className="t-display tabular w-7 text-title-3 text-ink-3">{idx + 1}</span>
                              <span className="min-w-0 flex-1">
                                <span className={`block truncate text-subhead font-medium ${isYou ? "text-crimson" : "text-ink"}`}>
                                  {entry.name}
                                  {isYou && <span className="ml-1.5 text-footnote text-ink-3">you</span>}
                                </span>
                                <span className="block truncate text-footnote text-ink-3">{entry.department}</span>
                              </span>
                              <span className="tabular text-subhead font-semibold text-ink">
                                {entry.reputation_score}
                                <span className="ml-1 text-caption font-normal text-ink-3">{POINTS_NAME}</span>
                              </span>
                            </button>
                          </Reveal.Item>
                        );
                      })}
                    </Reveal>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "Missions" && (
              <motion.div key="missions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}>
                {loadingMissions ? (
                  <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
                ) : pastMissions.length === 0 ? (
                  <Empty icon={LayoutGrid} title="No history yet" body="Missions you finish or miss land here." />
                ) : (
                  <Reveal className="overflow-hidden rounded-card border border-line bg-surface" each={0.04}>
                    {pastMissions.map((m) => {
                      const done = m.status === "Completed";
                      const missed = m.status === "Missed";
                      return (
                        <Reveal.Item key={`${m.id}-${m.role}`}>
                          <div className="flex items-center gap-4 border-t border-line px-5 py-4 first:border-t-0">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-success/10 text-success" : missed ? "bg-surface text-crimson" : "bg-raised text-ink-3"}`}>
                              {done ? <CheckCircle2 className="h-5 w-5" /> : missed ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-subhead font-medium text-ink">{m.title}</p>
                              <p className="text-footnote text-ink-3">
                                {m.role === "creator" ? "Hosted" : (m.creator_name ? `With ${m.creator_name}` : "Side Quest")} · {m.datetime ? new Date(m.datetime).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "On-demand"}
                              </p>
                            </div>
                            {done ? (
                              <button
                                type="button"
                                onClick={() => handleViewMissionRecap(m.id)}
                                className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-line px-3 text-subhead text-ink transition-colors hover:border-ink-3 hover:text-ink"
                              >
                                Recap <ChevronRight className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="t-label shrink-0">{m.status}</span>
                            )}
                          </div>
                        </Reveal.Item>
                      );
                    })}
                  </Reveal>
                )}
              </motion.div>
            )}

            {activeTab === "Gallery" && (
              <motion.div key="gallery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Category",
                      value: galleryCategory,
                      set: setGalleryCategory,
                      opts: [["all", "All"], ["Programming", "Programming"], ["Study", "Study"], ["Design", "Design"], ["Writing", "Writing"], ["Research", "Research"], ["Fitness", "Fitness"], ["Other", "Other"]]
                    },
                    { label: "Year", value: galleryYear, set: setGalleryYear, opts: [["all", "All years"], ["2026", "2026"], ["2025", "2025"]] },
                    { label: "Sort", value: gallerySort, set: setGallerySort, opts: [["newest", "Newest"], ["longest", "Longest"], ["tasks", "Most tasks"]] }
                  ].map((f) => (
                    <label key={f.label} className="block">
                      <span className="sr-only">{f.label}</span>
                      <select value={f.value} onChange={(e) => f.set(e.target.value)} className={`${fieldClass} h-11 appearance-none px-3 text-subhead`}>
                        {f.opts.map(([v, l]) => (
                          <option key={v} value={v} className="bg-surface">
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {loadingRecaps ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
                ) : recapsList.length === 0 ? (
                  <Empty icon={LayoutGrid} title="No recaps yet" body="Each finished session leaves a card here." />
                ) : (
                  <Reveal className="grid grid-cols-1 gap-3 sm:grid-cols-2" each={0.05}>
                    {recapsList.map((recap) => {
                      const h = Math.floor(recap.sessionDuration / 60);
                      const m = recap.sessionDuration % 60;
                      const failed = recap.metadata?.isFailed;
                      return (
                        <Reveal.Item key={recap.id}>
                          <motion.button
                            type="button"
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.98 }}
                            transition={spring.snap}
                            onClick={() => {
                              setRecapData(recap);
                              setShowRecapCard(true);
                            }}
                            className="group relative flex h-full w-full flex-col overflow-hidden rounded-card border border-line bg-surface p-5 text-left transition-colors hover:border-signal/70"
                          >
                            <div className="relative flex items-center justify-between">
                              <span className="t-label">{recap.categorySnapshot || "Other"}</span>
                              <span className="text-footnote text-ink-3">{new Date(recap.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                            <h3 className="t-display relative mt-3 line-clamp-2 text-title-2 text-ink">{recap.missionTitle || "Focus session"}</h3>
                            <div className="relative mt-auto flex items-center gap-5 pt-5 text-subhead text-ink-2">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-crimson" />
                                {h > 0 ? `${h}h ${m}m` : `${m}m`}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-ink-3" />
                                {recap.tasksCompleted} {recap.tasksCompleted === 1 ? "task" : "tasks"}
                              </span>
                            </div>
                          </motion.button>
                        </Reveal.Item>
                      );
                    })}
                  </Reveal>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                aria-label="Change photo"
                className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-line transition-colors hover:border-signal"
              >
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-raised font-display text-title-1 font-bold text-ink-3">{initials}</span>
                )}
                <span className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${uploadingAvatar ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  {uploadingAvatar ? (
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-signal" />
                  ) : (
                    <Camera className="h-6 w-6 text-ink" />
                  )}
                </span>
              </button>
              <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" className="sr-only" />
            </div>

            <div className="space-y-2">
              <label htmlFor="pe-name" className="t-label block">Name</label>
              <Input
                id="pe-name"
                autoComplete="name"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="pe-username" className="t-label mb-2 block">Username</label>
              <UsernameField
                id="pe-username"
                value={form.username}
                onChange={(v) => {
                  setForm((f) => ({ ...f, username: v }));
                  setUsernameError("");
                }}
                onState={setUsernameState}
                api={api}
                serverError={usernameError}
              />
            </div>

            {[
              { label: "Department and year", key: "department", placeholder: "CSE, 3rd year" },
              { label: "Usual spot", key: "location", placeholder: "Main library" },
              { label: "Bio", key: "bio", placeholder: "What are you working on?" },
              { label: "Instagram", key: "instagram", placeholder: "handle" },
              { label: "GitHub", key: "github", placeholder: "handle" }
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-2">
                <label htmlFor={`pe-${key}`} className="t-label block">{label}</label>
                <Input
                  id={`pe-${key}`}
                  autoComplete="off"
                  value={(form as any)[key]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                />
              </div>
            ))}

            {error && (
              <p role="alert" className="text-subhead font-medium text-crimson">
                {error}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={updating}
              whileTap={{ scale: 0.97 }}
              className="flex h-14 w-full items-center justify-center disabled:opacity-50 btn-primary"
            >
              {updating ? "Saving" : "Save"}
            </motion.button>
          </form>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog open={showPassword} onOpenChange={setShowPassword} />

      {recapData && <RecapCard isOpen={showRecapCard} onClose={() => setShowRecapCard(false)} recapData={recapData} />}

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

function Empty({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface/50 px-8 py-14 text-center">
      <Icon className="h-8 w-8 text-ink-3" />
      <p className="t-display mt-4 text-title-2 text-ink">{title}</p>
      <p className="mt-1.5 max-w-[260px] text-subhead text-ink-2">{body}</p>
    </div>
  );
}
