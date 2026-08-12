"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { Download, Share2, Check, Flame, Clock, Award, HelpCircle, BookOpen, Quote, Trash2, X } from "lucide-react";
import { toPng } from "html-to-image";
import ShareToFeedSheet from "./ShareToFeedSheet";

interface RecapProps {
  isOpen: boolean;
  onClose: () => void;
  recapData: {
    id?: number;
    recapType?: string;
    shareId?: string;
    sessionDuration?: number;
    tasksCompleted?: number;
    topCategory?: string;
    categorySnapshot?: string;
    missionTitle?: string;
    missionName?: string;
    streak?: number;
    currentStreak?: number;
    rank?: number;
    missionRank?: number;
    missionsCompleted?: number;
    longestSession?: number;
    generatedAt?: string;
    reflectionText?: string;
    lessonsLearned?: string;
    metadata?: {
      isFailed?: boolean;
      screenshot?: string | null;
      link?: string | null;
      [key: string]: any;
    };
  };
}

const SHARDS = [
  { clip: "polygon(0% 0%, 50% 0%, 25% 35%, 0% 25%)", tx: -200, ty: -200, r: -180 },
  { clip: "polygon(50% 0%, 100% 0%, 75% 30%, 25% 35%)", tx: 150, ty: -240, r: 160 },
  { clip: "polygon(0% 25%, 25% 35%, 15% 60%, 0% 60%)", tx: -250, ty: -40, r: -110 },
  { clip: "polygon(25% 35%, 75% 30%, 60% 65%, 15% 60%)", tx: 40, ty: 140, r: 280 },
  { clip: "polygon(75% 30%, 100% 0%, 100% 50%, 60% 65%)", tx: 250, ty: -90, r: 210 },
  { clip: "polygon(0% 60%, 15% 60%, 35% 100%, 0% 100%)", tx: -180, ty: 250, r: -220 },
  { clip: "polygon(15% 60%, 60% 65%, 75% 100%, 35% 100%)", tx: -30, ty: 320, r: 420 },
  { clip: "polygon(60% 65%, 100% 50%, 100% 100%, 75% 100%)", tx: 200, ty: 220, r: 230 },
];

export default function LockinRecapCard({
  isOpen,
  onClose,
  recapData,
}: RecapProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTrashing, setIsTrashing] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [cardImage, setCardImage] = useState<string | null>(null);

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
  const glareBackgroundFront = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.22) 10%, rgba(255, 255, 255, 0.08) 30%, rgba(255, 255, 255, 0) 80%)`;
  const glareBackgroundBack = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.18) 10%, rgba(255, 255, 255, 0.06) 30%, rgba(255, 255, 255, 0) 80%)`;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
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

  const {
    recapType = "session",
    sessionDuration = 0,
    tasksCompleted = 0,
    generatedAt,
    reflectionText,
    lessonsLearned,
  } = recapData;

  const isFailed = recapData.metadata?.isFailed || false;
  const screenshot = recapData.metadata?.screenshot || null;
  const link = recapData.metadata?.link || null;

  useEffect(() => {
    if (isOpen) {
      setIsTrashing(false);
    }
  }, [isOpen]);

  const streakVal = recapData.streak !== undefined ? recapData.streak : (recapData.currentStreak !== undefined ? recapData.currentStreak : 0);
  const categoryVal = recapData.categorySnapshot || recapData.topCategory || "None";

  const isPeriod = recapType !== "session";

  let statusText = isFailed ? "RUNWAY CRASHED" : "LOCKED IN";
  let subtitleText = recapData.missionTitle || recapData.missionName || "Focus Session";

  if (isFailed) {
    statusText = "RUNWAY CRASHED";
  } else if (isPeriod) {
    if (recapType === "weekly") {
      statusText = "WEEKLY WRAPPED";
      subtitleText = "Weekly Progress Run";
    } else if (recapType === "monthly") {
      statusText = "MONTHLY WRAPPED";
      subtitleText = "Monthly Progress Run";
    } else if (recapType === "yearly") {
      statusText = "YEARLY WRAPPED";
      subtitleText = "Yearly Progress Run";
    } else if (recapType === "team") {
      statusText = "TEAM WRAPPED";
      subtitleText = "Team Progress Run";
    }
  }

  const hours = Math.floor(sessionDuration / 60);
  const mins = sessionDuration % 60;

  const longestDuration = isPeriod ? (recapData.longestSession ?? 0) : sessionDuration;
  const longestHrs = Math.floor(longestDuration / 60);
  const longestMins = longestDuration % 60;
  const longestLockText = `${longestHrs}h ${longestMins}m`;

  const date = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    : new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // Calculate tier details
  let tier = "bronze";
  let tierName = "Bronze";
  let tierColor = "#A8705C"; // Bronze/Copper
  let cardBg = "radial-gradient(circle at 50% 30%, #291a14 0%, #0d0806 100%)";
  let accentColor = "text-[#A8705C]";
  let borderStyle = "border-[#A8705C]/35";
  let glowColor = "rgba(168, 112, 92, 0.12)";
  let badgeBg = "bg-[#A8705C]/10 border-[#A8705C]/30 text-[#E6C3B3]";

  if (isFailed) {
    tier = "crashed";
    tierName = "Crashed";
    tierColor = "#DE211E"; // Red
    cardBg = "radial-gradient(circle at 50% 30%, #1a0303 0%, #080000 100%)";
    accentColor = "text-[#DE211E]";
    borderStyle = "border-[#DE211E]/40";
    glowColor = "rgba(222, 33, 30, 0.2)";
    badgeBg = "bg-[#DE211E]/10 border-[#DE211E]/30 text-[#EDEBDE]";
  } else if (recapType === "session") {
    if (sessionDuration >= 120) {
      tier = "legendary";
      tierName = "Legendary Red";
      tierColor = "#DE211E"; // Red
      cardBg = "radial-gradient(circle at 50% 30%, #300c0a 0%, #0d0302 100%)";
      accentColor = "text-[#DE211E]";
      borderStyle = "border-[#DE211E]/40";
      glowColor = "rgba(222, 33, 30, 0.25)";
      badgeBg = "bg-[#DE211E]/10 border-[#DE211E]/30 text-[#EDEBDE]";
    } else if (sessionDuration >= 60) {
      tier = "gold";
      tierName = "Gold";
      tierColor = "#C5A880"; // Gold
      cardBg = "radial-gradient(circle at 50% 30%, #261e13 0%, #0d0a06 100%)";
      accentColor = "text-[#C5A880]";
      borderStyle = "border-[#C5A880]/35";
      glowColor = "rgba(197, 168, 128, 0.22)";
      badgeBg = "bg-[#C5A880]/15 border-[#C5A880]/30 text-[#F3E5AB]";
    } else if (sessionDuration >= 30) {
      tier = "silver";
      tierName = "Silver";
      tierColor = "#A8B2C1"; // Silver
      cardBg = "radial-gradient(circle at 50% 30%, #202226 0%, #0b0c0d 100%)";
      accentColor = "text-[#A8B2C1]";
      borderStyle = "border-[#A8B2C1]/30";
      glowColor = "rgba(168, 178, 193, 0.15)";
      badgeBg = "bg-[#A8B2C1]/10 border-[#A8B2C1]/25 text-[#F5F5F5]";
    }
  } else {
    // Wrapped types logic
    if (recapType === "weekly") {
      const focusHrs = sessionDuration / 60;
      if (focusHrs >= 10) {
        tier = "gold";
        tierName = "Gold";
        tierColor = "#C5A880";
        cardBg = "radial-gradient(circle at 50% 30%, #261e13 0%, #0d0a06 100%)";
        accentColor = "text-[#C5A880]";
        borderStyle = "border-[#C5A880]/35";
        glowColor = "rgba(197, 168, 128, 0.22)";
        badgeBg = "bg-[#C5A880]/15 border-[#C5A880]/30 text-[#F3E5AB]";
      } else {
        tier = "silver";
        tierName = "Silver";
        tierColor = "#A8B2C1";
        cardBg = "radial-gradient(circle at 50% 30%, #202226 0%, #0b0c0d 100%)";
        accentColor = "text-[#A8B2C1]";
        borderStyle = "border-[#A8B2C1]/30";
        glowColor = "rgba(168, 178, 193, 0.15)";
        badgeBg = "bg-[#A8B2C1]/10 border-[#A8B2C1]/25 text-[#F5F5F5]";
      }
    } else if (recapType === "monthly") {
      tier = "gold";
      tierName = "Gold";
      tierColor = "#C5A880";
      cardBg = "radial-gradient(circle at 50% 30%, #261e13 0%, #0d0a06 100%)";
      accentColor = "text-[#C5A880]";
      borderStyle = "border-[#C5A880]/35";
      glowColor = "rgba(197, 168, 128, 0.22)";
      badgeBg = "bg-[#C5A880]/15 border-[#C5A880]/30 text-[#F3E5AB]";
    } else {
      // yearly or team
      tier = "legendary";
      tierName = "Legendary Red";
      tierColor = "#DE211E";
      cardBg = "radial-gradient(circle at 50% 30%, #300c0a 0%, #0d0302 100%)";
      accentColor = "text-[#DE211E]";
      borderStyle = "border-[#DE211E]/40";
      glowColor = "rgba(222, 33, 30, 0.25)";
      badgeBg = "bg-[#DE211E]/10 border-[#DE211E]/30 text-[#EDEBDE]";
    }
  }

  // Handle export (we force capturing the Front card flat)
  const handleSave = useCallback(async () => {
    if (!cardRef.current || saving) return;

    try {
      setSaving(true);
      // Temporarily ensure card is facing front for image export
      const wasFlipped = isFlipped;
      if (wasFlipped) {
        setIsFlipped(false);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2.2,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `lockin-recap-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      // Restore flip state
      if (wasFlipped) {
        setIsFlipped(true);
      }
    } catch (err: any) {
      console.error("Failed to export card image:", err);
      alert(err.message || "Failed to export PNG image of the recap. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, isFlipped]);

  const handleShare = useCallback(async () => {
    if (!recapData.shareId) {
      alert("No share coordinates generated for this card.");
      return;
    }

    const shareUrl = `${window.location.origin}/recap/${recapData.shareId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "LOCKIN Recap",
          text: `Check out my Lockin productivity recap! I locked in for ${hours}h ${mins}m.`,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert(`Here is your share link: ${shareUrl}`);
    }
  }, [recapData.shareId, hours, mins]);
  
  const handlePostToFeedClick = async () => {
    if (!cardRef.current || generatingImage) return;

    try {
      setGeneratingImage(true);
      
      const wasFlipped = isFlipped;
      if (wasFlipped) {
        setIsFlipped(false);
        // Wait for flip animation
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2.0,
        cacheBust: true,
      });

      if (wasFlipped) {
        setIsFlipped(true);
      }

      setCardImage(dataUrl);
      setIsShareSheetOpen(true);
    } catch (err) {
      console.error("Failed to generate card image:", err);
      // Fallback
      setIsShareSheetOpen(true);
    } finally {
      setGeneratingImage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Floating Close Button for Mobile Accessibility */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-5 right-5 p-2.5 rounded-full border border-white/[0.08] bg-zinc-950/80 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all backdrop-blur-md shadow-lg z-50 flex items-center justify-center"
          aria-label="Close card overlay"
        >
          <X size={18} />
        </button>

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={isTrashing ? { y: 800, rotate: 360, scale: 0.1, opacity: 0 } : { scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={isTrashing ? { duration: 0.8, ease: "backIn" } : { duration: 0.3, ease: "easeOut" }}
          onAnimationComplete={() => {
            if (isTrashing) {
              onClose();
              setIsTrashing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[340px] sm:max-w-[380px] my-auto flex flex-col items-center"
        >
          {/* Card perspective container */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer relative w-full select-none animate-fade-in"
            style={{
              perspective: "1200px",
              aspectRatio: "9/16",
              height: "auto",
            }}
          >
            {/* 3D Tilting Layer */}
            <motion.div
              style={{
                rotateX,
                rotateY,
                translateX,
                translateY,
                transformStyle: "preserve-3d",
                width: "100%",
                height: "100%",
              }}
              whileHover={{ scale: 1.025 }}
              transition={{ duration: 0.2 }}
            >
              {/* Rotating Flipper element */}
              <div
                style={{
                  transformStyle: "preserve-3d",
                  transition: "transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                }}
              >
              {/* ───────────────── FRONT SIDE ───────────────── */}
              <div
                ref={cardRef}
                className={`p-7 sm:p-9 rounded-[28px] border text-left flex flex-col justify-between shadow-2xl relative overflow-hidden ${borderStyle}`}
                style={{
                  background: cardBg,
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(0deg)",
                }}
              >
                {/* Accent stripe on the left edge */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: tierColor }}
                />

                {/* Cracked card glass effect overlay */}
                {isFailed && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40 z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 0 30 L 25 35 L 35 20 L 50 35 L 55 55 L 45 70 L 60 85 L 50 100" stroke="#DE211E" strokeWidth="0.5" strokeLinecap="round" fill="none" />
                    <path d="M 35 20 L 45 10 L 65 5 L 80 15" stroke="#DE211E" strokeWidth="0.5" strokeLinecap="round" fill="none" />
                    <path d="M 55 55 L 75 50 L 90 65 L 100 60" stroke="#DE211E" strokeWidth="0.5" strokeLinecap="round" fill="none" />
                    <path d="M 25 35 L 15 50 L 0 55" stroke="#DE211E" strokeWidth="0.5" strokeLinecap="round" fill="none" />
                    <path d="M 45 70 L 30 80 L 15 75 L 0 90" stroke="#DE211E" strokeWidth="0.5" strokeLinecap="round" fill="none" />
                    <path d="M 60 85 L 80 90 L 100 80" stroke="#DE211E" strokeWidth="0.5" strokeLinecap="round" fill="none" />
                  </svg>
                )}

                {/* RUNWAY CRASHED Stamp */}
                {isFailed && (
                  <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[12deg] z-30 border-4 border-cherryRed bg-black/90 px-5 py-2.5 rounded-xl text-center select-none shadow-[0_0_25px_rgba(222,33,30,0.5)] pointer-events-none">
                    <span className="text-xl sm:text-2xl font-black tracking-widest text-cherryRed animate-pulse">
                      RUNWAY CRASHED
                    </span>
                    <span className="block text-[8px] font-black uppercase text-cherryRed/80 tracking-widest mt-0.5">
                      -5 Aura Penalty
                    </span>
                  </div>
                )}

                {/* Ambient Background Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(#EDEBDE 1px, transparent 1px), radial-gradient(#EDEBDE 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    backgroundPosition: "0 0, 10px 10px"
                  }}
                />

                {/* Ambient glow orbs */}
                <div
                  className="absolute -right-24 -top-24 w-52 h-52 rounded-full blur-[80px] pointer-events-none"
                  style={{ backgroundColor: glowColor }}
                />
                <div
                  className="absolute -left-24 -bottom-24 w-52 h-52 rounded-full blur-[80px] pointer-events-none"
                  style={{ backgroundColor: glowColor }}
                />

                {/* Instrument lines */}
                <svg className="absolute right-0 bottom-0 w-full h-[55%] opacity-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M-10,100 L110,40" stroke={tierColor} strokeWidth="0.75" strokeDasharray="3 3" fill="none" />
                  <path d="M-10,110 L110,50" stroke={tierColor} strokeWidth="1.25" fill="none" />
                  <path d="M-10,90 L110,30" stroke="#EDEBDE" strokeWidth="0.5" fill="none" />
                  <circle cx="90" cy="90" r="30" stroke={tierColor} strokeWidth="0.5" fill="none" />
                  <circle cx="90" cy="90" r="60" stroke={tierColor} strokeWidth="0.5" fill="none" />
                </svg>

                {/* Top Row: Brand & Badge */}
                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-black/40 border border-white/10 p-0.5">
                      <img src="/logo.png" alt="Logo" className="h-3.5 w-3.5 object-contain" />
                    </div>
                    <span className="text-[10px] sm:text-[12px] font-black tracking-[0.25em] text-[#EDEBDE]">LOCKIN</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className="font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] leading-none"
                      style={{ color: tierColor }}
                    >
                      {statusText}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-black tracking-wider text-zinc-500 uppercase">{date}</span>
                  </div>
                </div>

                {/* Middle Row: Hero Duration Stats */}
                <div className="space-y-1 z-10">
                  <div className="flex items-baseline gap-0.5">
                    {hours > 0 ? (
                      <>
                        <span className="text-6xl sm:text-7xl font-black tracking-tighter text-white leading-none">
                          {hours}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-white leading-none mr-2">h</span>
                        {mins > 0 && (
                          <>
                            <span className="text-6xl sm:text-7xl font-black tracking-tighter text-white leading-none">
                              {mins}
                            </span>
                            <span className="text-2xl sm:text-3xl font-black text-white leading-none">m</span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-6xl sm:text-7xl font-black tracking-tighter text-white leading-none">
                          {mins}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-white leading-none">m</span>
                      </>
                    )}
                  </div>
                  <div
                    className="text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase mt-1"
                    style={{ color: tierColor }}
                  >
                    {tierName} TIER FOCUS RUNWAY
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-widest line-clamp-1">
                    {isPeriod ? "YOUR PERIOD SUMMARY" : subtitleText}
                  </div>
                </div>

                {/* Bottom Row: Stats Grid */}
                <div className="z-10">
                  <div className="grid grid-cols-2 border-t border-white/10">
                    <div className="border-r border-b border-white/10 py-3.5 sm:py-4.5 pr-2">
                      <div className="text-[7.5px] sm:text-[8.5px] font-bold tracking-[0.15em] text-zinc-500 uppercase">TASKS COMPLETED</div>
                      <div className="text-[13px] sm:text-[15px] font-black text-white mt-1 leading-none uppercase">{tasksCompleted} Done</div>
                    </div>
                    <div className="border-b border-white/10 py-3.5 sm:py-4.5 pl-4 sm:pl-5">
                      <div className="text-[7.5px] sm:text-[8.5px] font-bold tracking-[0.15em] text-zinc-500 uppercase">
                        {isPeriod ? "MISSIONS RUN" : "CURRENT STREAK"}
                      </div>
                      <div className="text-[13px] sm:text-[15px] font-black text-white mt-1 leading-none uppercase">
                        {isPeriod ? `${recapData.missionsCompleted ?? 0} Completed` : `${streakVal} Days`}
                      </div>
                    </div>
                    <div className="border-r border-white/10 py-3.5 sm:py-4.5 pr-2">
                      <div className="text-[7.5px] sm:text-[8.5px] font-bold tracking-[0.15em] text-zinc-500 uppercase">TOP CATEGORY</div>
                      <div className="text-[13px] sm:text-[15px] font-black text-white mt-1 leading-none uppercase truncate">{categoryVal}</div>
                    </div>
                    <div className="py-3.5 sm:py-4.5 pl-4 sm:pl-5">
                      <div className="text-[7.5px] sm:text-[8.5px] font-bold tracking-[0.15em] text-zinc-500 uppercase">
                        {isPeriod ? "LONGEST LOCK" : "MISSION RANK"}
                      </div>
                      <div className="text-[13px] sm:text-[15px] font-black text-white mt-1 leading-none uppercase">
                        {isPeriod ? longestLockText : `#${recapData.missionRank ?? recapData.rank ?? 1}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Branding */}
                <div className="border-t border-white/10 pt-3 sm:pt-4 flex justify-between text-[7px] sm:text-[8px] font-black text-zinc-500 tracking-[0.2em] uppercase z-10">
                  <span>{tierName} Runway Card</span>
                  <span className="animate-pulse">Click card to Flip</span>
                </div>

                {/* 3D Glare overlay */}
                <motion.div
                  className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-[28px] mix-blend-overlay"
                  style={{
                    background: glareBackgroundFront,
                    opacity: 0.5,
                  }}
                />
              </div>

              {/* ───────────────── BACK SIDE ───────────────── */}
              <div
                className={`p-7 sm:p-9 rounded-[28px] border text-left flex flex-col justify-between shadow-2xl relative overflow-hidden ${borderStyle}`}
                style={{
                  background: cardBg,
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {/* Ambient glow orbs */}
                <div
                  className="absolute -right-24 -bottom-24 w-52 h-52 rounded-full blur-[80px] pointer-events-none"
                  style={{ backgroundColor: glowColor }}
                />

                {/* Circuit Grid pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(#EDEBDE 1px, transparent 1px), radial-gradient(#EDEBDE 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    backgroundPosition: "0 0, 12px 12px"
                  }}
                />

                {/* Accent stripe on the right edge */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: tierColor }}
                />

                {/* Top Row: Brand & Tier Badge */}
                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-[12px] font-black tracking-[0.25em] text-[#EDEBDE]">COORDINATES</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider border" style={{ borderColor: `${tierColor}50`, color: tierColor }}>
                    {tierName} TIER
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 my-6 flex flex-col justify-center space-y-4.5 z-10">
                  <div className="flex-1 my-3 flex flex-col justify-start overflow-y-auto pr-1 scrollbar-none space-y-3 max-h-[280px]">
                    {isFailed && (
                      <div className="rounded-xl border border-cherryRed/35 bg-cherryRed/5 p-3 text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cherryRed">Runway Crash logged</span>
                        <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">
                          Timer exited early. 5 Aura deducted.
                        </p>
                      </div>
                    )}
                    {reflectionText && (
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Quote className="h-3.5 w-3.5 shrink-0" style={{ color: tierColor }} />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider">Session Reflection</span>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                          <p className="text-[10.5px] sm:text-[11.5px] font-semibold text-cotton/90 italic leading-relaxed">
                            "{reflectionText}"
                          </p>
                        </div>
                      </div>
                    )}
                    {lessonsLearned && (
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: tierColor }} />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider">Lessons Logged</span>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                          <p className="text-[9.5px] sm:text-[10.5px] font-medium text-zinc-400 leading-relaxed">
                            {lessonsLearned}
                          </p>
                        </div>
                      </div>
                    )}
                    {screenshot && (
                      <div className="space-y-1 text-left">
                        <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-zinc-500">
                          Progress Attachment
                        </div>
                        <div className="rounded-xl border border-white/5 bg-black/40 overflow-hidden relative aspect-video w-full">
                          <img src={screenshot} alt="Runway Screenshot" className="object-cover w-full h-full animate-fade-in" />
                        </div>
                      </div>
                    )}
                    {link && (
                      <div className="space-y-1 text-left">
                        <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-zinc-500">
                          Project Link
                        </div>
                        <a
                          href={link.startsWith("http") ? link : `https://${link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-[10px] sm:text-[11px] font-bold text-luxuryGold hover:bg-white/5 transition truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate">{link}</span>
                        </a>
                      </div>
                    )}
                    {!reflectionText && !lessonsLearned && !screenshot && !link && (
                      <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div
                          className="p-5.5 rounded-3xl border border-white/10 bg-black/30 relative overflow-hidden group shadow-inner"
                          style={{ boxShadow: `inset 0 0 20px ${glowColor}` }}
                        >
                          <Flame
                            className="h-14 w-14 animate-pulse"
                            style={{
                              color: tierColor,
                              filter: `drop-shadow(0 0 16px ${tierColor}70)`
                            }}
                          />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-[11px] sm:text-[12px] font-black tracking-[0.15em] text-white uppercase">
                            MOMENTUM CONFIRMED
                          </p>
                          <p className="text-[8.5px] sm:text-[9.5px] font-semibold text-zinc-500 uppercase tracking-widest max-w-[200px] leading-relaxed">
                            Verify coordinates on the LOCKIN discovery dashboard.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row stats summary / verification details */}
                <div className="z-10 space-y-3">
                  <div className="rounded-xl bg-black/30 border border-white/5 p-3 flex justify-between items-center text-left">
                    <div>
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-zinc-500 leading-none">STREAK LOG</span>
                      <span className="text-[12px] sm:text-[13.5px] font-black text-white mt-1 leading-none inline-block uppercase">
                        {streakVal} Days
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-zinc-500 leading-none">AURA SCORE</span>
                      <span className="text-[12px] sm:text-[13.5px] font-black mt-1 leading-none inline-block uppercase" style={{ color: tierColor }}>
                        {isFailed ? "-5 AURA" : `+${isPeriod ? (recapData.missionsCompleted ?? 0) * 15 : 10} AURA`}
                      </span>
                    </div>
                  </div>

                  {/* Footer Back */}
                  <div className="border-t border-white/10 pt-3 flex justify-between text-[7px] sm:text-[8px] font-black text-zinc-500 tracking-with-gap uppercase">
                    <span>SECURITY HASH: #{recapData.shareId ? recapData.shareId.slice(0, 8) : "LOCKIN"}</span>
                    <span>Tap to flip</span>
                  </div>
                </div>

                {/* 3D Glare overlay */}
                <motion.div
                  className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-[28px] mix-blend-overlay"
                  style={{
                    background: glareBackgroundBack,
                    opacity: 0.4,
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>

          {/* Action Row */}
          <div className="flex gap-2 mt-4 justify-center w-full">
            {isFailed ? (
              <button
                onClick={() => setIsTrashing(true)}
                className="flex-1 bg-[#810100] text-white font-black px-6 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition hover:bg-cherryRed tracking-wider uppercase shadow-[0_0_15px_rgba(222,33,30,0.3)]"
              >
                <Trash2 size={13} />
                Trash Card
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 hover:brightness-95 text-black font-black px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition disabled:opacity-50 tracking-wider uppercase truncate"
                  style={{ backgroundColor: tierColor, color: tier === "gold" || tier === "silver" ? "#120F0D" : "#EDEBDE" }}
                >
                  <Download size={13} />
                  {saving ? "Exporting..." : "Export Card"}
                </button>
                <button
                  onClick={handlePostToFeedClick}
                  disabled={generatingImage}
                  className="flex-1 bg-cherryRed text-white font-black px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition hover:bg-red-800 tracking-wider uppercase truncate disabled:opacity-50"
                >
                  {generatingImage ? "Processing..." : "Post to Feed"}
                </button>
              </>
            )}

            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-xl flex items-center justify-center border transition bg-zinc-950 border-white/8 text-zinc-400 hover:text-cotton hover:bg-zinc-900 shrink-0"
              title={copied ? "Copied!" : "Share Link"}
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
            </button>
          </div>
        </motion.div>

        <ShareToFeedSheet
          isOpen={isShareSheetOpen}
          onClose={() => {
            setIsShareSheetOpen(false);
            setCardImage(null);
          }}
          recapId={recapData.id}
          recapData={recapData}
          preGeneratedCardImage={cardImage}
        />
      </motion.div>
    </AnimatePresence>
  );
}