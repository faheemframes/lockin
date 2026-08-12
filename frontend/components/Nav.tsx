"use client";

import React from "react";
import { Flame, Activity, User as UserIcon, Rss } from "lucide-react";
import { motion } from "framer-motion";

interface NavProps {
  tab: string;
  setTab: (tab: string) => void;
}

export default function Nav({ tab, setTab }: NavProps) {
  const items = [
    { key: "missions", label: "Missions", icon: Flame, color: "text-cherryRed" },
    { key: "feed", label: "Feed", icon: Rss, color: "text-cherryRed" },
    { key: "active", label: "Queue", icon: Activity, color: "text-white" },
    { key: "profile", label: "Profile", icon: UserIcon, color: "text-white/80" }
  ] as const;

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-5 z-40 md:hidden mx-auto max-w-[390px] px-5">
      <div className="relative flex items-center justify-between rounded-[26px] border border-white/[0.08] bg-black/85 px-2 py-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl">
        {items.map(({ key, label, icon: Icon, color }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="relative flex flex-1 flex-col items-center justify-center py-2.5 gap-1 outline-none transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-x-1 inset-y-0.5 -z-10 rounded-[20px] bg-white/[0.07] border border-white/[0.07]"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={`h-[19px] w-[19px] transition-all duration-200 ${
                  isActive ? `${color} drop-shadow-[0_0_6px_currentColor]` : "text-zinc-600"
                }`}
              />
              <span
                className={`text-[9px] font-black uppercase tracking-[.14em] transition-all duration-200 leading-none ${
                  isActive ? "text-white" : "text-zinc-600"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
