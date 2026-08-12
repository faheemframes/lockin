"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Flame,
  ChevronRight,
  ChevronLeft,
  Zap,
  Users,
  Timer,
  Star,
  Trophy,
  Search,
  AlertTriangle,
  Check,
  Instagram,
  Github,
  MapPin,
  BookOpen,
  Code,
  Dumbbell,
  Gamepad2,
  Palette,
  PenLine,
  Heart,
  Mail,
  KeyRound,
  X
} from "lucide-react";
import { Input } from "./ui/input";
import { User, InterestCategory } from "../app/types";

import { supabase } from "../lib/supabase";
import { getErrorMessage, isProfileIncomplete } from "../lib/api";

interface ProfileGateProps {
  onReady: (user: User) => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
}

interface Campus {
  id: number;
  name: string;
  location?: string;
}





const TUTORIAL_STEPS = [
  {
    icon: Zap,
    color: "text-cherryRed",
    bg: "bg-cherryRed/10 border-cherryRed/30",
    glow: "shadow-[0_0_30px_rgba(129,1,0,0.2)]",
    title: "Launch or Accept",
    body: "Spot a mission on your campus feed. Swipe to Accept or launch your own runway for others to join.",
  },
  {
    icon: Timer,
    color: "text-white",
    bg: "bg-white/8 border-white/20",
    glow: "shadow-[0_0_30px_rgba(255,255,255,0.08)]",
    title: "Focus Lock",
    body: "Meet up. Creator shares a 4-digit OTP. Participant enters it to start a 15–90 min Focus Lock countdown. No distractions.",
  },
  {
    icon: Star,
    color: "text-cherryRed",
    bg: "bg-cherryRed/10 border-cherryRed/30",
    glow: "shadow-[0_0_30px_rgba(129,1,0,0.2)]",
    title: "Vibe Check",
    body: "Timer done? Rate each other's vibe. W Vibe earns +2 Aura. L Vibe costs -1. Honest vibes only.",
  },
  {
    icon: Trophy,
    color: "text-cherryRed",
    bg: "bg-cherryRed/10 border-cherryRed/30",
    glow: "shadow-[0_0_30px_rgba(129,1,0,0.2)]",
    title: "Aura & Leaderboard",
    body: "Aura Points stack up with every completed mission. Climb your campus leaderboard. Reputation is earned, not claimed.",
  },
];

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

export default function ProfileGate({ onReady, api }: ProfileGateProps) {
  const [step, setStep] = useState(0); // 0=splash, 1=campus, 2=profile, 3=socials, 4=tutorial
  const [direction, setDirection] = useState(1);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusSearch, setCampusSearch] = useState("");
  const [showCampusList, setShowCampusList] = useState(false);
  const [tutorialSlide, setTutorialSlide] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [interestCategories, setInterestCategories] = useState<InterestCategory[]>([]);
  const [devOtp, setDevOtp] = useState("");
  const [tempUserId, setTempUserId] = useState<number | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  const [form, setForm] = useState({
    email: "",
    password: "",
    otpCode: "",
    campusId: "" as string | number,
    campusName: "",
    college_id: "",
    department: "",
    name: "",
    bio: "",
    location: "",
    instagram: "",
    github: "",
    interests: [] as string[],
  });

  const [validation, setValidation] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    api("/missions/campuses")
      .then((data: Campus[]) => setCampuses(data))
      .catch(() => {
        setCampuses([
          { id: 1, name: "SRM IST, Kattankulathur (KTR)", location: "Chennai, TN" },
          { id: 2, name: "SRM IST, Ramapuram", location: "Chennai, TN" },
          { id: 3, name: "IIT Madras", location: "Chennai, TN" },
          { id: 4, name: "VIT Vellore", location: "Vellore, TN" },
          { id: 5, name: "BITS Pilani", location: "Rajasthan" },
          { id: 6, name: "IIIT Hyderabad", location: "Hyderabad, TG" },
          { id: 7, name: "DTU Delhi", location: "Delhi" },
          { id: 8, name: "Manipal Institute of Technology", location: "Manipal, KA" },
          { id: 9, name: "Taylor's University", location: "Subang Jaya, Selangor" },
        ]);
      });

    api("/interests/categories")
      .then((data: InterestCategory[]) => setInterestCategories(data))
      .catch(() => {
        setInterestCategories([
          { id: 1, name: "Coding", emoji: null, color: "#3b82f6" },
          { id: 2, name: "AI", emoji: null, color: "#8b5cf6" },
          { id: 3, name: "Startups", emoji: null, color: "#f59e0b" },
          { id: 4, name: "Hackathons", emoji: null, color: "#ef4444" },
          { id: 5, name: "Open Source", emoji: null, color: "#10b981" },
          { id: 6, name: "Design", emoji: null, color: "#ec4899" },
          { id: 7, name: "Content Creation", emoji: null, color: "#f97316" },
          { id: 8, name: "Fitness", emoji: null, color: "#14b8a6" },
          { id: 9, name: "Study Sessions", emoji: null, color: "#6366f1" },
          { id: 10, name: "Research", emoji: null, color: "#0ea5e9" },
          { id: 11, name: "Placements", emoji: null, color: "#e11d48" },
          { id: 12, name: "Competitive Programming", emoji: null, color: "#eab308" },
          { id: 13, name: "Reading", emoji: null, color: "#a855f7" },
          { id: 14, name: "Languages", emoji: null, color: "#06b6d4" },
          { id: 15, name: "Career", emoji: null, color: "#64748b" },
          { id: 16, name: "Projects", emoji: null, color: "#f43f5e" },
          { id: 17, name: "Networking", emoji: null, color: "#22c55e" },
          { id: 18, name: "Events", emoji: null, color: "#d946ef" },
          { id: 19, name: "Other", emoji: null, color: "#a1a1aa" }
        ]);
      });
  }, []);

  async function resumeOnboarding(user: User & { incomplete?: boolean }) {
    if (!isProfileIncomplete(user)) return false;
    setTempUserId(user.id);
    setForm((f) => ({
      ...f,
      email: user.email || f.email,
      campusId: "",
      campusName: user.college || "",
      name: user.name || f.name,
      department: user.department || "",
    }));
    setDirection(1);
    setStep(3);
    return true;
  }

  // Resume incomplete onboarding after reload / email verification redirect.
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    async function bootstrapIncompleteSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled || tempUserId) return;

        const syncRes = await api("/auth/profile", { method: "POST" });
        if (!cancelled && syncRes?.user) {
          await resumeOnboarding(syncRes.user);
        }
      } catch (e) {
        console.warn("[ProfileGate] Could not resume incomplete session:", e);
      }
    }

    bootstrapIncompleteSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        if (tempUserId) return;
        try {
          const syncRes = await api("/auth/profile", { method: "POST" });
          if (syncRes?.user) {
            await resumeOnboarding(syncRes.user);
          }
        } catch (e) {
          console.warn("[ProfileGate] Could not sync profile on auth change:", e);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempUserId]);

  const filteredCampuses = campusSearch.trim()
    ? campuses.filter((c) =>
        c.name.toLowerCase().includes(campusSearch.toLowerCase()) ||
        (c.location || "").toLowerCase().includes(campusSearch.toLowerCase())
      )
    : campuses;

  async function handleAuthSubmit() {
    if (!form.email || !form.email.includes("@")) {
      setValidation({ email: "Valid student email is required." });
      return;
    }
    if (mode !== "forgot" && (!form.password || form.password.length < 6)) {
      setValidation({ password: "Password must be at least 6 characters." });
      return;
    }

    setBusy(true);
    setError("");
    setValidation({});

    try {
      // 1. Verify email domain matches a supported college
      const checkRes = await api(`/auth/check-domain?email=${encodeURIComponent(form.email)}`);
      if (!checkRes.success) {
        setError(getErrorMessage(checkRes.error, "Domain not supported."));
        setBusy(false);
        return;
      }

      if (!supabase) throw new Error("Supabase is not initialized.");

      const email = form.email.trim().toLowerCase();

      if (mode === "signup") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (signUpErr) throw signUpErr;

        if (data.user && !data.session) {
          // Confirmation email sent via Resend (Supabase custom SMTP)
          setStep(2);
        } else if (data.session) {
          const syncRes = await api("/auth/profile", { method: "POST" });
          if (await resumeOnboarding(syncRes.user)) {
            // continue campus onboarding
          } else {
            localStorage.setItem("lockin_user_id", String(syncRes.user.id));
            onReady(syncRes.user);
          }
        }
      } else if (mode === "login") {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        });

        if (signInErr) throw signInErr;

        if (data.session) {
          const syncRes = await api("/auth/profile", { method: "POST" });
          if (await resumeOnboarding(syncRes.user)) {
            // continue campus onboarding
          } else {
            localStorage.setItem("lockin_user_id", String(syncRes.user.id));
            onReady(syncRes.user);
          }
        }
      } else if (mode === "forgot") {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (resetErr) throw resetErr;

        setStep(2);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Authentication operation failed."));
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    if (step === 1) {
      await handleAuthSubmit();
      return;
    }
    if (step === 2) {
      setMode("login");
      setStep(1);
      return;
    }
    if (!validateStep(step)) return;
    setDirection(1);
    setStep((s) => s + 1);
    setError("");
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
    setError("");
    setValidation({});
  }

  function validateStep(s: number) {
    const errs: { [key: string]: string } = {};
    if (s === 3) {
      if (!form.campusId && form.campusName.trim().length < 3)
        errs.campusId = "Select a campus or type your college name (min 3 chars).";
      const reg = form.college_id.trim().toUpperCase();
      if (!reg || reg.length < 6) errs.college_id = "Enter your college student ID/roll number.";
      if (form.department.trim().length < 2) errs.department = "Enter your department & year.";
    }
    if (s === 4) {
      if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters.";
    }
    setValidation(errs);
    return Object.keys(errs).length === 0;
  }

  function toggleInterest(id: string) {
    React.startTransition(() => {
      setForm((f) => ({
        ...f,
        interests: f.interests.includes(id)
          ? f.interests.filter((i) => i !== id)
          : [...f.interests, id],
      }));
    });
  }

  async function submit() {
    let resolvedUserId = tempUserId;

    // If tempUserId was lost (e.g. page reload after email verification),
    // try to recover it from the active Supabase session.
    if (!resolvedUserId && supabase) {
      try {
        const syncRes = await api("/auth/profile", { method: "POST" });
        if (syncRes?.user?.id) {
          resolvedUserId = syncRes.user.id;
          setTempUserId(resolvedUserId);
        }
      } catch (e) {
        console.warn("[submit] Could not recover userId:", e);
      }
    }

    if (!resolvedUserId) {
      setError("Session expired. Please log in again.");
      setStep(1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const college = form.campusName || "Campus";
      const interestsStr = form.interests
        .map((id) => {
          const cat = interestCategories.find((c) => String(c.id) === id);
          return cat ? cat.name : id;
        })
        .join(", ");

      const user = await api(`/users/${resolvedUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          college: college,
          collegeId: form.campusId ? Number(form.campusId) : null,
          department: form.department.trim(),
          bio: form.bio.trim(),
          instagram: form.instagram.trim(),
          github: form.github.trim(),
          interests: interestsStr,
          location: form.location,
        }),
      });

      try {
        await api("/interests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            categoryIds: form.interests.map(Number)
          })
        });
      } catch (interestErr) {
        console.error("Failed to save relational interests:", interestErr);
      }

      localStorage.setItem("lockin_user_id", String(user.id));
      onReady(user);
    } catch (err: any) {
      setError(getErrorMessage(err, "Registration failed. Try again."));
      setBusy(false);
    }
  }

  const totalSteps = 7; // 0-6

  return (
    <div className="relative min-h-screen w-full overflow-y-auto flex flex-col items-center justify-start md:justify-center py-8 px-4"
      style={{ background: "linear-gradient(160deg, #141110 0%, #0D0A09 100%)" }}
    >
      {/* Race stripe top */}
      <div className="race-stripe pointer-events-none absolute left-0 right-0 top-0 h-[2px] opacity-80 z-50" />
      {/* Background glow blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cherryRed/[0.09] blur-[140px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-luxuryMaroon/[0.09] blur-[140px]" />
        <div className="grid-noise absolute inset-0 opacity-80" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto my-auto">
        {/* Progress indicator for profile onboarding steps 3-5 */}
        {step >= 3 && step <= 5 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-6"
          >
            <button
              onClick={goBack}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 flex gap-1.5">
              {[3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    step >= s ? "bg-cherryRed" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-black tracking-widest text-zinc-600 uppercase">
              {step - 2}/3
            </span>
          </motion.div>
        )}

        {/* Back button for email/otp steps (steps 1 & 2) */}
        {(step === 1 || step === 2) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-6"
          >
            <button
              onClick={goBack}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
              {step === 1 ? "Email Verification" : "OTP Code"}
            </span>
          </motion.div>
        )}

        {/* Global Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-cherryRed/35 bg-cherryRed/10 p-3 text-xs font-semibold text-[#ffa3a3] flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-cherryRed animate-bounce" />
            <span>{typeof error === "string" ? error : getErrorMessage(error)}</span>
          </motion.div>
        )}

        {/* Step content */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && (
              <motion.div
                key="splash"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <SplashStep onNext={goNext} />
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="email"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <EmailStep
                  form={form}
                  setForm={setForm}
                  validation={validation}
                  onNext={goNext}
                  busy={busy}
                  mode={mode}
                  setMode={setMode}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="otp"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <OtpStep
                  form={form}
                  setForm={setForm}
                  validation={validation}
                  onNext={goNext}
                  busy={busy}
                  mode={mode}
                  setMode={setMode}
                />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="campus"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <CampusStep
                  form={form}
                  setForm={setForm}
                  validation={validation}
                  campuses={filteredCampuses}
                  campusSearch={campusSearch}
                  setCampusSearch={setCampusSearch}
                  showCampusList={showCampusList}
                  setShowCampusList={setShowCampusList}
                  onNext={goNext}
                />
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="profile"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <ProfileStep
                  form={form}
                  setForm={setForm}
                  validation={validation}
                  onNext={goNext}
                />
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="socials"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <SocialsStep
                  form={form}
                  setForm={setForm}
                  toggleInterest={toggleInterest}
                  onNext={goNext}
                  onBack={goBack}
                  interestCategories={interestCategories}
                />
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="tutorial"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <TutorialStep
                  tutorialSlide={tutorialSlide}
                  setTutorialSlide={setTutorialSlide}
                  onBack={goBack}
                  onSubmit={submit}
                  busy={busy}
                  error={error}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── STEP 0: SPLASH ──────────────────────────────────────────────── */
function SplashStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center space-y-7 pt-6">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 220, damping: 20 }}
        className="flex h-[88px] w-[88px] items-center justify-center rounded-[26px] border border-white/[0.09] bg-black/70 p-2 shadow-[0_0_60px_rgba(129,1,0,0.2),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md"
      >
        <img src="/logo.png" alt="LOCKIN Logo" className="h-full w-full object-contain" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="space-y-2"
      >
        <h1 className="text-[40px] font-display font-bold tracking-[0.06em] text-white leading-none">LOCKIN</h1>
        <p className="text-[13px] font-normal text-zinc-400 leading-relaxed max-w-[240px] mx-auto">
          Stop chatting. Start executing.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 gap-2 w-full text-left"
      >
        {[
          { icon: Zap, color: "text-cherryRed", text: "Accept missions from campus builders" },
          { icon: Timer, color: "text-zinc-300", text: "Focus Lock — prove the work is done" },
          { icon: Star, color: "text-cherryRed", text: "Rate the vibe, earn Aura points" },
          { icon: Trophy, color: "text-cherryRed", text: "Climb your campus leaderboard" },
        ].map(({ icon: Icon, color, text }, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.36 + i * 0.07 }}
            className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-4 py-3"
          >
            <Icon className={`h-[15px] w-[15px] shrink-0 ${color}`} />
            <span className="text-[12px] font-normal text-zinc-300">{text}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.68 }}
        onClick={onNext}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cherryRed/30 bg-cherryRed py-4 text-[13px] font-bold text-white shadow-[0_0_32px_rgba(210,4,45,.35)] transition-all hover:bg-cherryRed/90 active:scale-[0.97]"
      >
        <Flame className="h-4 w-4 fill-current" />
        Let's Lock In
      </motion.button>

      <p className="text-[10px] font-normal text-zinc-700 pb-2">Campus-only. No randos. Just builders.</p>
    </div>
  );
}

/* ─── STEP 1: CAMPUS & ACADEMICS ─────────────────────────────────── */
function CampusStep({
  form,
  setForm,
  validation,
  campuses,
  campusSearch,
  setCampusSearch,
  showCampusList,
  setShowCampusList,
  onNext,
}: any) {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed">
          Step 1 of 3
        </span>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white uppercase">
          Your Campus
        </h2>
        <p className="mt-1 text-xs text-zinc-500">Where are you building from?</p>
      </div>

      <div className="space-y-4">
        {/* Campus selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
            College / University
          </label>
          <div className="relative">
            <div
              className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition ${
                form.campusId
                  ? "border-cotton/40 bg-cotton/5 text-white"
                  : "border-white/10 bg-black/40 text-zinc-500"
              } ${validation.campusId ? "border-cherryRed/50" : ""}`}
              onClick={() => setShowCampusList(!showCampusList)}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <span className="flex-1 truncate text-xs">
                {form.campusName || "Search your college..."}
              </span>
              {form.campusName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm((f: any) => ({ ...f, campusId: "", campusName: "" }));
                  }}
                  className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronRight
                className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${showCampusList ? "rotate-90" : ""}`}
              />
            </div>

            <AnimatePresence>
              {showCampusList && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
                  style={{ transformOrigin: "top" }}
                  className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden"
                >
                  <div className="border-b border-white/5 p-2">
                    <input
                      autoFocus
                      value={campusSearch}
                      onChange={(e) => setCampusSearch(e.target.value)}
                      placeholder="Type to filter..."
                      className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder-zinc-600 outline-none"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {campuses.length === 0 && (
                      <p className="p-3 text-center text-[10px] text-zinc-600">No campuses found</p>
                    )}
                    {campuses.map((c: Campus) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setForm((f: any) => ({ ...f, campusId: c.id, campusName: c.name }));
                          setShowCampusList(false);
                          setCampusSearch("");
                        }}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                      >
                        <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-luxuryGold/60" />
                        <div>
                          <p className="text-xs font-semibold text-white">{c.name}</p>
                          {c.location && (
                            <p className="text-[10px] text-zinc-600">{c.location}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {validation.campusId && (
            <FieldError msg={validation.campusId} />
          )}
        </div>

        {/* Custom college fallback — shown only when nothing selected from list */}
        {!form.campusId && (
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
              Not listed? Type your college name
            </label>
            <Input
              value={form.campusName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f: any) => ({ ...f, campusName: e.target.value }))
              }
              placeholder="e.g. VIT Bhopal, Lovely Professional University..."
              className="h-11 border-white/10 bg-black/40 text-sm text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10"
            />
            <p className="text-[9px] text-zinc-600 leading-tight">
              Make sure spelling is exact. This is how your campus community will find you.
            </p>
          </div>
        )}

        {/* Registration Number */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
            Registration / Roll Number
          </label>
          <Input
            value={form.college_id}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f: any) => ({ ...f, college_id: e.target.value }))
            }
            placeholder="e.g. RA2211003010123"
            className={`h-11 border-white/10 bg-black/40 text-sm text-white placeholder-zinc-700 uppercase focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10 ${
              validation.college_id ? "border-cherryRed/50" : ""
            }`}
          />
          {validation.college_id && <FieldError msg={validation.college_id} />}
        </div>

        {/* Department & Year */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
            Department & Year
          </label>
          <Input
            value={form.department}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f: any) => ({ ...f, department: e.target.value }))
            }
            placeholder="e.g. CSE, 3rd Year"
            className={`h-11 border-white/10 bg-black/40 text-sm text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10 ${
              validation.department ? "border-cherryRed/50" : ""
            }`}
          />
          {validation.department && <FieldError msg={validation.department} />}
        </div>
      </div>

      <NextButton onClick={onNext} />
    </div>
  );
}

/* ─── STEP 2: PILOT PROFILE ──────────────────────────────────────── */
function ProfileStep({ form, setForm, validation, onNext }: any) {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed">
          Step 2 of 3
        </span>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white uppercase">
          Pilot Profile
        </h2>
        <p className="mt-1 text-xs text-zinc-500">Who are you? Make it count.</p>
      </div>

      <div className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
            Full Name
          </label>
          <Input
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f: any) => ({ ...f, name: e.target.value }))
            }
            placeholder="e.g. Faheem"
            className={`h-11 border-white/10 bg-black/40 text-sm text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10 ${
              validation.name ? "border-cherryRed/50" : ""
            }`}
          />
          {validation.name && <FieldError msg={validation.name} />}
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
              Short Bio
            </label>
            <span
              className={`text-[9px] font-bold ${
                form.bio.length > 140 ? "text-cherryRed" : "text-zinc-600"
              }`}
            >
              {form.bio.length}/150
            </span>
          </div>
          <textarea
            value={form.bio}
            onChange={(e) =>
              setForm((f: any) => ({ ...f, bio: e.target.value.slice(0, 150) }))
            }
            placeholder="What are you building? What do you vibe with?"
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10"
          />
        </div>

        {/* Meet Spot */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Preferred Meet Spot on Campus
          </label>
          <Input
            value={form.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f: any) => ({ ...f, location: e.target.value }))
            }
            placeholder="e.g. Main Library, Block B Canteen, IT Lab"
            className="h-11 border-white/10 bg-black/40 text-sm text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10"
          />
        </div>

      </div>

      <NextButton onClick={onNext} />
    </div>
  );
}

/* ─── STEP 3: SOCIALS & INTERESTS ────────────────────────────────── */
function SocialsStep({ form, setForm, toggleInterest, onNext, onBack, interestCategories }: any) {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed">
          Step 3 of 3
        </span>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white uppercase">
          Signal & Interests
        </h2>
        <p className="mt-1 text-xs text-zinc-500">Let people find you after the vibe check.</p>
      </div>

      <div className="space-y-4">
        {/* Instagram */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Instagram className="h-3 w-3" />
            Instagram <span className="text-zinc-600 normal-case font-medium">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold">@</span>
            <Input
              value={form.instagram}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f: any) => ({ ...f, instagram: e.target.value.replace("@", "") }))
              }
              placeholder="username"
              className="h-11 border-white/10 bg-black/40 pl-7 text-sm text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10"
            />
          </div>
        </div>

        {/* GitHub */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Github className="h-3 w-3" />
            GitHub <span className="text-zinc-600 normal-case font-medium">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold">@</span>
            <Input
              value={form.github}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f: any) => ({ ...f, github: e.target.value.replace("@", "") }))
              }
              placeholder="username"
              className="h-11 border-white/10 bg-black/40 pl-7 text-sm text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10"
            />
          </div>
        </div>

        {/* Focus Interests */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
            Focus Interests <span className="text-zinc-600 normal-case font-medium">(pick any)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {interestCategories.map((cat: any) => {
              const selected = form.interests.includes(String(cat.id));
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleInterest(String(cat.id))}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
                    selected
                      ? "border-cherryRed bg-cherryRed/10 text-white"
                      : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                  style={{
                    borderColor: selected ? cat.color : undefined,
                    backgroundColor: selected ? `${cat.color}1c` : undefined,
                    color: selected ? cat.color : undefined
                  }}
                >
                  {cat.name}
                  {selected && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <NextButton onClick={onNext} label="See How It Works →" />
    </div>
  );
}

/* ─── STEP 4: TUTORIAL TOUR ──────────────────────────────────────── */
function TutorialStep({
  tutorialSlide,
  setTutorialSlide,
  onBack,
  onSubmit,
  busy,
  error,
}: any) {
  const slide = TUTORIAL_STEPS[tutorialSlide];
  const Icon = slide.icon;
  const isLast = tutorialSlide === TUTORIAL_STEPS.length - 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-boxRed">
            How it works
          </span>
          <h2 className="text-xl font-black tracking-tight text-white uppercase">
            The Runway Loop
          </h2>
        </div>
      </div>

      {/* Slide area */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/60">
        <AnimatePresence mode="wait">
          <motion.div
            key={tutorialSlide}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="p-6 space-y-4"
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${slide.bg} ${slide.glow}`}
            >
              <Icon className={`h-7 w-7 ${slide.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {tutorialSlide + 1} / {TUTORIAL_STEPS.length}
              </p>
              <h3 className="mt-1 text-lg font-black text-white">{slide.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{slide.body}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 pb-4">
          {TUTORIAL_STEPS.map((_, i) => {
            const colors = ["bg-cherryRed", "bg-white", "bg-cherryRed", "bg-cherryRed"];
            const activeColor = colors[i];
            const inactiveColor = i === 1 ? "bg-white/20" : "bg-cherryRed/20";
            return (
              <button
                key={i}
                onClick={() => setTutorialSlide(i)}
                className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
                  i === tutorialSlide ? activeColor : inactiveColor
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      {!isLast ? (
        <button
          onClick={() => setTutorialSlide((s: number) => s + 1)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-[0.97]"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}

      {error && (
        <p className="text-xs font-bold text-cherryRed bg-cherryRed/5 border border-cherryRed/20 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      {isLast && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onSubmit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cherryRed/35 bg-cherryRed py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(210,4,45,0.25)] transition-all hover:bg-cherryRed/95 active:scale-[0.97] disabled:opacity-50"
        >
          <Flame className="h-4 w-4 fill-current" />
          {busy ? "Activating Pilot..." : "Initialize Lock-In"}
        </motion.button>
      )}
    </div>
  );
}

/* ─── STEP 1: EMAIL VERIFICATION ──────────────────────────────────── */
function EmailStep({ form, setForm, validation, onNext, busy, mode, setMode }: any) {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed font-mono">
          {mode === "login" ? "Student Login" : mode === "signup" ? "Student Signup" : "Password Recovery"}
        </span>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white uppercase font-display">
          {mode === "login" ? "Welcome Back" : mode === "signup" ? "Create Account" : "Reset Password"}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 font-sans">
          {mode === "login" 
            ? "Log in with your college credentials." 
            : mode === "signup" 
              ? "Use your college email domain to unlock your campus feed." 
              : "Enter your email to receive a password reset link."}
        </p>
      </div>

      <div className="space-y-4">
        {/* Email input */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
            <Mail className="h-3.5 w-3.5" />
            College Email Address
          </label>
          <Input
            type="email"
            value={form.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f: any) => ({ ...f, email: e.target.value }))
            }
            placeholder="e.g. name@srmist.edu.in"
            className={`h-11 border-white/10 bg-black/40 text-xs text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10 ${
              validation.email ? "border-cherryRed/50" : ""
            }`}
          />
          {validation.email && <FieldError msg={validation.email} />}
        </div>

        {/* Password input (only shown for login and signup modes) */}
        {mode !== "forgot" && (
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
              <KeyRound className="h-3.5 w-3.5" />
              Password
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f: any) => ({ ...f, password: e.target.value }))
              }
              placeholder="Min. 6 characters"
              className={`h-11 border-white/10 bg-black/40 text-xs text-white placeholder-zinc-700 focus:border-cherryRed focus:ring-2 focus:ring-cherryRed/10 ${
                validation.password ? "border-cherryRed/50" : ""
              }`}
            />
            {validation.password && <FieldError msg={validation.password} />}
          </div>
        )}
      </div>

      {/* Button */}
      <button
        type="button"
        disabled={busy || !form.email || (mode !== "forgot" && !form.password)}
        onClick={onNext}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cherryRed/20 bg-cherryRed py-4 text-sm font-sans font-medium text-white shadow-[0_0_30px_rgba(210,4,45,0.25)] transition-all hover:bg-cherryRed/95 active:scale-[0.97] disabled:opacity-50"
      >
        {busy 
          ? "Processing..." 
          : mode === "login" 
            ? "Log In →" 
            : mode === "signup" 
              ? "Sign Up →" 
              : "Send Reset Link →"}
      </button>

      {/* Mode selectors */}
      <div className="flex flex-col gap-2.5 items-center pt-2">
        {mode === "login" ? (
          <>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white transition font-mono"
            >
              Don't have an account? Sign Up
            </button>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition font-mono"
            >
              Forgot Password?
            </button>
          </>
        ) : mode === "signup" ? (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white transition font-mono"
          >
            Already have an account? Log In
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white transition font-mono"
          >
            Back to Log In
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── STEP 2: EMAIL VERIFICATION CHECK INBOX ──────────────────────── */
function OtpStep({ form, onNext, busy, mode, setMode }: any) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cherryRed/30 bg-cherryRed/10 shadow-[0_0_30px_rgba(129,1,0,0.2)] mb-4">
          <Mail className="h-7 w-7 text-cherryRed animate-pulse" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-cherryRed font-mono">
          {mode === "forgot" ? "Check Email" : "Verification Required"}
        </span>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white uppercase font-display">
          {mode === "forgot" ? "Reset Link Sent" : "Verify Student Email"}
        </h2>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-[280px] mx-auto font-sans">
          {mode === "forgot"
            ? `We have sent a secure password reset link to ${form.email}. Please follow the link in your inbox to reset your password.`
            : `We have sent a verification confirmation link to ${form.email}. Please click the link to verify your email and unlock your campus feed.`}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setMode("login");
          onNext(); // Will trigger goNext, going back to Login
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 text-xs font-display font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-[0.97]"
      >
        Back to Log In
      </button>
    </div>
  );
}

/* ─── SHARED HELPERS ─────────────────────────────────────────────── */
function NextButton({
  onClick,
  label = "Continue",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cherryRed/35 bg-cherryRed py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(210,4,45,0.25)] transition-all hover:bg-cherryRed/95 active:scale-[0.97]"
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-boxRed">
      <AlertTriangle className="h-3 w-3" />
      {msg}
    </span>
  );
}
