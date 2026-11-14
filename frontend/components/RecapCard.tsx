"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import {
  Download,
  Share2,
  Check,
  BookOpen,
  Quote,
  Trash2,
  X,
  MessageCircle,
  Camera,
  Tag,
  Sparkles,
  Layers,
  Copy
} from "lucide-react";
import { LockinMark, LockinWordmark } from "./ui/LockinLogo";
import { CountUp, Portal } from "./ui/motion";
import { POINTS_NAME } from "../lib/brand";
import { toBlob } from "html-to-image";
import { uploadImage } from "../lib/supabase";

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
    participantCount?: number;
    missionsCompleted?: number;
    longestSession?: number;
    generatedAt?: string;
    reflectionText?: string;
    lessonsLearned?: string;
    customMetric?: string;
    metadata?: {
      isFailed?: boolean;
      screenshot?: string | null;
      link?: string | null;
      customMetric?: string | null;
      [key: string]: any;
    };
  };
}

// iOS Safari ignores backface-visibility when a face has positioned or blended
// children, so the hidden face is also switched off halfway through the 0.7s flip.
function faceStyle(shown: boolean): React.CSSProperties {
  return {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    visibility: shown ? "visible" : "hidden",
    transition: "visibility 0s linear 0.35s"
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

  // Strava & Multi-Format Modes
  const initialPhoto = recapData.metadata?.screenshot || null;
  // 2 Master Presentation Modes:
  // 1. "sticker" = Transparent PNG Sticker (for Instagram Story) or Photo Overlay
  // 2. "metallic" = Obsidian 3D collectible trading card
  // Default is always the metallic tier card. The sticker opened first used
  // to render as a black card on phones (transparent over the dark overlay).
  const [cardMode, setCardMode] = useState<"sticker" | "metallic">("metallic");
  const [stickerBg, setStickerBg] = useState<"transparent" | "photo">(
    initialPhoto ? "photo" : "transparent"
  );
  const [stickerStyle, setStickerStyle] = useState<"stamp" | "telemetry" | "badge">("stamp");
  const [copiedSticker, setCopiedSticker] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(initialPhoto);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Custom Metric / Accomplishment sticker
  const initialMetric = recapData.metadata?.customMetric || recapData.customMetric || "";
  const [activeMetric, setActiveMetric] = useState<string>(initialMetric);
  const [isEditingMetric, setIsEditingMetric] = useState<boolean>(false);
  const [tempMetric, setTempMetric] = useState<string>("");

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
  const link = recapData.metadata?.link || null;

  useEffect(() => {
    if (isOpen) {
      setIsTrashing(false);
      setCurrentPhoto(recapData.metadata?.screenshot || null);
      setCardMode("metallic");
      setIsFlipped(false);
      setActiveMetric(recapData.metadata?.customMetric || recapData.customMetric || "");
    }
  }, [isOpen, recapData]);

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

  const isGroupCrew = (recapData.participantCount ?? 1) > 1 && Boolean(recapData.missionRank || recapData.rank);
  const fourthLabel = isPeriod ? "Longest" : isGroupCrew ? "Crew Rank" : "Focus";
  const fourthValue = isPeriod
    ? longestLockText
    : isGroupCrew
      ? `#${recapData.missionRank ?? recapData.rank}/${recapData.participantCount}`
      : isFailed
        ? "Crash"
        : "100%";

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
  let tierName = "Bronze Tier";
  let tierPill = "BRONZE";
  let tierColor = "#CD7F32"; // Rich metallic bronze/copper
  let cardBg = "linear-gradient(155deg, #22140A 0%, #140C06 45%, #080402 100%)";
  let glowColor = "rgba(205, 127, 50, 0.28)";
  let accentColor = "text-[#E8A36E]";
  let borderStyle = "border-[#CD7F32]/50 shadow-[0_0_35px_rgba(205,127,50,0.18)]";
  let badgeBg = "bg-[#CD7F32]/20 border-[#CD7F32]/40 text-[#E8A36E]";

  if (isFailed) {
    tier = "crashed";
    tierName = "Runway Crashed";
    tierPill = "CRASHED";
    tierColor = "#EF4444";
    cardBg = "linear-gradient(155deg, #1C0508 0%, #0E0204 45%, #050002 100%)";
    glowColor = "rgba(239, 68, 68, 0.30)";
    accentColor = "text-red-400";
    borderStyle = "border-red-600/60 shadow-[0_0_35px_rgba(239,68,68,0.22)]";
    badgeBg = "bg-red-950/60 border-red-500/50 text-red-400";
  } else if (recapType === "session") {
    if (sessionDuration > 90) {
      // > 90 min: Crimson Tier (Hyper-focus)
      tier = "crimson";
      tierName = "Crimson Tier";
      tierPill = "CRIMSON";
      tierColor = "#FF1E46";
      cardBg = "linear-gradient(155deg, #2E030B 0%, #170105 45%, #080002 100%)";
      glowColor = "rgba(255, 30, 70, 0.38)";
      accentColor = "text-[#FF4D6D]";
      borderStyle = "border-[#FF1E46]/60 shadow-[0_0_45px_rgba(255,30,70,0.28)]";
      badgeBg = "bg-[#FF1E46]/20 border-[#FF1E46]/50 text-[#FFA0B0]";
    } else if (sessionDuration >= 75) {
      // 75-90 min: Gold Tier (Radiant 24K gold)
      tier = "gold";
      tierName = "Gold Tier";
      tierPill = "GOLD";
      tierColor = "#F59E0B";
      cardBg = "linear-gradient(155deg, #261B05 0%, #161003 45%, #080501 100%)";
      glowColor = "rgba(245, 158, 11, 0.32)";
      accentColor = "text-amber-300";
      borderStyle = "border-amber-400/55 shadow-[0_0_40px_rgba(245,158,11,0.22)]";
      badgeBg = "bg-amber-400/20 border-amber-400/45 text-amber-200";
    } else if (sessionDuration >= 45) {
      // 45-74 min: Silver Tier (Cyber chrome / iced platinum)
      tier = "silver";
      tierName = "Silver Tier";
      tierPill = "SILVER";
      tierColor = "#E2E8F0";
      cardBg = "linear-gradient(155deg, #181D26 0%, #0E1218 45%, #06080C 100%)";
      glowColor = "rgba(226, 232, 240, 0.24)";
      accentColor = "text-slate-200";
      borderStyle = "border-slate-300/45 shadow-[0_0_35px_rgba(226,232,240,0.18)]";
      badgeBg = "bg-slate-300/15 border-slate-300/40 text-slate-100";
    } else {
      // < 45 min (~25 min Pomodoro): Bronze Tier
      tier = "bronze";
      tierName = "Bronze Tier";
      tierPill = "BRONZE";
      tierColor = "#CD7F32";
      cardBg = "linear-gradient(155deg, #22140A 0%, #140C06 45%, #080402 100%)";
      glowColor = "rgba(205, 127, 50, 0.28)";
      accentColor = "text-[#E8A36E]";
      borderStyle = "border-[#CD7F32]/50 shadow-[0_0_35px_rgba(205,127,50,0.18)]";
      badgeBg = "bg-[#CD7F32]/20 border-[#CD7F32]/40 text-[#E8A36E]";
    }
  } else {
    // Wrapped types logic
    if (recapType === "weekly") {
      const focusHrs = sessionDuration / 60;
      if (focusHrs >= 15) {
        tier = "crimson";
        tierName = "Crimson Tier";
        tierPill = "CRIMSON";
        tierColor = "#FF1E46";
        cardBg = "linear-gradient(155deg, #2E030B 0%, #170105 45%, #080002 100%)";
        glowColor = "rgba(255, 30, 70, 0.38)";
        accentColor = "text-[#FF4D6D]";
        borderStyle = "border-[#FF1E46]/60 shadow-[0_0_45px_rgba(255,30,70,0.28)]";
        badgeBg = "bg-[#FF1E46]/20 border-[#FF1E46]/50 text-[#FFA0B0]";
      } else if (focusHrs >= 8) {
        tier = "gold";
        tierName = "Gold Tier";
        tierPill = "GOLD";
        tierColor = "#F59E0B";
        cardBg = "linear-gradient(155deg, #261B05 0%, #161003 45%, #080501 100%)";
        glowColor = "rgba(245, 158, 11, 0.32)";
        accentColor = "text-amber-300";
        borderStyle = "border-amber-400/55 shadow-[0_0_40px_rgba(245,158,11,0.22)]";
        badgeBg = "bg-amber-400/20 border-amber-400/45 text-amber-200";
      } else {
        tier = "silver";
        tierName = "Silver Tier";
        tierPill = "SILVER";
        tierColor = "#E2E8F0";
        cardBg = "linear-gradient(155deg, #181D26 0%, #0E1218 45%, #06080C 100%)";
        glowColor = "rgba(226, 232, 240, 0.24)";
        accentColor = "text-slate-200";
        borderStyle = "border-slate-300/45 shadow-[0_0_35px_rgba(226,232,240,0.18)]";
        badgeBg = "bg-slate-300/15 border-slate-300/40 text-slate-100";
      }
    } else if (recapType === "monthly") {
      const focusHrs = sessionDuration / 60;
      if (focusHrs >= 40) {
        tier = "crimson";
        tierName = "Crimson Tier";
        tierPill = "CRIMSON";
        tierColor = "#FF1E46";
        cardBg = "linear-gradient(155deg, #2E030B 0%, #170105 45%, #080002 100%)";
        glowColor = "rgba(255, 30, 70, 0.38)";
        accentColor = "text-[#FF4D6D]";
        borderStyle = "border-[#FF1E46]/60 shadow-[0_0_45px_rgba(255,30,70,0.28)]";
        badgeBg = "bg-[#FF1E46]/20 border-[#FF1E46]/50 text-[#FFA0B0]";
      } else {
        tier = "gold";
        tierName = "Gold Tier";
        tierPill = "GOLD";
        tierColor = "#F59E0B";
        cardBg = "linear-gradient(155deg, #261B05 0%, #161003 45%, #080501 100%)";
        glowColor = "rgba(245, 158, 11, 0.32)";
        accentColor = "text-amber-300";
        borderStyle = "border-amber-400/55 shadow-[0_0_40px_rgba(245,158,11,0.22)]";
        badgeBg = "bg-amber-400/20 border-amber-400/45 text-amber-200";
      }
    } else {
      // yearly or team
      tier = "crimson";
      tierName = "Crimson Tier";
      tierPill = "CRIMSON";
      tierColor = "#FF1E46";
      cardBg = "linear-gradient(155deg, #2E030B 0%, #170105 45%, #080002 100%)";
      glowColor = "rgba(255, 30, 70, 0.38)";
      accentColor = "text-[#FF4D6D]";
      borderStyle = "border-[#FF1E46]/60 shadow-[0_0_45px_rgba(255,30,70,0.28)]";
      badgeBg = "bg-[#FF1E46]/20 border-[#FF1E46]/50 text-[#FFA0B0]";
    }
  }

  const pointsDelta = recapData.metadata?.gritDelta !== undefined
    ? Number(recapData.metadata.gritDelta)
    : (isFailed ? -5 : 10);

  // Dynamic Card Border Styling based on Mode
  const isTransparentSticker = cardMode === "sticker" && stickerBg === "transparent";
  const activeBorderStyle =
    cardMode === "sticker"
      ? isTransparentSticker
        ? "border-0 shadow-none"
        : "border border-white/10 shadow-2xl"
      : borderStyle;

  type ExportKind = "metallic" | "sticker" | "photo";
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  // The on-screen transparency grid and other preview-only helpers are never exported.
  const exportFilter = (node: HTMLElement) => !(node instanceof HTMLElement && node.dataset && node.dataset.exportIgnore);
  const nextFrames = (ms: number) => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), ms));

  /**
   * Render one of the three versions as a PNG, whatever is on screen right
   * now: switch to it, capture the front face, then put the view back.
   */
  const renderVersion = useCallback(async (kind: ExportKind): Promise<Blob> => {
    const prev = { cardMode, stickerBg, isFlipped };
    setIsFlipped(false);
    setCardMode(kind === "metallic" ? "metallic" : "sticker");
    if (kind !== "metallic") setStickerBg(kind === "photo" ? "photo" : "transparent");
    await nextFrames(prev.isFlipped ? 650 : 80);
    try {
      if (!cardRef.current) throw new Error("Card isn't ready yet.");
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: kind === "sticker" ? "transparent" : undefined,
        filter: exportFilter as any
      });
      if (!blob) throw new Error("Couldn't render the image.");
      return blob;
    } finally {
      setCardMode(prev.cardMode);
      setStickerBg(prev.stickerBg);
      setIsFlipped(prev.isFlipped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode, stickerBg, isFlipped]);

  const fileName = (kind: ExportKind) =>
    kind === "sticker" ? `lockin-sticker-transparent-${Date.now()}.png` : kind === "photo" ? `lockin-photo-${Date.now()}.png` : `lockin-card-${Date.now()}.png`;

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const handleExport = useCallback(async (kind: ExportKind) => {
    if (saving) return;
    if (kind === "photo" && !currentPhoto) {
      alert("Add a photo first.");
      return;
    }
    setSaving(true);
    setExporting(kind);
    try {
      download(await renderVersion(kind), fileName(kind));
    } catch (err: any) {
      console.error("Failed to export image:", err);
      alert(err?.message || "Failed to export PNG image. Please try again.");
    } finally {
      setSaving(false);
      setExporting(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, currentPhoto, renderVersion]);

  // 1-tap clipboard copy of the transparent sticker (for pasting into a story).
  const handleCopySticker = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setExporting("sticker");
    try {
      const blob = await renderVersion("sticker");
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopiedSticker(true);
          setTimeout(() => setCopiedSticker(false), 2500);
          return;
        } catch (clipErr) {
          console.warn("Clipboard write failed, downloading instead", clipErr);
        }
      }
      download(blob, fileName("sticker"));
      setCopiedSticker(true);
      setTimeout(() => setCopiedSticker(false), 2500);
    } catch (err: any) {
      console.error("Failed to copy sticker:", err);
      alert(err?.message || "Failed to copy sticker image.");
    } finally {
      setSaving(false);
      setExporting(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, renderVersion]);

  const handleShare = useCallback(async () => {
    if (!recapData.shareId) {
      alert("No share coordinates generated for this card.");
      return;
    }

    const shareUrl = `${window.location.origin}/recap/${recapData.shareId}`;

    if (navigator.share) {
      try {
        if (cardRef.current && navigator.canShare) {
          const kind: ExportKind = cardMode === "metallic" ? "metallic" : stickerBg === "photo" && currentPhoto ? "photo" : "sticker";
          const blob = await renderVersion(kind);
          const file = new File([blob], fileName(kind), { type: "image/png" });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "LOCKIN Focus Story",
              text: `Locked in for ${hours > 0 ? `${hours}h ` : ""}${mins}m on LOCKIN.${activeMetric ? ` ${activeMetric}.` : ""}`,
              url: shareUrl,
            });
            return;
          }
        }

        await navigator.share({
          title: "LOCKIN Recap",
          text: `Check out my Lockin productivity recap! I locked in for ${hours}h ${mins}m.${activeMetric ? ` ${activeMetric}.` : ""}`,
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
  }, [recapData.shareId, cardMode, stickerBg, currentPhoto, renderVersion, hours, mins, activeMetric]);

  if (!isOpen) return null;

  const SPARKS = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const d = 150 + (i % 3) * 40;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, gold: i % 2 === 0, delay: 0.45 + (i % 4) * 0.03 };
  });

  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</div>
      <div className="t-display mt-0.5 truncate text-headline font-bold text-ink">{value}</div>
    </div>
  );

  return (
    <Portal>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-y-auto bg-black/90 p-3 sm:p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${statusText}: ${subtitleText}`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/80 text-ink-2 backdrop-blur transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto flex w-full max-w-[340px] flex-col items-center sm:max-w-[380px]"
          >
            {/* Success sparks */}
            {!isFailed && !isTrashing && (
              <div className="pointer-events-none absolute left-1/2 top-[40%] z-0" aria-hidden="true">
                {SPARKS.map((s, i) => (
                  <motion.span
                    key={i}
                    className={`absolute h-1.5 w-1.5 rounded-full ${s.gold ? "bg-gold" : "bg-signal"}`}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], scale: [0, 1.4, 0.4] }}
                    transition={{ duration: 1.1, delay: s.delay, ease: [0.22, 1, 0.36, 1] }}
                    style={{ boxShadow: `0 0 10px ${s.gold ? "rgb(var(--gold))" : "rgb(var(--signal))"}` }}
                  />
                ))}
              </div>
            )}

            {/* Shatter on trash */}
            {isTrashing && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-40" style={{ aspectRatio: "9/16" }} aria-hidden="true">
                {SHARDS.map((sh, i) => (
                  <motion.div
                    key={i}
                    className={`absolute inset-0 rounded-sm border ${borderStyle}`}
                    style={{ background: cardBg, clipPath: sh.clip }}
                    initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                    animate={{ x: sh.tx, y: sh.ty + 300, rotate: sh.r, opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.4, 0, 0.8, 0.6] }}
                    onAnimationComplete={() => {
                      if (i === 0) {
                        onClose();
                        setIsTrashing(false);
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* ─── Mode Switcher Bar (Story Sticker vs Metallic Obsidian) ─── */}
            <div className="relative z-30 mb-2.5 flex w-full flex-col gap-1.5 rounded-xl border border-line bg-surface/90 p-1.5 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between gap-1 w-full">
                {/* Three versions: metallic tier card, transparent sticker, photo. */}
                <div className="flex items-center gap-1" role="tablist" aria-label="Card version">
                  {([
                    { key: "metallic", label: "Metallic" },
                    { key: "sticker", label: "Sticker" },
                    { key: "photo", label: "Photo" }
                  ] as const).map((v) => {
                    const on = v.key === "metallic" ? cardMode === "metallic" : cardMode === "sticker" && stickerBg === (v.key === "photo" ? "photo" : "transparent");
                    return (
                      <button
                        key={v.key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => {
                          setIsFlipped(false);
                          if (v.key === "metallic") setCardMode("metallic");
                          else {
                            setCardMode("sticker");
                            setStickerBg(v.key === "photo" ? "photo" : "transparent");
                          }
                        }}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                          on ? "bg-ink text-bg shadow-sm" : "text-ink-3 hover:text-ink hover:bg-raised"
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>

                {/* Flip button for metallic card */}
                {cardMode === "metallic" && (
                  <button
                    type="button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="flex items-center gap-1 rounded-lg border border-line bg-raised px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink"
                  >
                    <Layers className="h-3.5 w-3.5 text-ink-3" />
                    <span>Flip Card</span>
                  </button>
                )}
              </div>

              {/* In Sticker Mode: Overlay Style Picker & Photo Actions */}
              {cardMode === "sticker" && (
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-line/60">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase font-bold text-ink-4 mr-0.5">Style:</span>
                    <button
                      type="button"
                      onClick={() => setStickerStyle("stamp")}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        stickerStyle === "stamp" ? "bg-raised text-ink border border-line" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      Stamp
                    </button>
                    <button
                      type="button"
                      onClick={() => setStickerStyle("telemetry")}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        stickerStyle === "telemetry" ? "bg-raised text-ink border border-line" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      Telemetry
                    </button>
                    <button
                      type="button"
                      onClick={() => setStickerStyle("badge")}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        stickerStyle === "badge" ? "bg-raised text-ink border border-line" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      Badge
                    </button>
                  </div>

                  {stickerBg === "photo" && (
                    <label className="flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-2 cursor-pointer transition-colors hover:text-ink">
                      <Camera className="h-3 w-3 text-crimson" />
                      <span>{uploadingPhoto ? "..." : currentPhoto ? "Swap" : "Upload"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) {
                            try {
                              setUploadingPhoto(true);
                              const url = await uploadImage(file);
                              setCurrentPhoto(url);
                              setStickerBg("photo");
                            } catch (err: any) {
                              alert(err.message || "Failed to upload photo");
                            } finally {
                              setUploadingPhoto(false);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* ─── 3D Interactive Card Canvas ─── */}
            <motion.div
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={() => setIsFlipped(!isFlipped)}
              initial={{ y: 80, rotateX: 28, opacity: 0, scale: 0.9 }}
              animate={isTrashing ? { opacity: 0, transition: { duration: 0.05 } } : { y: 0, rotateX: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 20 }}
              className="relative z-10 w-full cursor-pointer select-none"
              style={{ perspective: "1200px", aspectRatio: "9/16", transformPerspective: 1200 }}
              aria-label={isFlipped ? "Show front" : "Show reflection"}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsFlipped(!isFlipped);
                }
              }}
            >
              <motion.div style={{ rotateX, rotateY, translateX, translateY, transformStyle: "preserve-3d", width: "100%", height: "100%" }}>
                <div
                  style={{
                    transformStyle: "preserve-3d",
                    transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    position: "absolute",
                    width: "100%",
                    height: "100%"
                  }}
                >
                  {/* ───────── FRONT ───────── */}
                  <div
                    ref={cardRef}
                    className={`relative flex flex-col justify-between overflow-hidden rounded-xl p-6 text-left sm:p-7 ${activeBorderStyle}`}
                    style={{
                      background: cardMode === "sticker"
                        ? isTransparentSticker
                          ? "transparent"
                          : "#050505"
                        : cardBg,
                      borderColor: cardMode === "metallic" ? tierColor : undefined,
                      // Photo version: every line of text keeps a shadow so it reads on any image.
                      textShadow: cardMode === "sticker" && stickerBg === "photo"
                        ? "0 1px 2px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.75)"
                        : undefined,
                      position: "absolute",
                      inset: 0,
                      ...faceStyle(!isFlipped)
                    }}
                  >
                    {/* Visual transparency preview grid when in Transparent PNG mode */}
                    {isTransparentSticker && (
                      <div
                        data-export-ignore="1"
                        className="pointer-events-none absolute inset-0 -z-10 opacity-30"
                        style={{
                          backgroundImage: "radial-gradient(#52525b 1px, transparent 1px)",
                          backgroundSize: "16px 16px"
                        }}
                        aria-hidden="true"
                      />
                    )}

                    {/* ═══════════════════════════════════════════════════════════════
                        MODE 1: STORY STICKER (Transparent PNG or Photo Backdrop)
                       ═══════════════════════════════════════════════════════════════ */}
                    {cardMode === "sticker" ? (
                      <>
                        {/* Photo Backdrop (Only if Photo option selected) */}
                        {stickerBg === "photo" && (
                          <>
                            {currentPhoto ? (
                              <>
                                <img
                                  src={currentPhoto}
                                  alt="Focus session"
                                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                                />
                                <div
                                  className="pointer-events-none absolute inset-0"
                                  style={{
                                    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.50) 100%)"
                                  }}
                                />
                                <div
                                  className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl opacity-60"
                                  style={{ background: glowColor }}
                                  aria-hidden="true"
                                />
                              </>
                            ) : (
                              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
                                <div className="rounded-full border border-white/10 bg-white/5 p-4 mb-3">
                                  <Camera className="h-8 w-8 text-ink-3" />
                                </div>
                                <span className="text-sm font-semibold text-ink">No photo attached</span>
                                <span className="text-xs text-ink-3 mt-1 max-w-[200px]">Tap &quot;Upload&quot; above to snap or upload desk/workout photo</span>
                              </div>
                            )}
                          </>
                        )}

                        {/* ── Sub-Style A: Latent Clean Stamp (Screenshots 1 & 5) ── */}
                        {stickerStyle === "stamp" && (
                          <div className="relative z-10 flex h-full flex-col justify-between">
                            {/* Floating Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                                <LockinMark size={20} color="rgb(var(--ink))" />
                                <LockinWordmark size="sm" />
                              </div>
                              <span
                                className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                                style={{
                                  borderColor: `${tierColor}80`,
                                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                                  color: tierColor
                                }}
                              >
                                {tierPill}
                              </span>
                            </div>

                            {/* Center Typographic Stamp */}
                            <div className="my-auto text-center flex flex-col items-center">
                              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
                                {subtitleText}
                              </span>

                              <div className="my-1.5 t-display text-white text-[76px] sm:text-[88px] font-bold leading-none tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                                {hours > 0 ? `${hours}h ` : ""}{mins}m
                              </div>

                              {activeMetric && (
                                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/75 px-3.5 py-1 backdrop-blur-md shadow-xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                                  <span className="font-mono text-xs font-bold text-white uppercase tracking-tight">
                                    {activeMetric}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Floating Minimal Footer */}
                            <div className="flex items-center justify-between text-[11px] text-white/70 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                              <span>lockin.top</span>
                              <span className="font-mono text-[10px] text-white/50">{date}</span>
                            </div>
                          </div>
                        )}

                        {/* ── Sub-Style B: Strava Athletic Telemetry (Screenshots 3 & 4) ── */}
                        {stickerStyle === "telemetry" && (
                          <div className="relative z-10 flex h-full flex-col justify-between">
                            {/* Top Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex flex-col drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                                <span className="font-extrabold tracking-tight text-lg text-white uppercase">LOCKIN</span>
                                <span className="text-[10px] font-mono text-white/70">{date}</span>
                              </div>
                              <span
                                className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md"
                                style={{
                                  borderColor: `${tierColor}80`,
                                  backgroundColor: "rgba(0,0,0,0.65)",
                                  color: tierColor
                                }}
                              >
                                {tierPill}
                              </span>
                            </div>

                            {/* Strava Telemetry Stack */}
                            <div className="my-auto flex flex-col drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
                              <div className="t-display text-4xl sm:text-5xl font-extrabold text-white leading-tight uppercase tracking-tight">
                                {activeMetric || subtitleText}
                              </div>
                              {activeMetric && (
                                <span className="text-xs font-semibold uppercase tracking-wider text-white/70 mt-1">
                                  {subtitleText}
                                </span>
                              )}

                              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-3">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">Time</span>
                                  <span className="font-mono text-xl font-bold text-white">{hours > 0 ? `${hours}h ` : ""}{mins}m</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">Streak</span>
                                  <span className="font-mono text-xl font-bold text-white">{streakVal}d</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">Tasks</span>
                                  <span className="font-mono text-xl font-bold text-white">{tasksCompleted}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">Motion</span>
                                  <span className="font-mono text-xl font-bold text-emerald-400">{pointsDelta >= 0 ? "+" : ""}{pointsDelta}</span>
                                </div>
                              </div>
                            </div>

                            {/* Bottom Brand Stamp */}
                            <div className="flex items-center justify-between text-[11px] text-white/70 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                              <span>lockin.top</span>
                            </div>
                          </div>
                        )}

                        {/* ── Sub-Style C: Minimalist Glassmorphic Badge ── */}
                        {stickerStyle === "badge" && (
                          <div className="relative z-10 flex h-full flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <LockinWordmark size="sm" />
                              <span className="font-mono text-xs text-white/70">{date}</span>
                            </div>

                            <div
                              className="my-auto mx-auto w-full max-w-[280px] rounded-2xl border p-5 backdrop-blur-xl shadow-2xl"
                              style={{
                                borderColor: `${tierColor}80`,
                                backgroundColor: "rgba(0,0,0,0.72)",
                                boxShadow: `0 10px 40px ${glowColor}`
                              }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tierColor }}>
                                  {tierName}
                                </span>
                                <span className="font-mono text-xs font-bold text-emerald-400">{pointsDelta >= 0 ? "+" : ""}{pointsDelta} Motion</span>
                              </div>
                              <div className="text-3xl font-extrabold text-white">
                                {hours > 0 ? `${hours}h ` : ""}{mins}m
                              </div>
                              <div className="text-xs text-white/80 mt-1 line-clamp-1">{subtitleText}</div>
                              {activeMetric && (
                                <div className="mt-3 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-center">
                                  <span className="font-mono text-xs font-bold text-white uppercase">{activeMetric}</span>
                                </div>
                              )}
                            </div>

                            <div className="text-center text-[10px] text-white/60">lockin.top</div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* ═══════════════════════════════════════════════════════════════
                          MODE 2: METALLIC OBSIDIAN CARD (Collectible 3D Trading Card)
                         ═══════════════════════════════════════════════════════════════ */
                      <>
                        {/* Pure ambient radiant flare */}
                        <div
                          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl opacity-80"
                          style={{ background: glowColor }}
                          aria-hidden="true"
                        />

                        {/* Deer persona quiet watermark */}
                        <div className="pointer-events-none absolute -bottom-6 -right-10 opacity-[0.06] z-10">
                          <LockinMark size={260} color="rgb(var(--ink))" showTriangle={false} />
                        </div>

                        {/* Crash cracks draw on */}
                        {isFailed && (
                          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            {[
                              "M 0 30 L 25 35 L 35 20 L 50 35 L 55 55 L 45 70 L 60 85 L 50 100",
                              "M 35 20 L 45 10 L 65 5 L 80 15",
                              "M 55 55 L 75 50 L 90 65 L 100 60",
                              "M 25 35 L 15 50 L 0 55",
                              "M 45 70 L 30 80 L 15 75 L 0 90",
                              "M 60 85 L 80 90 L 100 80"
                            ].map((d, i) => (
                              <motion.path
                                key={d}
                                d={d}
                                stroke="rgb(var(--signal))"
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                fill="none"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 0.35 + i * 0.06, duration: 0.35, ease: "easeOut" }}
                              />
                            ))}
                          </svg>
                        )}

                        {isFailed && (
                          <motion.div
                            initial={{ scale: 2.2, opacity: 0, rotate: -4 }}
                            animate={{ scale: 1, opacity: 1, rotate: -12 }}
                            transition={{ delay: 0.75, type: "spring", stiffness: 500, damping: 18 }}
                            className="pointer-events-none absolute left-1/2 top-[42%] z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-signal bg-black/90 px-5 py-2.5 text-center"
                          >
                            <span className="t-display block whitespace-nowrap text-title-1 text-crimson">Runway crashed</span>
                            <span className="mt-0.5 block text-caption font-semibold text-crimson">−5 {POINTS_NAME}</span>
                          </motion.div>
                        )}

                        {/* Top Brand row */}
                        <div className="relative z-10 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <LockinMark size={22} color="rgb(var(--ink))" />
                            <LockinWordmark size="sm" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md"
                              style={{
                                borderColor: `${tierColor}60`,
                                backgroundColor: `${tierColor}20`,
                                color: tierColor
                              }}
                            >
                              {tierPill}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide tabular backdrop-blur-md ${
                                pointsDelta >= 0
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                  : "border-red-500/40 bg-red-500/15 text-red-300"
                              }`}
                            >
                              {pointsDelta >= 0 ? `+${pointsDelta}` : pointsDelta} {POINTS_NAME}
                            </span>
                          </div>
                        </div>

                        {/* Center Hero Section */}
                        <div className="relative z-10 my-auto">
                          <div className="t-display flex items-baseline leading-none text-ink drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]">
                            {hours > 0 && (
                              <>
                                <CountUp value={hours} className="text-[84px] sm:text-[96px]" duration={1.2} />
                                <span className="mr-3 text-[32px] sm:text-[36px]">h</span>
                              </>
                            )}
                            {(mins > 0 || hours === 0) && (
                              <>
                                <CountUp value={mins} className="text-[84px] sm:text-[96px]" duration={1.2} />
                                <span className="text-[32px] sm:text-[36px]">m</span>
                              </>
                            )}
                          </div>

                          {/* Clean Accomplishment Highlight */}
                          {activeMetric && (
                            <motion.div
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/60 px-3 py-1.5 shadow-lg backdrop-blur-md"
                              style={{ boxShadow: `0 4px 20px ${glowColor}` }}
                            >
                              <span className="font-mono text-xs font-bold text-ink tracking-tight uppercase">
                                {activeMetric}
                              </span>
                            </motion.div>
                          )}

                          <div className="t-display mt-2 line-clamp-2 text-title-2 font-bold text-ink drop-shadow-md">
                            {isPeriod ? "Your summary" : subtitleText}
                          </div>
                        </div>

                        {/* Bottom Stats Matrix */}
                        <div className="relative z-10">
                          <div className="grid grid-cols-2 gap-x-5 border-t border-white/10">
                            <div className="border-b border-white/10"><Stat label="Tasks" value={tasksCompleted} /></div>
                            <div className="border-b border-white/10"><Stat label={isPeriod ? "Missions" : "Streak"} value={isPeriod ? recapData.missionsCompleted ?? 0 : `${streakVal}d`} /></div>
                            <Stat label="Category" value={categoryVal} />
                            <Stat label={fourthLabel} value={fourthValue} />
                          </div>

                          {/* Clean Footer */}
                          <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-caption text-ink-3 mt-2">
                            <span className="font-medium text-ink-2">lockin.top</span>
                            <span className="tabular text-[11px] text-ink-3">{date}</span>
                          </div>
                        </div>

                        {/* Glare + one-time sheen */}
                        <motion.div className="pointer-events-none absolute inset-0 z-50 rounded-sm mix-blend-overlay" style={{ background: glareBackgroundFront, opacity: 0.5 }} />
                        <motion.div
                          className="pointer-events-none absolute inset-y-0 z-50 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                          initial={{ x: "-120%" }}
                          animate={{ x: "320%" }}
                          transition={{ delay: 0.6, duration: 1.1, ease: "easeInOut" }}
                        />
                      </>
                    )}
                  </div>

                  {/* ───────── BACK ───────── */}
                  <div
                    className={`relative flex flex-col overflow-hidden rounded-sm border p-7 text-left shadow-lift sm:p-8 ${borderStyle}`}
                    style={{ background: cardBg, position: "absolute", inset: 0, ...faceStyle(isFlipped), transform: "rotateY(180deg)" }}
                  >
                    {/* Ambient radiant metallic glow */}
                    <div
                      className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full blur-3xl opacity-75"
                      style={{ background: glowColor }}
                      aria-hidden="true"
                    />
                    <div className="relative z-10 flex items-start justify-between">
                      <span className="text-footnote font-semibold text-ink">Reflection</span>
                      <span className="rounded-sm border px-2.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: tierColor, color: tierColor }}>
                        {tierName}
                      </span>
                    </div>

                    <div className="relative z-10 my-5 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-none">
                      {isFailed && (
                        <div className="rounded-xl border border-signal/70 bg-surface p-3.5">
                          <p className="text-headline text-crimson">Crash logged</p>
                          <p className="mt-0.5 text-footnote text-ink-2">Left early with nothing done. 5 {POINTS_NAME} lost.</p>
                        </div>
                      )}
                      {activeMetric && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] font-bold text-crimson tracking-wider uppercase">Key Output</p>
                          <p className="mt-1 font-mono text-subhead font-bold text-ink">{activeMetric}</p>
                        </div>
                      )}
                      {reflectionText && (
                        <div>
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3">
                            <Quote className="h-3.5 w-3.5" style={{ color: tierColor }} /> How it went
                          </p>
                          <p className="mt-2 text-subhead leading-relaxed text-ink">&ldquo;{reflectionText}&rdquo;</p>
                        </div>
                      )}
                      {lessonsLearned && (
                        <div>
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3">
                            <BookOpen className="h-3.5 w-3.5" style={{ color: tierColor }} /> Next time
                          </p>
                          <p className="mt-2 text-subhead leading-relaxed text-ink-2">{lessonsLearned}</p>
                        </div>
                      )}
                      {currentPhoto && (
                        <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10">
                          <img src={currentPhoto} alt="Session proof" className="h-full w-full object-cover" />
                        </div>
                      )}
                      {link && (
                        <a
                          href={link.startsWith("http") ? link : `https://${link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 text-subhead text-gold transition-colors hover:bg-black/60"
                        >
                          {link}
                        </a>
                      )}
                      {!reflectionText && !lessonsLearned && !currentPhoto && !link && !isFailed && !activeMetric && (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                          <LockinMark size={80} color={tierColor} />
                          <p className="t-display mt-5 text-title-2 text-ink">Showed up.</p>
                          <p className="mt-1 text-subhead text-ink-3">No notes this time.</p>
                        </div>
                      )}
                    </div>

                    <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3 text-caption text-ink-3">
                      <div className="flex items-center gap-1.5 font-medium tracking-tight text-ink-2">
                        <span>lockin.top</span>
                        <span className="text-ink-4">/</span>
                        <span className="tabular text-[11px] text-ink-3">#{recapData.shareId ? recapData.shareId.slice(0, 8) : "lockin"}</span>
                      </div>
                      <span className="tabular text-[11px] text-ink-3">{date}</span>
                    </div>
                    <motion.div className="pointer-events-none absolute inset-0 z-50 rounded-sm mix-blend-overlay" style={{ background: glareBackgroundBack, opacity: 0.4 }} />
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* ─── Interactive Metric / Output Highlight Bar ─── */}
            <div className="relative z-20 mt-3 w-full space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-crimson" /> Highlight Output
                </span>
                {activeMetric && (
                  <button
                    type="button"
                    onClick={() => { setActiveMetric(""); setIsEditingMetric(false); }}
                    className="text-[10px] uppercase tracking-wider text-ink-4 hover:text-ink-2"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick chips scroller */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                {["8 questions", "5.0 km run", "Back & biceps", "4 PRs merged", "Unit 1 & 2", "100 pushups"].map((chip) => {
                  const isSelected = activeMetric.toLowerCase().includes(chip.toLowerCase());
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setActiveMetric(chip);
                        setIsEditingMetric(false);
                      }}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                        isSelected
                          ? "border-crimson bg-crimson/20 text-ink font-semibold"
                          : "border-line bg-surface/80 text-ink-3 hover:border-ink/40 hover:text-ink"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingMetric(!isEditingMetric);
                    setTempMetric(activeMetric);
                  }}
                  className="shrink-0 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] font-medium text-ink-3 hover:text-ink hover:border-ink/40"
                >
                  + Custom
                </button>
              </div>

              {isEditingMetric && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={tempMetric}
                    onChange={(e) => setTempMetric(e.target.value)}
                    placeholder="e.g. 10 leetcode, bench 80kg..."
                    className="h-9 flex-1 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink placeholder:text-ink-4 focus:border-crimson focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setActiveMetric(tempMetric.trim());
                        setIsEditingMetric(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMetric(tempMetric.trim());
                      setIsEditingMetric(false);
                    }}
                    className="h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-bg transition-colors hover:bg-ink-2"
                  >
                    Set
                  </button>
                </div>
              )}
            </div>

            {/* ─── Actions Bar ─── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={isTrashing ? { opacity: 0 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 26 }}
              className="relative z-10 mt-3 flex w-full gap-2"
            >
              {isFailed ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setIsTrashing(true)}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-signal/70 bg-surface text-subhead font-semibold text-ink transition-colors hover:bg-signal/25"
                >
                  <Trash2 className="h-[18px] w-[18px]" /> Trash card
                </motion.button>
              ) : cardMode === "sticker" && isTransparentSticker ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCopySticker}
                  disabled={saving}
                  className="btn-primary h-12 flex-1 gap-2"
                >
                  {copiedSticker ? <Check className="h-[18px] w-[18px] text-success" /> : <Copy className="h-[18px] w-[18px]" />}
                  {copiedSticker ? "Copied sticker" : exporting === "sticker" ? "Rendering..." : "Copy sticker"}
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleExport(cardMode === "metallic" ? "metallic" : "photo")}
                  disabled={saving || (cardMode === "sticker" && !currentPhoto)}
                  className="btn-primary h-12 flex-1 gap-2 disabled:opacity-50"
                >
                  <Download className="h-[18px] w-[18px]" />
                  {saving ? "Rendering..." : cardMode === "metallic" ? "Save card" : currentPhoto ? "Save photo version" : "Add a photo first"}
                </motion.button>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const text = `*${subtitleText}* on LOCKIN\n${statusText} · ${hours > 0 ? `${hours}h ` : ""}${mins}m locked in${activeMetric ? ` · ${activeMetric}` : ""}${tasksCompleted ? ` · ${tasksCompleted} tasks` : ""}${streakVal ? ` · ${streakVal}-day streak` : ""}\n\nLock in: ${typeof window !== "undefined" ? window.location.origin : ""}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                }}
                aria-label="Share on WhatsApp"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366] transition-colors hover:bg-[#25D366]/20"
              >
                <MessageCircle className="h-5 w-5" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                aria-label={copied ? "Link copied" : "Copy share link"}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 transition-colors hover:text-ink"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={copied ? "ok" : "share"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="flex">
                    {copied ? <Check className="h-5 w-5 text-success" /> : <Share2 className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </motion.div>

            {/* Save any version, whichever one is on screen. */}
            {!isFailed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={isTrashing ? { opacity: 0 } : { opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="relative z-10 mt-2 flex w-full items-center gap-1.5"
              >
                <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-ink-3">Save PNG</span>
                {([
                  { kind: "metallic", label: "Card" },
                  { kind: "sticker", label: "Sticker" },
                  { kind: "photo", label: "Photo" }
                ] as const).map((o) => (
                  <button
                    key={o.kind}
                    type="button"
                    onClick={() => handleExport(o.kind)}
                    disabled={saving || (o.kind === "photo" && !currentPhoto)}
                    title={o.kind === "photo" && !currentPhoto ? "Add a photo in the Photo tab first" : undefined}
                    className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-surface text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exporting === o.kind ? "..." : o.label}
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Portal>
  );
}
