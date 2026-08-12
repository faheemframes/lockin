"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User } from "./types";

import Shell from "../components/Shell";
import Header from "../components/Header";
import Nav from "../components/Nav";
import ProfileGate from "../components/ProfileGate";
import Feed from "../components/Feed";
import ActiveMissions from "../components/ActiveMissions";
import Profile from "../components/Profile";
import SocialFeed from "../components/SocialFeed";
import LoadingScreen from "../components/LoadingScreen";

import { supabase } from "../lib/supabase";
import { api, SOCKET_URL, isProfileIncomplete } from "../lib/api";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("missions");
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get("tab");
      if (queryTab && ["missions", "feed", "active", "profile"].includes(queryTab)) {
        setTab(queryTab);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    if (!user || !supabase) return;

    const channel = supabase.channel(`notifications:${user.id}`);

    channel.on(
      "broadcast",
      { event: "push_notification" },
      ({ payload }: { payload: { title: string; message: string; type: string; missionId?: number } }) => {
        setToast(payload);
        setTimeout(() => {
          setToast((current) => (current && current.message === payload.message ? null : current));
        }, 4000);

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(payload.title, { body: payload.message });
          } catch (e) {
            console.warn("Failed to trigger native notification:", e);
          }
        }
      }
    );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  async function refreshUser() {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        return;
      }
      const nextUser = await api("/auth/me");
      if (isProfileIncomplete(nextUser)) {
        setUser(null);
        return;
      }
      const lock = await api(`/users/${nextUser.id}/lock`);
      setUser(nextUser);
      setLocked(lock.locked);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    document.documentElement.classList.remove("light");

    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          const nextUser = await api("/auth/me");
          if (isProfileIncomplete(nextUser)) {
            setUser(null);
          } else {
            setUser(nextUser);
            try {
              const lock = await api(`/users/${nextUser.id}/lock`);
              setLocked(lock.locked);
            } catch {
              setLocked(false);
            }
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const screen = useMemo(() => {
    if (!user) return null;
    if (tab === "active") {
      return (
        <ActiveMissions
          user={user}
          refreshUser={refreshUser}
          api={api}
          socketUrl={SOCKET_URL}
        />
      );
    }
    if (tab === "feed") {
      return <SocialFeed user={user} api={api} />;
    }
    if (tab === "profile") {
      return <Profile user={user} refreshUser={refreshUser} api={api} />;
    }
    return (
      <Feed
        user={user}
        refreshUser={refreshUser}
        locked={locked}
        setLocked={setLocked}
        api={api}
        setTab={setTab}
      />
    );
  }, [tab, user, locked]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <ProfileGate onReady={setUser} api={api} />;
  }

  return (
    <Shell tab={tab} setTab={setTab} user={user}>
      <Header user={user} />
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          className="flex flex-1 flex-col overflow-y-auto scrollbar-none pb-28 md:pb-6"
        >
          {screen}
        </motion.div>
      </AnimatePresence>
      <Nav tab={tab} setTab={setTab} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: -20, scale: 0.9, x: "-50%" }}
            className="fixed top-5 left-1/2 z-[1000] w-[88%] max-w-sm rounded-2xl border border-white/[0.08] bg-[#0F0D0C]/92 p-4 shadow-[0_16px_50px_rgba(0,0,0,.7),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl flex items-start gap-3 text-left"
          >
            <div className="flex-1">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">{toast.title}</h4>
              <p className="text-[11px] text-zinc-400 font-semibold mt-1 leading-normal">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
