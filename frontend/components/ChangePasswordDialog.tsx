"use client";

import React, { useState } from "react";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { supabase } from "../lib/supabase";

/**
 * Set a new password while signed in. This is also the fallback when a reset
 * email never arrives: anyone who is still signed in on some device can change
 * their password here without any email.
 */
export default function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setPassword("");
      setConfirm("");
      setError("");
      setDone(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (!supabase) return setError("Sign-in isn't configured on this server.");
    setBusy(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      // Anyone else holding this account is signed out; this device stays in.
      await supabase.auth.signOut({ scope: "others" }).catch(() => {});
      setDone(true);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/different from the old/i.test(msg)) setError("Choose a password you haven't used before.");
      else if (/reauth/i.test(msg)) setError("For security, log out and use \"Forgot password\" to set a new one.");
      else setError(msg || "Couldn't update your password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{done ? "Password updated" : "Change password"}</DialogTitle>
          <DialogDescription>
            {done ? "You stay signed in here. Other devices were signed out." : "At least 6 characters. You stay signed in on this device."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <button type="button" onClick={() => close(false)} className="btn-primary mt-2 flex h-12 w-full items-center justify-center gap-2">
            <Check className="h-4 w-4" /> Done
          </button>
        ) : (
          <form onSubmit={save} className="mt-2 space-y-4">
            {error && (
              <p role="alert" className="rounded-xl border border-signal/70 bg-surface p-3 text-subhead text-ink">
                {error}
              </p>
            )}
            <div className="relative">
              <Input
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
            <Input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
            />
            <button type="submit" disabled={busy || !password || !confirm} className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Saving" : "Save password"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
