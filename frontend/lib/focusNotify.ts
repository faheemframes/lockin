/*
 * "Focus running" notification.
 *
 * What the web can and can't do (honest limits):
 * - Android Chrome / desktop: a persistent notification via the service
 *   worker, shown while a session runs, with the end time in it. It stays in
 *   the shade while the screen is locked.
 * - iPhone: notifications exist only when LOCKIN is added to the Home Screen
 *   (iOS 16.4+). In a normal Safari tab there is no Notification API, so this
 *   silently does nothing; the timer itself is still correct on return.
 * - No browser lets a web page fire a notification at an exact future time
 *   while it is frozen in the background, so the "done" alert fires when the
 *   page is alive (or when you come back). The running notification shows the
 *   end time so you know without opening the app.
 */

const TAG = "lockin-focus";
let registration: Promise<ServiceWorkerRegistration | null> | null = null;

function supported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return Promise.resolve(null);
  if (!registration) {
    registration = navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }
  return registration;
}

/** Call from a tap (start/resume): browsers only ask for permission on a user gesture. */
export async function prepareFocusNotifications() {
  if (!supported()) return;
  getRegistration();
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {}
  }
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export async function showFocusRunning(title: string, opts: { endsAt: number | null; startedAt: number; paused?: boolean }) {
  if (!supported() || Notification.permission !== "granted") return;
  const reg = await getRegistration();
  if (!reg) return;
  const body = opts.paused
    ? `${title} · paused`
    : opts.endsAt
      ? `${title} · ends at ${clock(opts.endsAt)}`
      : `${title} · stopwatch since ${clock(opts.startedAt)}`;
  try {
    await reg.showNotification("LOCKIN · focus running", {
      body,
      tag: TAG,
      silent: true,
      requireInteraction: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/?tab=active" }
    } as NotificationOptions);
  } catch {}
}

export async function showFocusDone(title: string) {
  if (!supported() || Notification.permission !== "granted") return;
  const reg = await getRegistration();
  if (!reg) return;
  try {
    await reg.showNotification("LOCKIN · session complete", {
      body: `Target reached for "${title}". Tap to finish and log it.`,
      tag: TAG,
      icon: "/icon-192.png",
      data: { url: "/?tab=active" }
    } as NotificationOptions);
  } catch {}
}

export async function clearFocusNotification() {
  if (!supported()) return;
  const reg = await getRegistration();
  if (!reg) return;
  try {
    const list = await reg.getNotifications({ tag: TAG });
    list.forEach((n) => n.close());
  } catch {}
}
