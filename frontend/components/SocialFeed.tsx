"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Flame, RefreshCw, Search } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { User, Post } from "../app/types";
import FeedPostCard from "./FeedPostCard";
import PostDetailModal from "./PostDetailModal";
import UserSearchModal from "./UserSearchModal";
import PublicProfile from "./PublicProfile";

interface SocialFeedProps {
  user: User;
  api: (path: string, options?: RequestInit) => Promise<any>;
}

export default function SocialFeed({ user, api }: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<"everyone" | "following" | "college">("everyone");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Detail Modal State
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Search and Profile View states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<number | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Load feed posts
  const loadFeed = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const activeCursor = reset ? null : cursor;
      const cursorParam = activeCursor ? `&cursor=${activeCursor}` : "";
      
      const data = await api(`/posts/feed?userId=${user.id}&filter=${filter}&limit=10${cursorParam}`);
      
      if (reset) {
        setPosts(data.posts || []);
      } else {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
      }

      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch (err) {
      console.error("Error loading feed posts:", err);
      // Fallback mocks on connection fail
      if (reset) {
        setPosts([
          {
            id: 9999,
            userId: 999,
            recapId: 888,
            imageUrl: null,
            caption: "Locked in on the compiler today. Remapped routing tables successfully.",
            visibility: "everyone",
            createdAt: new Date().toISOString(),
            user: {
              id: 999,
              name: "Faheem",
              department: "CSE",
              college: "SRM KTR",
              reputationScore: 190
            },
            recap: {
              id: 888,
              sessionDuration: 45,
              tasksCompleted: 3,
              streak: 4,
              categorySnapshot: "Development",
              missionTitle: "Database Restructure",
              generatedAt: new Date().toISOString()
            },
            commentCount: 2,
            reactionCounts: { "🔥": 3, "💀": 1, "❤️": 2, "🧠": 4 },
            userReactions: { "🔥": true, "💀": false, "❤️": false, "🧠": true }
          }
        ]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed(true);
  }, [filter]);

  // Handle reaction toggle
  const handleReactionToggle = async (postId: number, emoji: "🔥" | "💀" | "❤️" | "🧠") => {
    // Optimistic UI updates
    setPosts((currentPosts) =>
      currentPosts.map((p) => {
        if (p.id !== postId) return p;

        const hasReacted = p.userReactions[emoji];
        const countDiff = hasReacted ? -1 : 1;

        return {
          ...p,
          userReactions: {
            ...p.userReactions,
            [emoji]: !hasReacted
          },
          reactionCounts: {
            ...p.reactionCounts,
            [emoji]: Math.max(0, (p.reactionCounts[emoji] || 0) + countDiff)
          }
        };
      })
    );

    try {
      const data = await api(`/posts/${postId}/react`, {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          emoji,
        }),
      });

      // Update with exact counts from database
      setPosts((currentPosts) =>
        currentPosts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            reactionCounts: data.reactionCounts,
            userReactions: data.userReactions
          };
        })
      );
    } catch (err) {
      console.error("Failed to toggle reaction");
    }
  };

  // Handle delete post
  const handleDeletePost = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await api(`/posts/${postId}?userId=${user.id}`, {
        method: "DELETE"
      });

      // Filter out post locally
      setPosts((current) => current.filter((p) => p.id !== postId));
    } catch (err: any) {
      console.error("Error deleting post:", err);
      alert(err.message || "Failed to delete post.");
    }
  };

  const handleCommentsClick = (post: Post) => {
    setSelectedPostId(post.id);
    setIsDetailOpen(true);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts((current) => current.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Title Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block leading-none mb-1">
            Campus Momentum
          </span>
          <h2 className="text-xl font-display font-black tracking-wide uppercase text-white leading-none">
            Campus Feed
          </h2>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center hover:border-white/[0.12] transition cursor-pointer text-zinc-400 hover:text-white"
            title="Search users"
          >
            <Search size={14} />
          </button>
          <button
            onClick={() => loadFeed(true)}
            disabled={loading}
            className="rounded-full border border-white/5 bg-zinc-950 p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 disabled:opacity-50 transition-colors"
            title="Reload feed"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-cherryRed" : ""} />
          </button>
        </div>
      </div>

      {/* Visibility Filters Pillbar */}
      <div className="px-6 py-2 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0 border-b border-white/[0.04]">
        {[
          { key: "everyone", label: "Everyone" },
          { key: "following", label: "Following" },
          { key: "college", label: "Campus Only" }
        ].map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all duration-150 outline-none border
                ${
                  isActive
                    ? "bg-cherryRed border-cherryRed text-white shadow-[0_0_12px_rgba(139,0,0,0.4)]"
                    : "border-white/[0.06] bg-black/40 text-zinc-500 hover:text-zinc-300 hover:border-white/10"
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Posts Feed Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-none">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-10 w-10 text-cherryRed animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/20 text-zinc-600">
              <Flame size={26} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-500">No Posts Logged</h3>
            <p className="text-xs text-zinc-600 font-semibold max-w-[200px] mt-1 leading-relaxed">
              Posts shared by campus peers will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 sm:max-w-[470px]">
              {posts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  currentUserId={user.id}
                  onReactionToggle={handleReactionToggle}
                  onCommentsClick={handleCommentsClick}
                  onDeletePost={handleDeletePost}
                />
              ))}
            </div>

            {/* Pagination Load More */}
            {hasMore && (
              <div className="pt-2 pb-6 text-center">
                <button
                  onClick={() => loadFeed(false)}
                  disabled={loadingMore}
                  className="rounded-xl border border-white/[0.08] bg-black/40 hover:border-white/20 hover:bg-black/60 px-6 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-cherryRed" />
                      Loading...
                    </>
                  ) : (
                    "Load Older Posts"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Post details comments thread modal popup */}
      {selectedPostId && (
        <PostDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedPostId(null);
          }}
          postId={selectedPostId}
          currentUserId={user.id}
          api={api}
          onReactionToggle={handleReactionToggle}
          onPostUpdated={handlePostUpdated}
        />
      )}

      {/* User search overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <UserSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            currentUserId={user.id}
            api={api}
            onViewProfile={(profileId) => {
              setSelectedProfileUserId(profileId);
              setIsProfileOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Public profile dialog */}
      {selectedProfileUserId && (
        <PublicProfile
          userId={selectedProfileUserId}
          viewerId={user.id}
          isOpen={isProfileOpen}
          onClose={() => {
            setIsProfileOpen(false);
            setSelectedProfileUserId(null);
          }}
          api={api}
        />
      )}
    </div>
  );
}
