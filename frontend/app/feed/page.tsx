"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import SocialFeed from "../../components/SocialFeed";
import Header from "../../components/Header";
import Nav from "../../components/Nav";
import ProfileGate from "../../components/ProfileGate";
import LoadingScreen from "../../components/LoadingScreen";
import { User } from "../types";
import { supabase } from "../../lib/supabase";
import { api, isProfileIncomplete } from "../../lib/api";

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.remove("light");

    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          const nextUser = await api("/auth/me");
          if (isProfileIncomplete(nextUser)) {
            setUser(null);
          } else {
            setUser(nextUser);
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

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <ProfileGate onReady={setUser} api={api} />;
  }

  return (
    <Shell tab="feed" setTab={(t) => router.push(t === "feed" ? "/feed" : `/?tab=${t}`)} user={user}>
      <Header user={user} />
      <div className="flex flex-1 flex-col overflow-y-auto scrollbar-none pb-28 md:pb-6">
        <SocialFeed user={user} api={api} />
      </div>
      <Nav tab="feed" setTab={(t) => router.push(t === "feed" ? "/feed" : `/?tab=${t}`)} />
    </Shell>
  );
}
