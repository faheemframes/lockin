import { supabase } from "./supabase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export const SOCKET_URL = API.replace(/\/api\/?$/, "");

/** Always return a human-readable string from API / Auth / unknown errors. */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (err == null) return fallback;

  if (typeof err === "string") {
    const trimmed = err.trim();
    return trimmed && trimmed !== "{}" ? trimmed : fallback;
  }

  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (msg && msg !== "{}" && msg !== "[object Object]") return msg;
  }

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["message", "error", "msg", "error_description", "error_code"]) {
      const value = o[key];
      if (typeof value === "string" && value.trim() && value.trim() !== "{}") {
        return value.trim();
      }
      if (value && typeof value === "object") {
        const nested = getErrorMessage(value, "");
        if (nested) return nested;
      }
    }
  }

  return fallback;
}

export async function api(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const { headers: optionHeaders, signal: _ignored, ...rest } = options;

  let authHeaders: Record<string, string> = {};
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeaders.Authorization = `Bearer ${session.access_token}`;
    }
  }

  try {
    const response = await fetch(`${API}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "true",
        ...authHeaders,
        ...(optionHeaders || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (
        (response.status === 401 &&
          data.error === "Invalid or expired session token.") ||
        (response.status === 404 && data.error === "User not found.")
      ) {
        if (typeof window !== "undefined") {
          if (supabase) {
            await supabase.auth.signOut().catch(() => {});
          }
          localStorage.removeItem("lockin_user_id");
          window.location.reload();
        }
      }
      throw new Error(getErrorMessage(data, `Request failed (${response.status})`));
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export function isProfileIncomplete(user: {
  department?: string | null;
  incomplete?: boolean;
} | null | undefined): boolean {
  if (!user) return true;
  if (user.incomplete) return true;
  return !user.department || String(user.department).trim().length < 2;
}
