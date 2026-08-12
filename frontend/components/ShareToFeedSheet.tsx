"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Image as ImageIcon, Globe, Users, School, Loader2, Check, Plus } from "lucide-react";
import { uploadImage } from "../lib/supabase";
import { api } from "../lib/api";

interface ShareToFeedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recapId?: number;
  recapData?: any;
  preGeneratedCardImage?: string | null;
}

const MAX_IMAGES = 4;

export default function ShareToFeedSheet({ isOpen, onClose, recapId, recapData, preGeneratedCardImage }: ShareToFeedSheetProps) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"college" | "followers" | "everyone">("everyone");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (preGeneratedCardImage) {
        setImagePreviews([preGeneratedCardImage]);
        setImageFiles([null]); // null = base64 data URL, not a File
      } else {
        setImagePreviews([]);
        setImageFiles([]);
      }
    }
  }, [preGeneratedCardImage, isOpen]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (files: File[]) => {
    const remaining = MAX_IMAGES - imagePreviews.length;
    const validFiles = files.filter(f => f.type.startsWith("image/")).slice(0, remaining);

    if (validFiles.length === 0 && files.length > 0) {
      setError("Only image files are allowed.");
      return;
    }

    const newPreviews: string[] = [];
    const newFiles: (File | null)[] = [];

    validFiles.forEach(file => {
      newPreviews.push(URL.createObjectURL(file));
      newFiles.push(file);
    });

    setImagePreviews(prev => [...prev, ...newPreviews]);
    setImageFiles(prev => [...prev, ...newFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const userId = localStorage.getItem("lockin_user_id");
    if (!userId) {
      setError("User session not found.");
      setSubmitting(false);
      return;
    }

    try {
      // Upload all images
      const uploadedUrls: string[] = [];

      for (let i = 0; i < imagePreviews.length; i++) {
        const file = imageFiles[i];
        const preview = imagePreviews[i];

        if (file) {
          // It's a real File object
          const url = await uploadImage(file);
          uploadedUrls.push(url);
        } else if (preview && preview.startsWith("data:")) {
          // It's a base64 data URL (e.g. recap card capture)
          const url = await uploadImage(preview);
          uploadedUrls.push(url);
        } else if (preview) {
          // Already a URL
          uploadedUrls.push(preview);
        }
      }

      // Fallback: carry over screenshot from recap card
      if (uploadedUrls.length === 0 && recapData?.metadata?.screenshot) {
        uploadedUrls.push(recapData.metadata.screenshot);
      }

      // Submit post to backend (api() attaches Supabase Bearer token)
      await api("/posts", {
        method: "POST",
        body: JSON.stringify({
          userId: Number(userId),
          recapId: recapId ? Number(recapId) : null,
          imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          caption: caption.trim() || null,
          visibility,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCaption("");
        setImagePreviews([]);
        setImageFiles([]);
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canAddMore = imagePreviews.length < MAX_IMAGES;

  return (
    <AnimatePresence>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/75 backdrop-blur-sm"
      >
        {/* Backdrop Closer */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Sliding Panel */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative z-10 w-full max-w-[430px] rounded-t-[32px] border-t border-white/[0.08] bg-[#0c0a09] px-6 pb-10 pt-5 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto"
        >
          {/* Handlebar */}
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-700" />

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-black tracking-wide uppercase">Post to Campus Feed</h3>
            <button
              onClick={onClose}
              className="rounded-full border border-white/5 bg-zinc-900 p-2 text-zinc-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Check size={28} />
              </div>
              <h4 className="text-base font-black uppercase tracking-wider text-emerald-400">Successfully Shared</h4>
              <p className="text-xs text-zinc-500 font-semibold mt-1">Your session is live on the campus feed.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Session Snapshot Mini Card */}
              {recapData && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left">
                  <span className="text-[9px] font-black uppercase tracking-wider text-cherryRed">
                    Attaching Focus Card
                  </span>
                  <div className="mt-1 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black uppercase truncate text-white max-w-[200px]">
                        {recapData.missionTitle || recapData.missionName || "Focus Session"}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-semibold uppercase mt-0.5">
                        {recapData.sessionDuration || 25} minutes &bull; {recapData.categorySnapshot || "Other"}
                      </p>
                    </div>
                    <span className="text-xs font-black text-white/90">
                      Rank #{recapData.missionRank || recapData.rank || 1}
                    </span>
                  </div>
                </div>
              )}

              {/* Caption Entry */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Caption</label>
                <div className="relative">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, 300))}
                    placeholder="Write a reflection or share your progress..."
                    rows={3}
                    className="w-full rounded-xl border border-white/[0.06] bg-black/40 px-3.5 py-3 text-xs font-semibold text-cotton placeholder-zinc-600 focus:border-cherryRed focus:outline-none resize-none transition-colors"
                  />
                  <span className="absolute bottom-2.5 right-3 text-[9px] font-black tracking-wider text-zinc-600">
                    {caption.length}/300
                  </span>
                </div>
              </div>

              {/* Image Previews Row + Add More */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Images ({imagePreviews.length}/{MAX_IMAGES})
                </label>

                {imagePreviews.length > 0 ? (
                  <div className="space-y-2.5">
                    {/* Thumbnail Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {imagePreviews.map((preview, idx) => (
                        <div
                          key={idx}
                          className="relative rounded-xl border border-white/[0.08] bg-black/40 overflow-hidden aspect-square group"
                        >
                          <img
                            src={preview}
                            alt={`Upload ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 rounded-full bg-black/80 border border-white/10 p-1 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                          {idx === 0 && preGeneratedCardImage && (
                            <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[7px] font-black text-center text-cherryRed uppercase tracking-wider py-0.5">
                              Recap
                            </span>
                          )}
                        </div>
                      ))}

                      {/* Add More Button */}
                      {canAddMore && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl border border-dashed border-white/[0.12] bg-black/20 aspect-square flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 hover:border-white/20 hover:bg-black/35 transition-all"
                        >
                          <Plus size={16} />
                          <span className="text-[8px] font-black uppercase tracking-wider">Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center cursor-pointer transition-all duration-200
                      ${dragActive
                        ? "border-cherryRed bg-cherryRed/5"
                        : "border-white/[0.08] bg-black/20 hover:border-white/20 hover:bg-black/35"
                      }
                    `}
                  >
                    <ImageIcon className="mb-2.5 h-6 w-6 text-zinc-500" />
                    <p className="text-[11px] font-bold text-zinc-400">
                      Drag & drop images or <span className="text-cherryRed">browse files</span>
                    </p>
                    <p className="text-[9px] text-zinc-600 font-semibold mt-1">PNG, JPG up to 10MB &bull; Max {MAX_IMAGES} images</p>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>

              {/* Visibility Options */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Audience Visibility</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "everyone", label: "Everyone", icon: Globe },
                    { key: "followers", label: "Following", icon: Users },
                    { key: "college", label: "Campus Only", icon: School },
                  ].map((option) => {
                    const isSelected = visibility === option.key;
                    const Icon = option.icon;
                    return (
                      <button
                        type="button"
                        key={option.key}
                        onClick={() => setVisibility(option.key as any)}
                        className={`flex flex-col items-center justify-center rounded-xl border py-2.5 gap-1.5 transition-all outline-none
                          ${isSelected
                            ? "border-cherryRed bg-cherryRed/10 text-white"
                            : "border-white/[0.06] bg-black/40 text-zinc-500 hover:text-zinc-300 hover:border-white/10"
                          }
                        `}
                      >
                        <Icon size={14} className={isSelected ? "text-cherryRed" : ""} />
                        <span className="text-[9px] font-black uppercase tracking-wider leading-none">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-[10px] font-bold text-cherryRed bg-cherryRed/5 border border-cherryRed/10 rounded-lg p-2.5 text-left leading-normal">
                  {error}
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-cherryRed py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Share Now"
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
