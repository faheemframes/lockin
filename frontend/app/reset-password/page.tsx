"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Input } from "../../components/ui/input";
import { KeyRound, AlertTriangle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (!supabase) throw new Error("Supabase client is not initialized.");
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password
      });

      if (updateErr) throw updateErr;

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center py-8 px-4"
      style={{ background: "linear-gradient(160deg, #141110 0%, #0D0A09 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cherryRed/[0.09] blur-[140px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-luxuryMaroon/[0.09] blur-[140px]" />
        <div className="grid-noise absolute inset-0 opacity-80" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/[0.09] bg-black/70 p-2 shadow-[0_0_30px_rgba(129,1,0,0.2)] backdrop-blur-md">
            <img src="/logo.png" alt="LOCKIN Logo" className="h-full w-full object-contain" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-black text-white uppercase tracking-wider font-display">New Password</h1>
            <p className="text-xs text-zinc-500">Reset your LOCKIN account access password.</p>
          </div>

          {error && (
            <div className="w-full rounded-xl border border-cherryRed/35 bg-cherryRed/10 p-3 text-xs font-semibold text-[#ffa3a3] flex items-center gap-2 text-left">
              <AlertTriangle className="h-4 w-4 shrink-0 text-cherryRed" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="w-full rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 flex items-center gap-2 text-left">
              <span className="shrink-0 text-emerald-400">✓</span>
              <span>Password updated successfully! Redirecting...</span>
            </div>
          )}

          <form onSubmit={handleReset} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
                <KeyRound className="h-3.5 w-3.5" />
                Enter New Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="h-11 border-white/10 bg-black/40 text-xs text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10"
              />
            </div>

            <button
              type="submit"
              disabled={busy || success}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cherryRed/20 bg-cherryRed py-4 text-sm font-sans font-medium text-white shadow-[0_0_30px_rgba(210,4,45,0.25)] transition-all hover:bg-cherryRed/95 active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? "Updating..." : "Save Password →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
