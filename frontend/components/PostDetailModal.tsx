"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Post, Comment } from "../app/types";
import FeedPostCard from "./FeedPostCard";

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number;
  currentUserId: number;
  api: (path: string, options?: RequestInit) => Promise<any>;
  onReactionToggle: (postId: number, emoji: "🔥" | "💀" | "❤️" | "🧠") => void;
  onPostUpdated: (updatedPost: Post) => void;
}

export default function PostDetailModal({
  isOpen,
  onClose,
  postId,
  currentUserId,
  api,
  onReactionToggle,
  onPostUpdated
}: PostDetailModalProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch post details & comments
  const loadPostDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api(`/posts/${postId}?userId=${currentUserId}`);
      setPost(data);
      setComments(data.comments || []);
    } catch (err: any) {
      console.error("Error loading post detail:", err);
      setError(err.message || "Failed to load post details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && postId) {
      loadPostDetails();
    }
  }, [isOpen, postId]);

  // Scroll to bottom of comments when comments list changes
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const data = await api(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          userId: currentUserId,
          text: newComment.trim()
        })
      });

      // Append comment
      setComments((prev) => [...prev, data]);
      setNewComment("");

      // Update parent feed post comment count
      if (post) {
        const updated = {
          ...post,
          commentCount: post.commentCount + 1
        };
        setPost(updated);
        onPostUpdated(updated);
      }
    } catch (err: any) {
      console.error("Error adding comment:", err);
      alert(err.message || "Failed to add comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactionLocal = (postId: number, emoji: "🔥" | "💀" | "❤️" | "🧠") => {
    if (!post) return;
    
    // Call parent handler to make request
    onReactionToggle(postId, emoji);

    // Toggle local state
    const hasReacted = post.userReactions[emoji];
    const updatedUserReactions = {
      ...post.userReactions,
      [emoji]: !hasReacted
    };
    const updatedReactionCounts = {
      ...post.reactionCounts,
      [emoji]: post.reactionCounts[emoji] + (hasReacted ? -1 : 1)
    };

    const updatedPost = {
      ...post,
      userReactions: updatedUserReactions,
      reactionCounts: updatedReactionCounts
    };

    setPost(updatedPost);
    onPostUpdated(updatedPost);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      {/* Backdrop Closer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Container */}
      <div className="relative z-10 w-full max-w-[430px] h-[90vh] rounded-[30px] border border-white/[0.08] bg-[#0c0a09] flex flex-col justify-between overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/20 px-6 py-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Post Coordinates</h3>
          <button
            onClick={onClose}
            className="rounded-full border border-white/5 bg-zinc-900 p-2 text-zinc-400 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none pb-24">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 text-cherryRed animate-spin" />
            </div>
          ) : error || !post ? (
            <div className="py-10 text-center text-zinc-500 font-semibold text-xs leading-normal">
              {error || "Could not fetch details."}
            </div>
          ) : (
            <>
              {/* The Post Card Rendered in Full Detail */}
              <FeedPostCard
                post={post}
                currentUserId={currentUserId}
                onReactionToggle={handleReactionLocal}
                onCommentsClick={() => {}} // Disabled inside detail view
              />

              {/* Comments Section Header */}
              <div className="border-t border-white/[0.06] pt-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
                  Peer Comments ({comments.length})
                </h4>

                {/* Comments List */}
                {comments.length === 0 ? (
                  <p className="text-[10.5px] text-zinc-600 font-bold uppercase tracking-wide py-4 text-center">
                    No comments yet. Start the discussion.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => {
                      const commInitials = comment.user?.name
                        ? comment.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "??";

                      const commentDate = new Date(comment.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      });

                      return (
                        <div key={comment.id} className="flex items-start gap-3 text-left">
                          {/* Comm Avatar */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/[0.06] bg-white/[0.02] text-[10px] font-black text-white">
                            {commInitials}
                          </div>
                          {/* Comm Bubble */}
                          <div className="flex-1 min-w-0 rounded-2xl border border-white/[0.04] bg-white/[0.015] p-3">
                            <div className="flex items-baseline justify-between mb-1 gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white truncate max-w-[150px]">
                                {comment.user?.name || "Student"}
                              </span>
                              <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest shrink-0">
                                {commentDate}
                              </span>
                            </div>
                            {comment.user?.department && (
                              <p className="text-[8px] text-zinc-500 font-semibold uppercase leading-none mb-1.5 truncate">
                                {comment.user.department}
                              </p>
                            )}
                            <p className="text-xs text-cotton/90 leading-relaxed font-semibold break-words">
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sticky Comment Entry bar */}
        {post && !loading && (
          <form
            onSubmit={handleSendComment}
            className="absolute bottom-0 inset-x-0 border-t border-white/[0.08] bg-[#0c0a09]/92 backdrop-blur-xl px-5 py-4 flex items-center gap-3 z-20"
          >
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value.slice(0, 300))}
              placeholder="Add a comment..."
              className="flex-1 rounded-xl border border-white/[0.06] bg-black/40 px-4 py-2.5 text-xs font-semibold text-cotton placeholder-zinc-600 focus:border-cherryRed focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cherryRed text-white transition hover:bg-red-800 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
