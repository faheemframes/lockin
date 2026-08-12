"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { User, Mission } from "../app/types";
import HeatMap from "./HeatMap";
import FollowListModal from "./FollowListModal";
import { 
  Flame, 
  MapPin, 
  Instagram, 
  Github, 
  Sparkles, 
  Activity, 
  Trophy, 
  UserPlus, 
  UserMinus, 
  Zap, 
  Clock, 
  CheckCircle2, 
  Calendar,
  ListTodo
} from "lucide-react";

interface PublicProfileProps {
  userId: number;
  viewerId: number;
  isOpen: boolean;
  onClose: () => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
}

export default function PublicProfile({ userId, viewerId, isOpen, onClose, api }: PublicProfileProps) {
  const [profileData, setProfileData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [isFollowListOpen, setIsFollowListOpen] = useState(false);
  const [followListInitialTab, setFollowListInitialTab] = useState<"followers" | "following">("followers");
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<number | null>(null);
  const [isNestedProfileOpen, setIsNestedProfileOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;

    async function fetchPublicProfile() {
      setLoading(true);
      setError("");
      try {
        const data = await api(`/users/${userId}/public?viewerId=${viewerId}`);
        setProfileData(data);
      } catch (err: any) {
        console.error("Error fetching public profile:", err);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProfile();
  }, [userId, viewerId, isOpen]);

  const handleFollowAction = async () => {
    if (!profileData || actionLoading) return;
    setActionLoading(true);
    const isFollowing = profileData.isFollowing;

    try {
      if (isFollowing) {
        // Unfollow
        await api(`/follow?followerId=${viewerId}&followingId=${userId}`, {
          method: "DELETE",
        });
        setProfileData((prev: any) => ({
          ...prev,
          isFollowing: false,
          followersCount: Math.max(0, prev.followersCount - 1),
        }));
      } else {
        // Follow
        await api("/follow", {
          method: "POST",
          body: JSON.stringify({ followerId: viewerId, followingId: userId }),
        });
        setProfileData((prev: any) => ({
          ...prev,
          isFollowing: true,
          followersCount: prev.followersCount + 1,
        }));
      }
    } catch (err: any) {
      alert(err.message || "Failed to update follow status.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md md:max-w-2xl bg-noirBlack border border-cherryRed/20 p-4 md:p-6 overflow-y-auto max-h-[90vh] scrollbar-none text-cotton">
        <DialogHeader className="border-b border-white/5 pb-3">
          <DialogTitle className="text-sm font-black uppercase tracking-wider text-cherryRed flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Profile Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Activity className="h-8 w-8 text-cherryRed animate-spin" />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
              Locking into profile data...
            </p>
          </div>
        ) : error || !profileData ? (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-cherryRed uppercase tracking-wider">{error || "User not found."}</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Hero Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3.5">
                {profileData.user.avatar_url ? (
                  <img
                    src={profileData.user.avatar_url}
                    alt={profileData.user.name || "User"}
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover border border-cherryRed/35 bg-cherryRed/5 shadow-[0_0_24px_rgba(129,1,0,0.15)]"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cherryRed/35 bg-cherryRed/5 text-lg font-black text-cotton shadow-[0_0_24px_rgba(129,1,0,0.15)]">
                    {profileData.user.name ? profileData.user.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() : "??"}
                  </div>
                )}
                <div className="text-left">
                  <h2 className="text-base md:text-xl font-black text-cotton leading-tight">
                    {profileData.user.name}
                  </h2>
                  <p className="text-[11px] md:text-xs text-zinc-500 font-semibold mt-0.5">
                    {profileData.user.department}
                  </p>
                  {profileData.user.bio && (
                    <p className="text-[11px] md:text-xs text-cotton/80 mt-1.5 max-w-sm leading-relaxed">
                      {profileData.user.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Follow count & action */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex gap-2.5 text-[10px] font-bold text-zinc-500 bg-noirBlack/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <div
                    onClick={() => {
                      setFollowListInitialTab("followers");
                      setIsFollowListOpen(true);
                    }}
                    className="cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="text-cotton font-black mr-0.5">{profileData.followersCount}</span> Followers
                  </div>
                  <div className="w-px bg-white/10" />
                  <div
                    onClick={() => {
                      setFollowListInitialTab("following");
                      setIsFollowListOpen(true);
                    }}
                    className="cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="text-cotton font-black mr-0.5">{profileData.followingCount}</span> Following
                  </div>
                </div>

                {viewerId !== profileData.user.id && (
                  <button
                    onClick={handleFollowAction}
                    disabled={actionLoading}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black uppercase tracking-wider transition active:scale-[0.98] ${
                      profileData.isFollowing
                        ? "border border-cherryRed/35 bg-cherryRed/5 text-cherryRed hover:bg-cherryRed/10"
                        : "bg-cherryRed text-cotton hover:bg-cherryRed/95 shadow-[0_0_15px_rgba(129,1,0,0.15)]"
                    }`}
                  >
                    {profileData.isFollowing ? (
                      <>
                        <UserMinus className="h-3.5 w-3.5" /> Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" /> Follow
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Badges / Links */}
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-lg border border-cherryRed/25 bg-cherryRed/5 px-2.5 py-1 text-[10px] font-sans font-semibold text-cherryRed uppercase tracking-wider">
                <img src="/aura-bolt.png" alt="Aura" className="h-3.5 w-3.5 object-contain shrink-0" />
                {profileData.user.reputation_score ?? 0} Aura
              </span>
              {profileData.user.college && (
                <span className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 py-1 text-[10px] font-semibold text-zinc-500">
                  <MapPin className="h-3 w-3" />
                  {profileData.user.college}
                </span>
              )}
              {profileData.user.interests && (
                <span className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 py-1 text-[10px] font-semibold text-zinc-500">
                  {profileData.user.interests}
                </span>
              )}
              {(profileData.user.instagram || profileData.user.github) && (
                <div className="flex gap-2.5 ml-auto">
                  {profileData.user.instagram && (
                    <a
                      href={`https://instagram.com/${profileData.user.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center h-7 w-7 rounded-lg border border-white/5 bg-noirBlack/40 text-zinc-500 hover:text-white transition"
                    >
                      <Instagram className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {profileData.user.github && (
                    <a
                      href={`https://github.com/${profileData.user.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center h-7 w-7 rounded-lg border border-white/5 bg-noirBlack/40 text-zinc-500 hover:text-white transition"
                    >
                      <Github className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Grid Layout for Stats & Heatmap */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stats column */}
              <div className="md:col-span-1 space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-500 text-left">
                  Execution Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5">
                  {[
                    { label: "Missions Completed", value: profileData.stats.totalMissions, icon: Flame, color: "text-cherryRed" },
                    { label: "Focus Hours", value: `${profileData.stats.focusHours}h`, icon: Clock, color: "text-cotton" },
                    { label: "Completion Rate", value: `${profileData.stats.completionRate}%`, icon: CheckCircle2, color: "text-cotton" },
                    { label: "Current Streak", value: `${profileData.stats.currentStreak}d`, icon: Zap, color: "text-cherryRed" },
                    { label: "Tasks Finished", value: profileData.stats.tasksCompleted, icon: ListTodo, color: "text-cotton" },
                    { label: "Active Days", value: profileData.stats.activeDays, icon: Calendar, color: "text-cotton" },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-xl border border-cherryRed/10 bg-noirBlack/40 p-3 flex flex-col justify-between space-y-1.5 text-left">
                        <div className="flex justify-between items-start">
                          <span className="text-[8px] font-black uppercase tracking-wider text-zinc-600 leading-none">{stat.label}</span>
                          <Icon className={`h-3 w-3 ${stat.color} shrink-0`} />
                        </div>
                        <span className="text-sm font-black text-cotton leading-none">{stat.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Heatmap column */}
              <div className="md:col-span-2 space-y-4">
                <HeatMap userId={userId} userJoinedAt={profileData?.user?.verified_at} api={api} />

                {/* Recent Activities */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-500 text-left">
                    Recent Runway Runways
                  </h3>
                  {profileData.feedItems && profileData.feedItems.length > 0 ? (
                    <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cherryRed/20 text-left">
                      {profileData.feedItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-cherryRed/10 bg-noirBlack/20 p-3 space-y-1.5"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-cotton">{item.title}</span>
                            <span className="text-[8px] font-semibold text-zinc-600">
                              {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-cotton/80 italic leading-relaxed">
                              "{item.description}"
                            </p>
                          )}
                          {item.metadata && (
                            <div className="flex gap-2 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                              <span>{item.metadata.sessionDuration}m</span>
                              <span>•</span>
                              <span>{item.metadata.tasksCompleted || 0} Tasks</span>
                              <span>•</span>
                              <span className="text-cherryRed">{item.metadata.category}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-semibold text-zinc-600 text-center py-4">
                      No recent runway sessions found.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Followers & Following listing modal */}
            <FollowListModal
              isOpen={isFollowListOpen}
              onClose={() => setIsFollowListOpen(false)}
              userId={userId}
              initialTab={followListInitialTab}
              onViewProfile={(profileId) => {
                setSelectedProfileUserId(profileId);
                setIsNestedProfileOpen(true);
              }}
              api={api}
            />

            {/* Nested Public Profile overlay */}
            {selectedProfileUserId && (
              <PublicProfile
                userId={selectedProfileUserId}
                viewerId={viewerId}
                isOpen={isNestedProfileOpen}
                onClose={() => {
                  setIsNestedProfileOpen(false);
                  setSelectedProfileUserId(null);
                }}
                api={api}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
