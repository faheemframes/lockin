"use client";
import React from "react";
import { motion } from "framer-motion";
import { Flame, Activity, User as UserIcon, Rss } from "lucide-react";
import { User } from "../app/types";

interface ShellProps {
  children: React.ReactNode;
  tab?: string;
  setTab?: (tab: string) => void;
  user?: User | null;
}

export default function Shell({ children, tab, setTab, user }: ShellProps) {
  const isDesktopDashboard = !!user && !!tab && !!setTab;

  return (
    <div className="min-h-screen w-full bg-[#000000] flex items-center justify-center p-0 overflow-hidden">
      <main
        className={`relative flex text-white antialiased overflow-hidden
          ${isDesktopDashboard
            ? "h-screen w-full md:flex-row"
            : "h-screen w-full md:h-[min(860px,90vh)] md:max-w-[430px] md:flex-col md:rounded-[44px] md:border md:border-white/[0.07] md:shadow-[0_40px_120px_rgba(0,0,0,0.98)] md:ring-1 md:ring-white/[0.04]"
          }
        `}
        style={{ background: "linear-gradient(160deg, #09090b 0%, #000000 100%)" }}
      >
        {/* Grid noise */}
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-100 mix-blend-overlay z-0" />

        {/* Top accent stripe */}
        <div className="race-stripe pointer-events-none absolute left-0 right-0 top-0 h-[2px] opacity-90 shadow-[0_2px_12px_rgba(129,1,0,0.5)] z-50" />

        {/* Ambient glow orbs */}
        <motion.div
          className="pointer-events-none absolute -right-32 top-10 h-[420px] w-[420px] rounded-full bg-cherryRed/10 blur-[130px]"
          style={{ willChange: "transform, opacity" }}
          animate={{ y: [0, 28, 0], opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -left-20 bottom-28 h-[480px] w-[480px] rounded-full bg-cherryRed/5 blur-[150px]"
          style={{ willChange: "transform, opacity" }}
          animate={{ y: [0, -35, 0], opacity: [0.25, 0.45, 0.25], scale: [1, 1.04, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute right-1/3 bottom-12 h-72 w-72 rounded-full bg-white/5 blur-[90px]"
          style={{ willChange: "opacity" }}
          animate={{ opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Desktop Sidebar */}
        {isDesktopDashboard && (
          <aside className="hidden md:flex w-72 shrink-0 flex-col justify-between border-r border-white/[0.06] bg-black/30 p-7 backdrop-blur-2xl z-20">
            <div className="space-y-9">
              {/* Brand */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-black/60 p-1 shadow-[0_0_24px_rgba(129,1,0,0.15)]">
                  <img src="/logo.png" alt="LOCKIN" className="h-full w-full object-contain" />
                </div>
                <div>
                  <span className="text-[9px] font-semibold tracking-[0.22em] text-zinc-600 uppercase block leading-none mb-1">
                    Campus Execution
                  </span>
                  <h1 className="text-[22px] font-display font-bold tracking-[0.06em] text-white leading-none">
                    LOCKIN
                  </h1>
                </div>
              </div>

              {/* Nav */}
              <nav className="space-y-1">
                {[
                  { key: "missions", label: "Missions", icon: Flame, color: "text-cherryRed" },
                  { key: "feed", label: "Social Feed", icon: Rss, color: "text-cherryRed" },
                  { key: "active", label: "Active Queue", icon: Activity, color: "text-white" },
                  { key: "profile", label: "Profile", icon: UserIcon, color: "text-white/80" }
                ].map((item) => {
                  const isActive = tab === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setTab(item.key)}
                      className={`group flex w-full items-center gap-3.5 rounded-[12px] border px-4 py-3 text-sm font-medium transition-all duration-150 outline-none select-none shimmer-hover relative
                        ${isActive
                          ? "border-white/[0.08] bg-white/[0.055] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                        }
                      `}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? item.color : "text-zinc-600 group-hover:text-zinc-400"}`} />
                      <span className="text-[13px]">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cherryRed"
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* User widget */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.07] bg-black/50 text-[13px] font-black text-white">
                  {user.name ? user.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() : "??"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.name}</p>
                  <p className="text-[11px] font-medium text-white/70 mt-1 flex items-center gap-1 leading-none">
                    <img src="/aura-bolt.png" alt="Aura" className="h-3 w-3 object-contain shrink-0" />
                    <span>{user.reputation_score ?? 0} Aura</span>
                  </p>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="relative z-10 flex flex-1 flex-col overflow-y-auto h-full scrollbar-none">
          {children}
        </div>
      </main>
    </div>
  );
}
