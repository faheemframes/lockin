/*
 * Focus timer state, stored as absolute timestamps.
 *
 * The old timer kept "seconds left" and counted it down with setInterval.
 * Phones freeze or throttle background tabs and locked screens, so ticks were
 * lost and the timer drifted or stalled. Here nothing is counted: the time
 * shown is always computed from the wall clock and these anchors, so it is
 * correct the moment the page wakes up, after a reload, or after the browser
 * discarded the tab.
 */

export type FocusTimer = {
  missionId: number;
  title: string;
  /** Target length in seconds; 0 = open-ended stopwatch. */
  durationSec: number;
  /** When the session started (ms since epoch). */
  startedAt: number;
  /** When it was paused, or null while running. */
  pausedAt: number | null;
  /** Total time spent paused before the current pause (ms). */
  pausedMs: number;
};

const key = (userId: number | string) => `lockin_focus_timer_v2_${userId}`;
const LEGACY_KEY = (userId: number | string) => `lockin_timer_${userId}`;

export function startTimer(missionId: number, title: string, durationSec: number, startedAt = Date.now()): FocusTimer {
  return { missionId, title, durationSec: Math.max(0, Math.round(durationSec)), startedAt, pausedAt: null, pausedMs: 0 };
}

/** Focused seconds so far (pauses excluded), capped at the target. */
export function elapsedSec(t: FocusTimer, now = Date.now()): number {
  const end = t.pausedAt ?? now;
  const sec = Math.max(0, Math.floor((end - t.startedAt - t.pausedMs) / 1000));
  return t.durationSec > 0 ? Math.min(sec, t.durationSec) : sec;
}

/** What the clock shows: seconds left (countdown) or seconds elapsed (stopwatch). */
export function displaySec(t: FocusTimer, now = Date.now()): number {
  const e = elapsedSec(t, now);
  return t.durationSec > 0 ? Math.max(0, t.durationSec - e) : e;
}

export function isFinished(t: FocusTimer, now = Date.now()): boolean {
  return t.durationSec > 0 && elapsedSec(t, now) >= t.durationSec;
}

export function isRunning(t: FocusTimer, now = Date.now()): boolean {
  return t.pausedAt === null && !isFinished(t, now);
}

/** Wall-clock time the countdown ends, if running. */
export function endsAt(t: FocusTimer): number | null {
  if (t.durationSec <= 0 || t.pausedAt !== null) return null;
  return t.startedAt + t.pausedMs + t.durationSec * 1000;
}

export function pause(t: FocusTimer, now = Date.now()): FocusTimer {
  return t.pausedAt === null ? { ...t, pausedAt: now } : t;
}

export function resume(t: FocusTimer, now = Date.now()): FocusTimer {
  return t.pausedAt === null ? t : { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null };
}

/** Freeze a finished countdown exactly at its target. */
export function freezeAtEnd(t: FocusTimer): FocusTimer {
  const end = endsAt(t);
  return end === null ? t : { ...t, pausedAt: end };
}

export function saveTimer(userId: number | string, t: FocusTimer | null) {
  try {
    if (t) localStorage.setItem(key(userId), JSON.stringify(t));
    else localStorage.removeItem(key(userId));
    localStorage.removeItem(LEGACY_KEY(userId));
  } catch {}
}

export function loadTimer(userId: number | string): FocusTimer | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const t = JSON.parse(raw);
    const ok =
      t && Number.isFinite(t.missionId) && Number.isFinite(t.durationSec) && Number.isFinite(t.startedAt) &&
      Number.isFinite(t.pausedMs) && (t.pausedAt === null || Number.isFinite(t.pausedAt));
    return ok ? (t as FocusTimer) : null;
  } catch {
    return null;
  }
}

export function formatClock(totalSecs: number) {
  const s = Math.max(0, Math.floor(totalSecs));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
