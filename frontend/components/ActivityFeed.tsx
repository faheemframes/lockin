"use client";

import React, { useEffect, useState } from "react";
import { 
  Flame, 
  Users, 
  MapPin, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  Calendar,
  Sparkles,
  ChevronDown,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "../app/types";
import PublicProfile from "./PublicProfile";

interface ActivityFeedProps {
  user: User;
  api: (path: string, options?: RequestInit) => Promise<any>;
}

type FeedFilter = "all" | "following" | "campus";

export default function ActivityFeed({ user, api }: ActivityFeedProps) {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  
  // V2 live activities states
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const [tickerTime, setTickerTime] = useState<number>(Date.now());
  
  // Public Profile dialog state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const loadLiveActivities = async () => {
    try {
      const data = await api("/feed/live");
      setLiveActivities(data || []);
    } catch (err) {
      console.error("Failed to load live activities:", err);
    }
  };

  // Poll live activities and update elapsed timer ticks
  useEffect(() => {
    loadLiveActivities();
    const pollInterval = setInterval(loadLiveActivities, 20000);
    const tickInterval = setInterval(() => setTickerTime(Date.now()), 10000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const calculateLiveElapsed = (startedAtStr: string) => {
    const diffMs = tickerTime - new Date(startedAtStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 0) return "Just started";
    return `${diffMins}m elapsed`;
  };

  const loadFeed = async (replace = true, cursorVal?: number) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const url = `/feed?userId=${user.id}&filter=${filter}&limit=10${
        cursorVal ? `&cursor=${cursorVal}` : ""
      }`;
      const data = await api(url);
      
      if (replace) {
        setFeedItems(data.feedItems || []);
      } else {
        setFeedItems(prev => [...prev, ...(data.feedItems || [])]);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to fetch activity feed:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed(true);
  }, [filter, user.id]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      loadFeed(false, nextCursor);
    }
  };

  const handleOpenProfile = (userIdToOpen: number) => {
    setSelectedUserId(userIdToOpen);
    setProfileOpen(true);
  };

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const filters: { key: FeedFilter; label: string; icon: any }[] = [
    { key: "all", label: "All Activity", icon: Sparkles },
    { key: "following", label: "Following", icon: Users },
    { key: "campus", label: "Campus Feed", icon: MapPin }
  ];

  return (
    <div className="mx-auto w-full max-w-md md:max-w-xl px-4 py-6 pb-24 text-cotton">
      {/* Live Focus Status Bar (Strava-like) */}
      {liveActivities.length > 0 && (
        <div className="mb-6 space-y-2.5 text-left">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cherryRed opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cherryRed"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-cotton leading-none">
              CURRENTLY LOCKED IN
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
            {liveActivities.map((liveUser) => {
              const initials = liveUser.name
                ? liveUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                : "??";
              return (
                <button
                  key={liveUser.userId}
                  onClick={() => handleOpenProfile(liveUser.userId)}
                  className="snap-start shrink-0 rounded-2xl border border-cherryRed/30 bg-noirBlack/60 p-3.5 w-64 text-left flex items-start gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:border-cherryRed/60 hover:bg-noirBlack/85 transition duration-300 relative overflow-hidden"
                >
                  {/* Top-right overlay indicating role */}
                  <span className="absolute top-2 right-3.5 text-[8px] font-black uppercase tracking-widest text-zinc-500">
                    {liveUser.role}
                  </span>
                  
                  {/* User Initial Circle */}
                  <div className="h-10 w-10 rounded-xl border border-white/5 bg-black/45 text-xs font-black text-cotton flex items-center justify-center shrink-0">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1 pr-6">
                    <h4 className="text-[11px] font-black text-white uppercase tracking-wider truncate">
                      {liveUser.name}
                    </h4>
                    <p className="text-[9.5px] text-zinc-400 font-semibold truncate mt-0.5 leading-normal">
                      Focusing on: <span className="text-cherryRed">{liveUser.missionTitle}</span>
                    </p>
                    <span className="inline-flex items-center gap-1 text-[8.5px] font-bold text-zinc-500 uppercase mt-2.5">
                      <Clock className="h-3 w-3 text-zinc-500 shrink-0" />
                      {calculateLiveElapsed(liveUser.workStartedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed Filters */}
      <div className="flex gap-1.5 rounded-xl border border-zinc-800 bg-noirBlack/60 p-1 mb-5">
        {filters.map(({ key, label, icon: Icon }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider transition rounded-lg ${
                active ? "text-cotton bg-cherryRed/10 border border-cherryRed/20" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-cherryRed animate-spin" />
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
            Tuning in to the frequency...
          </p>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-zinc-800 bg-[#09090b]/40 p-6">
          <Flame className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
            No activity logged yet
          </h3>
          <p className="text-[10px] text-zinc-600 font-semibold mt-1">
            {filter === "following" 
              ? "Follow other students or complete missions to populate your feed."
              : "Complete some solo or collaborative focus runs to build momentum."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {feedItems.map((item, idx) => {
              const userInitials = item.user.name
                ? item.user.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
                : "??";
              const isCreator = item.user.id === user.id;

              return (
                <motion.div
                  key={`${item.id}-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className={`rounded-2xl border p-4 space-y-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] text-left transition-all duration-300 ${
                    item.metadata?.isFailed
                      ? "border-red-900/40 bg-red-950/10 hover:border-red-800/60"
                      : "border-zinc-800 bg-[#09090b]/60 hover:border-zinc-750"
                  }`}
                >
                  {/* Card Header: User details */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleOpenProfile(item.user.id)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black text-cotton shadow-[0_0_15px_rgba(129,1,0,0.1)] hover:scale-105 transition ${
                          item.metadata?.isFailed ? "border-red-750/30 bg-red-950/20" : "border-cherryRed/35 bg-cherryRed/5"
                        }`}
                      >
                        {userInitials}
                      </button>
                      <div>
                        <button
                          onClick={() => handleOpenProfile(item.user.id)}
                          className="text-xs md:text-sm font-black text-cotton hover:text-cherryRed transition block"
                        >
                          {item.user.name}
                        </button>
                        <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider leading-none">
                          {item.user.department}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-semibold text-zinc-500 uppercase block">
                        {timeAgo(item.createdAt)}
                      </span>
                      <span className="text-[9px] font-sans font-bold text-cherryRed uppercase tracking-wider mt-0.5 inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        {item.user.reputationScore ?? 0} Aura
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Mission completion / Reflection details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.metadata?.isFailed ? "bg-red-500 animate-pulse" : "bg-cherryRed animate-pulse"}`} />
                      <h4 className={`text-xs md:text-sm font-black leading-snug ${item.metadata?.isFailed ? "text-red-400" : "text-cotton"}`}>
                        {item.title}
                      </h4>
                    </div>

                    {item.description && (
                      <div className={`relative pl-3.5 border-l-2 py-0.5 ${item.metadata?.isFailed ? "border-red-800/40" : "border-cherryRed/30"}`}>
                        <p className="text-[11px] md:text-xs text-cotton/90 italic leading-relaxed">
                          "{item.description}"
                        </p>
                      </div>
                    )}

                    {/* Screenshot attachment view */}
                    {item.metadata?.screenshot && (
                      <div className="mt-3.5 rounded-xl overflow-hidden border border-white/5 bg-black/40 max-w-sm">
                        <img
                          src={item.metadata.screenshot}
                          alt="Runway Attachment"
                          className="w-full h-auto max-h-60 object-cover"
                        />
                      </div>
                    )}

                    {/* Link attachment view */}
                    {item.metadata?.link && (
                      <div className="mt-2.5">
                        <a
                          href={item.metadata.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[9.5px] font-black text-cherryRed uppercase tracking-wider hover:text-white transition duration-200"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" /> View Project Link
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Metadata stats */}
                  {item.metadata && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 bg-[#1B1716]/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-400">
                        <Clock className="h-3 w-3 text-cherryRed shrink-0" />
                        {item.metadata.sessionDuration} Min Focus
                      </span>
                      
                      {item.metadata.tasksCompleted > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 bg-[#1B1716]/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-400">
                          <CheckCircle2 className="h-3 w-3 text-cotton shrink-0" />
                          {item.metadata.tasksCompleted} Tasks Done
                        </span>
                      )}

                      <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ml-auto ${
                        item.metadata?.isFailed
                          ? "border-red-950 bg-red-950/20 text-red-400"
                          : "border-cherryRed/35 bg-cherryRed/5 text-cherryRed"
                      }`}>
                        {item.metadata?.isFailed ? "CRASHED" : item.metadata.category}
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Load More Button */}
          {nextCursor && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-[#09090b]/50 text-xs font-black uppercase tracking-wider text-cotton/80 hover:text-cotton hover:bg-zinc-850 hover:border-zinc-700 transition"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" /> Loading more runs...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4.5 w-4.5" /> View Older Runways
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Public Profile dialog overlay */}
      {selectedUserId && (
        <PublicProfile
          userId={selectedUserId}
          viewerId={user.id}
          isOpen={profileOpen}
          onClose={() => {
            setProfileOpen(false);
            setSelectedUserId(null);
          }}
          api={api}
        />
      )}
    </div>
  );
}
