"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Globe, Users, UserCheck, Trash2, X } from "lucide-react";
import { Post } from "../app/types";

interface FeedPostCardProps {
  post: Post;
  currentUserId: number;
  onReactionToggle: (postId: number, emoji: "🔥" | "💀" | "❤️" | "🧠") => void;
  onCommentsClick: (post: Post) => void;
  onDeletePost?: (postId: number) => void;
}

/* ────────────────── Image Grid (LinkedIn-style) ────────────────── */

function ImageGrid({ images }: { images: string[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const count = images.length;

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);

  return (
    <>
      <div className="w-full border-b border-white/[0.06] overflow-hidden aspect-[4/5]">
        {count === 1 && (
          <button onClick={() => openLightbox(0)} className="w-full h-full block cursor-pointer overflow-hidden">
            <img
              src={images[0]}
              alt="Post image"
              className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
            />
          </button>
        )}

        {count === 2 && (
          <div className="grid grid-cols-2 gap-[2px] h-full">
            {images.map((img, i) => (
              <button key={i} onClick={() => openLightbox(i)} className="block cursor-pointer overflow-hidden h-full">
                <img
                  src={img}
                  alt={`Post image ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                />
              </button>
            ))}
          </div>
        )}

        {count === 3 && (
          <div className="grid gap-[2px] h-full" style={{ gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr" }}>
            <button onClick={() => openLightbox(0)} className="row-span-2 block cursor-pointer overflow-hidden">
              <img
                src={images[0]}
                alt="Post image 1"
                className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
              />
            </button>
            <button onClick={() => openLightbox(1)} className="block cursor-pointer overflow-hidden">
              <img
                src={images[1]}
                alt="Post image 2"
                className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
              />
            </button>
            <button onClick={() => openLightbox(2)} className="block cursor-pointer overflow-hidden">
              <img
                src={images[2]}
                alt="Post image 3"
                className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
              />
            </button>
          </div>
        )}

        {count >= 4 && (
          <div className="grid grid-cols-2 gap-[2px] h-full">
            {images.slice(0, 4).map((img, i) => (
              <button
                key={i}
                onClick={() => openLightbox(i)}
                className="relative block cursor-pointer overflow-hidden"
              >
                <img
                  src={img}
                  alt={`Post image ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                />
                {i === 3 && count > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-2xl font-black text-white">+{count - 4}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Overlay */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2.5 rounded-full border border-white/10 bg-zinc-900/80 text-zinc-400 hover:text-white transition z-10"
          >
            <X size={18} />
          </button>

          {/* Navigation dots */}
          {count > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === lightboxIdx ? "bg-white scale-125" : "bg-zinc-600 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
          )}

          <img
            src={images[lightboxIdx]}
            alt="Full size"
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Prev / Next arrows */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-white transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {lightboxIdx < count - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 border border-white/10 text-zinc-400 hover:text-white transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* ────────────────── Feed Post Card ────────────────── */

export default function FeedPostCard({
  post,
  currentUserId,
  onReactionToggle,
  onCommentsClick,
  onDeletePost
}: FeedPostCardProps) {
  const {
    id,
    userId,
    imageUrl,
    imageUrls,
    caption,
    visibility,
    createdAt,
    user,
    recap,
    commentCount,
    reactionCounts,
    userReactions
  } = post;

  const isOwner = userId === currentUserId;

  // Resolve images: prefer imageUrls array, fallback to single imageUrl
  const images: string[] = (() => {
    if (imageUrls && imageUrls.length > 0) return imageUrls;
    if (imageUrl) return [imageUrl];
    return [];
  })();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }) + ", " + new Date(createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const displayDate = formattedDate.toUpperCase();

  const getVisibilityIcon = () => {
    switch (visibility) {
      case "everyone":
        return <Globe size={11} className="text-zinc-600" />;
      case "followers":
        return <Users size={11} className="text-zinc-600" />;
      case "college":
        return <UserCheck size={11} className="text-zinc-600" />;
      default:
        return <Globe size={11} className="text-zinc-600" />;
    }
  };

  // Stat Card fields
  const missionTitle = recap?.missionTitle || "Focus Session";
  const duration = recap?.sessionDuration || 25;
  const category = recap?.categorySnapshot || "Development";
  const tasksCompleted = recap?.tasksCompleted || 0;
  const streak = recap?.streak || 0;

  // List of reactions
  const reactionList = [
    { emoji: "🔥" as const, label: "Fire" },
    { emoji: "💀" as const, label: "Skull" },
    { emoji: "❤️" as const, label: "Heart" },
    { emoji: "🧠" as const, label: "Brain" }
  ];

  return (
    <div className="relative bg-zinc-950 border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/[0.14] transition-colors duration-200 text-left w-full flex flex-col">
      {/* Section 1 — Header */}
      <div className="flex items-center px-4 pt-4 pb-3">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || "User"}
              className="w-9 h-9 rounded-full object-cover border border-[#8B0000]/50 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-[#8B0000]/50 text-[11px] font-black text-[#8B0000] flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-black text-white uppercase tracking-wide truncate">
              {user?.name || "Unknown"}
            </h4>
            <p className="text-[10px] text-zinc-500 font-bold truncate leading-none mt-0.5">
              {user?.department || "Student"} &middot; {user?.college || "Campus"}
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
            {displayDate}
          </span>
          <div className="flex items-center gap-1.5">
            {getVisibilityIcon()}
            {isOwner && onDeletePost && (
              <button
                onClick={() => onDeletePost(id)}
                className="text-zinc-600 hover:text-[#8B0000] transition-colors"
                title="Delete post"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2 — Image Grid (LinkedIn-style) */}
      <ImageGrid images={images} />

      {/* Section 3 — Stat mini-card */}
      {recap && (
        <div className="relative bg-black border border-white/[0.08] rounded-xl p-4 mx-4 mt-4 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#8B0000] rounded-l-xl" />
          <div className="pl-2 flex justify-between items-center w-full">
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8B0000]">
                FOCUS RECAP VERIFIED
              </span>
              <h4 className="text-sm font-black text-white uppercase tracking-wide truncate max-w-[180px] mt-1.5">
                {missionTitle}
              </h4>
              <p className="text-[11px] font-bold text-zinc-500 uppercase mt-1">
                {duration} MINUTES &middot; {category}
              </p>
            </div>
            <div className="flex gap-4 shrink-0 text-right">
              <div>
                <span className="block text-[8px] font-black text-zinc-600 uppercase tracking-wider">TASKS</span>
                <span className="text-[12px] font-black text-white">{tasksCompleted} Done</span>
              </div>
              <div>
                <span className="block text-[8px] font-black text-zinc-600 uppercase tracking-wider">STREAK</span>
                <span className="text-[12px] font-black text-white">{streak} days</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4 — Caption */}
      {caption && (
        <p className="px-4 mt-3 text-sm font-bold text-zinc-300 leading-relaxed">
          {caption}
        </p>
      )}

      {/* Section 5 — Reactions + Comments row */}
      <div className="px-4 mt-3 pb-4 flex items-center justify-between">
        {/* Reactions left side */}
        <div className="flex flex-wrap gap-2">
          {reactionList.map(({ emoji, label }) => {
            const count = reactionCounts?.[emoji] ?? 0;
            const hasReacted = userReactions?.[emoji] ?? false;
            const isFaded = count === 0 && !hasReacted;

            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReactionToggle(id, emoji)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-black border transition-all duration-150 outline-none select-none
                  ${isFaded ? "opacity-40" : ""}
                  ${
                    hasReacted
                      ? "bg-[#8B0000]/20 border-[#8B0000]/50 text-white"
                      : "bg-zinc-900 border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white"
                  }
                `}
                title={`${label} reaction`}
              >
                <span className="text-xs leading-none">{emoji}</span>
                <motion.span
                  key={`${emoji}-${count}`}
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.15 }}
                  className="text-[10px] font-black tracking-wider leading-none"
                >
                  {count}
                </motion.span>
              </button>
            );
          })}
        </div>

        {/* Comments right side */}
        <div
          onClick={() => onCommentsClick(post)}
          className="ml-auto flex items-center gap-1.5 cursor-pointer group"
        >
          <MessageSquare size={13} className="text-zinc-600 group-hover:text-white transition" />
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-white transition">
            {commentCount} COMMENTS
          </span>
          {commentCount > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B0000] ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}
