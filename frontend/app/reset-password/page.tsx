"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Input } from "../../components/ui/input";
import { KeyRound, AlertTriangle, Check, Eye, EyeOff, Loader2, Link2Off } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LockinLogo } from "../../components/ui/LockinLogo";

type Stage = "checking" | "ready" | "invalid" | "done";

// Supabase reports a bad or expired link in the URL hash (implicit flow) or query (PKCE flow).
function linkErrorFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  const code = params.get("error_code");
  if (code === "otp_expired") return "This reset link has expired or was already used.";
  return params.get("error_description")?.replace(/\+/g, " ") || "";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  // The form only works with a session from the recovery link, so confirm one exists first.
  useEffect(() => {
    const urlError = linkErrorFromUrl();
    if (!supabase) {
      setLinkError("Password reset isn't configured on this server.");
      setStage("invalid");
      return;
    }
    let settled = false;
    const ready = () => {
      if (settled) return;
      settled = true;
      setStage("ready");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) ready();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return ready();
      if (settled) return;
      settled = true;
      setLinkError(urlError || "This reset link is invalid or has expired.");
      setStage("invalid");
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (!supabase) throw new Error("Password reset isn't configured on this server.");
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // End every other session, in case the reset was prompted by someone else having access.
      await supabase.auth.signOut({ scope: "others" });

      setStage("done");
      setTimeout(() => router.push("/"), 2000);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/different from the old/i.test(msg)) setError("Choose a password you haven't used before.");
      else if (/session/i.test(msg)) {
        setLinkError("Your reset session ended. Request a new link.");
        setStage("invalid");
      } else setError(msg || "Couldn't update your password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-bg px-5 py-8">
      <div className="grid-noise pointer-events-none fixed inset-0" />
      <motion.div className="race-stripe pointer-events-none fixed inset-x-0 top-0 h-[2px]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1 }} />

      <div className="relative z-10 mx-auto w-full max-w-sm">
        <LockinLogo size="sm" />

        <AnimatePresence mode="wait" initial={false}>
          {stage === "checking" && (
            <motion.div key="checking" exit={{ opacity: 0 }} className="mt-12 flex items-center gap-3 text-subhead text-ink-2" role="status">
              <Loader2 className="h-5 w-5 animate-spin" /> Checking your reset link…
            </motion.div>
          )}

          {stage === "invalid" && (
            <motion.div key="invalid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-signal/70 bg-surface">
                <Link2Off className="h-6 w-6 text-crimson" />
              </div>
              <h1 className="t-display mt-6 text-large-title text-ink">Reset password</h1>
              <p className="mt-2 text-subhead text-ink-2">{linkError} Use your student email and a 6-digit recovery code to set a new password.</p>
              <button type="button" onClick={() => router.push("/?forgot=1")} className="mt-8 flex h-14 w-full items-center justify-center btn-primary">
                Reset with 6-digit code
              </button>
            </motion.div>
          )}

          {stage === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-12 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border border-success/40 bg-success/10"
              >
                <Check className="h-9 w-9 text-success" strokeWidth={2.5} />
              </motion.div>
              <h1 className="t-display mt-6 text-large-title text-ink">Password updated</h1>
              <p className="mt-2 text-subhead text-ink-2">Other devices were signed out. Taking you back in…</p>
            </motion.div>
          )}

          {stage === "ready" && (
            <motion.form key="form" onSubmit={handleReset} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-12 space-y-7">
              <div>
                <h1 className="t-display text-large-title text-ink">Set a new one</h1>
                <p className="mt-2 text-subhead text-ink-2">At least 6 characters.</p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -3, 0] }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2.5 overflow-hidden rounded-xl border border-signal/70 bg-surface p-3.5 text-subhead text-ink"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label htmlFor="new-pw" className="t-label flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> New password
                </label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="pr-12"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:text-ink"
                  >
                    {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                <div className="flex gap-1 pt-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${password.length >= [6, 10, 14][i] ? (i === 0 ? "bg-warn" : "bg-success") : "bg-line"}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-pw" className="t-label">Confirm password</label>
                <Input
                  id="confirm-pw"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                />
              </div>

              <motion.button
                type="submit"
                disabled={busy || !password || !confirm}
                whileTap={{ scale: 0.97 }}
                className="flex h-14 w-full items-center justify-center gap-2 disabled:opacity-50 btn-primary"
              >
                {busy && <Loader2 className="h-5 w-5 animate-spin" />}
                {busy ? "Saving" : "Save password"}
              </motion.button>

              {/* The recovery link already signed you in. Skipping keeps the old
                  password; you can change it any time from Profile → key icon. */}
              <button
                type="button"
                onClick={() => router.push("/")}
                disabled={busy}
                className="h-11 w-full text-subhead text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
              >
                Skip for now
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
