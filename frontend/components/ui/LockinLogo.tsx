"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/*
 * LOCKIN mark: antler "Y" with red apex. Paths are traced from
 * /new logo.jpeg (1080×1067 source), cropped to viewBox 230 260 620 520.
 */
const STEM = "M540 515 L540 768";
const BRANCHES = [
  "M540 515 C532 450 470 375 247 315", // left arm
  "M540 515 C548 450 610 375 833 315", // right arm
  "M470 386 Q440 332 400 295", // left inner tine
  "M610 386 Q640 332 680 295", // right inner tine
  "M362 352 Q338 312 312 273", // left outer tine
  "M718 352 Q742 312 768 273" // right outer tine
];
const APEX = "540,286 530,322 550,322";

interface MarkProps {
  size?: number;
  className?: string;
  color?: string;
  /** Draw the strokes on when mounted. */
  animate?: boolean;
  /** Seconds before the draw-on starts. */
  delay?: number;
  showTriangle?: boolean;
}

export function LockinMark({
  size = 28,
  className = "",
  color = "currentColor",
  animate = false,
  delay = 0,
  showTriangle = true
}: MarkProps) {
  const reduce = useReducedMotion();
  const draw = animate && !reduce;
  // Hairline in the source; thicken at small sizes so it never drops below ~1.4px.
  const stroke = Math.max(4, (620 / size) * 1.4);

  const pathProps = (i: number) =>
    draw
      ? {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { delay: delay + 0.35 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
            opacity: { delay: delay + 0.35 + i * 0.08, duration: 0.01 }
          }
        }
      : {};

  return (
    <svg
      viewBox="230 260 620 520"
      width={size}
      height={(size * 520) / 620}
      className={`shrink-0 overflow-visible ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d={STEM}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        {...(draw
          ? {
              initial: { pathLength: 0, opacity: 0 },
              animate: { pathLength: 1, opacity: 1 },
              transition: { pathLength: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }, opacity: { delay, duration: 0.01 } }
            }
          : {})}
      />
      {BRANCHES.map((d, i) => (
        <motion.path key={d} d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" {...pathProps(Math.floor(i / 2))} />
      ))}
      {showTriangle && (
        <motion.polygon
          points={APEX}
          fill="rgb(var(--signal))"
          {...(draw
            ? {
                initial: { opacity: 0, y: -40 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: delay + 1.05, type: "spring", stiffness: 520, damping: 18 }
              }
            : {})}
        />
      )}
    </svg>
  );
}

/** Back-compat name used across the app. */
export const StagEmblem = LockinMark;

interface WordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  glow?: boolean;
}

const WORD_SIZE = {
  sm: "text-subhead tracking-[0.24em]",
  md: "text-title-3 tracking-[0.26em]",
  lg: "text-[26px] tracking-[0.28em]",
  xl: "text-[40px] tracking-[0.3em]"
};

export function LockinWordmark({ className = "", size = "md", glow = false }: WordmarkProps) {
  return (
    <span
      className={`select-none font-sans font-medium leading-none text-ink ${WORD_SIZE[size]} ${className}`}
      aria-label="LOCKIN"
    >
      L<span className="text-signal">O</span>CKIN
    </span>
  );
}

interface LockinLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Horizontal = mark beside wordmark (chrome). Stacked = mark over wordmark (hero). */
  layout?: "horizontal" | "stacked";
  animate?: boolean;
  showSubtitle?: boolean;
}

const MARK_SIZE = { sm: 26, md: 32, lg: 72, xl: 132 };

export function LockinLogo({ size = "md", className = "", layout = "horizontal", animate = false, showSubtitle = false }: LockinLogoProps) {
  const reduce = useReducedMotion();
  const animateWord = animate && !reduce;

  if (layout === "stacked") {
    return (
      <div className={`flex flex-col items-center gap-6 ${className}`}>
        <LockinMark size={MARK_SIZE[size]} color="rgb(var(--ink))" animate={animate} />
        <motion.div
          initial={animateWord ? { opacity: 0, letterSpacing: "0.6em", filter: "blur(6px)" } : false}
          animate={{ opacity: 1, letterSpacing: "0.3em", filter: "blur(0px)" }}
          transition={{ delay: 1.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <LockinWordmark size={size} glow />
        </motion.div>
        {showSubtitle && <span className="t-label">Stop scrolling. Start executing.</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LockinMark size={MARK_SIZE[size]} color="rgb(var(--ink))" animate={animate} />
      <LockinWordmark size={size} />
    </div>
  );
}

export default LockinLogo;
