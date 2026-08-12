"use client";

import React, { useEffect, useRef, useState } from "react";

export type TimerAnchor = {
  missionId: number;
  /** Target countdown length in seconds; 0 = stopwatch */
  durationSec: number;
  /** Absolute end timestamp for countdown mode while running */
  endAt: number | null;
  /** Absolute start timestamp for stopwatch mode while running */
  startedAt: number | null;
  /** Frozen remaining seconds when countdown is paused */
  pausedLeft: number | null;
  /** Accumulated seconds when stopwatch is paused */
  accumulatedSec: number;
  running: boolean;
};

export function createCountdownAnchor(missionId: number, durationSec: number, running = true): TimerAnchor {
  return {
    missionId,
    durationSec,
    endAt: running ? Date.now() + durationSec * 1000 : null,
    startedAt: null,
    pausedLeft: running ? null : durationSec,
    accumulatedSec: 0,
    running,
  };
}

export function createStopwatchAnchor(missionId: number, running = true): TimerAnchor {
  return {
    missionId,
    durationSec: 0,
    endAt: null,
    startedAt: running ? Date.now() : null,
    pausedLeft: null,
    accumulatedSec: 0,
    running,
  };
}

export function getDisplayedSeconds(anchor: TimerAnchor, now = Date.now()): number {
  if (anchor.durationSec > 0) {
    if (anchor.running && anchor.endAt) {
      return Math.max(0, Math.ceil((anchor.endAt - now) / 1000));
    }
    return Math.max(0, anchor.pausedLeft ?? anchor.durationSec);
  }

  if (anchor.running && anchor.startedAt) {
    return anchor.accumulatedSec + Math.floor((now - anchor.startedAt) / 1000);
  }
  return Math.max(0, anchor.accumulatedSec);
}

export function getElapsedSeconds(anchor: TimerAnchor, now = Date.now()): number {
  if (anchor.durationSec > 0) {
    return Math.max(0, anchor.durationSec - getDisplayedSeconds(anchor, now));
  }
  return getDisplayedSeconds(anchor, now);
}

export function toggleTimerRunning(anchor: TimerAnchor): TimerAnchor {
  const now = Date.now();
  if (anchor.running) {
    if (anchor.durationSec > 0) {
      return {
        ...anchor,
        running: false,
        endAt: null,
        pausedLeft: getDisplayedSeconds(anchor, now),
      };
    }
    return {
      ...anchor,
      running: false,
      startedAt: null,
      accumulatedSec: getDisplayedSeconds(anchor, now),
    };
  }

  if (anchor.durationSec > 0) {
    const left = anchor.pausedLeft ?? anchor.durationSec;
    return {
      ...anchor,
      running: true,
      pausedLeft: null,
      endAt: now + left * 1000,
    };
  }

  return {
    ...anchor,
    running: true,
    startedAt: now,
  };
}

export function formatFocusTime(totalSecs: number) {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

type PersistedTimer = {
  missionId: number;
  duration: number;
  timeLeft: number;
  running: boolean;
  lastSaved: number;
};

export function persistTimer(userId: number, anchor: TimerAnchor | null) {
  const key = `lockin_timer_${userId}`;
  if (!anchor) {
    localStorage.removeItem(key);
    return;
  }
  const payload: PersistedTimer = {
    missionId: anchor.missionId,
    duration: anchor.durationSec,
    timeLeft: getDisplayedSeconds(anchor),
    running: anchor.running,
    lastSaved: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

export function readPersistedTimer(userId: number): PersistedTimer | null {
  const raw = localStorage.getItem(`lockin_timer_${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return null;
  }
}

export function anchorFromPersisted(state: PersistedTimer): TimerAnchor {
  let timeLeft = state.timeLeft;
  if (state.running) {
    const elapsed = Math.floor((Date.now() - state.lastSaved) / 1000);
    if (state.duration > 0) {
      timeLeft = Math.max(0, state.timeLeft - elapsed);
    } else {
      timeLeft = state.timeLeft + elapsed;
    }
  }

  if (state.duration > 0) {
    const running = state.running && timeLeft > 0;
    return {
      missionId: state.missionId,
      durationSec: state.duration,
      endAt: running ? Date.now() + timeLeft * 1000 : null,
      startedAt: null,
      pausedLeft: running ? null : timeLeft,
      accumulatedSec: 0,
      running,
    };
  }

  return {
    missionId: state.missionId,
    durationSec: 0,
    endAt: null,
    startedAt: state.running ? Date.now() : null,
    pausedLeft: null,
    accumulatedSec: timeLeft,
    running: state.running,
  };
}

/** Isolated display — only this component re-renders on each tick */
export function FocusTimerDisplay({
  anchor,
  onComplete,
}: {
  anchor: TimerAnchor;
  onComplete?: () => void;
}) {
  const [seconds, setSeconds] = useState(() => getDisplayedSeconds(anchor));
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    const tick = () => {
      const next = getDisplayedSeconds(anchor);
      setSeconds(next);
      if (anchor.durationSec > 0 && anchor.running && next <= 0 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    tick();
    if (!anchor.running) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [anchor, onComplete]);

  return (
    <>
      <span className="text-4xl sm:text-5xl font-black text-white tracking-widest tabular-nums leading-none">
        {formatFocusTime(seconds)}
      </span>
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-2">
        {anchor.durationSec > 0 ? "Countdown" : "Elapsed Time"}
      </span>
    </>
  );
}
