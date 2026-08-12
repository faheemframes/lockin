"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ChevronLeft, Send, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { User, Mission, Message } from "../app/types";

interface ChatProps {
  mission: Mission;
  user: User;
  onClose: () => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
  socketUrl: string;
}

export default function Chat({ mission, user, onClose, api, socketUrl }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const list = await api(`/messages/${mission.id}?userId=${user.id}`);
      setMessages(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    load();
  }, [mission.id, user.id]);

  // Supabase Realtime Chat subscription
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel(`mission_chat:${mission.id}`);

    channel.on(
      "broadcast",
      { event: "new_message" },
      ({ payload }: { payload: Message }) => {
        if (payload.mission_id === mission.id) {
          setMessages((current) => {
            if (current.some((msg) => msg.id === payload.id)) return current;
            return [...current, payload];
          });
        }
      }
    );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [mission.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, loading]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;

    const currentText = text.trim();
    setText("");

    try {
      const message = await api(`/messages/${mission.id}`, {
        method: "POST",
        body: JSON.stringify({ senderId: user.id, message: currentText })
      });
      setMessages((current) => {
        if (current.some((msg) => msg.id === message.id)) return current;
        return [...current, message];
      });
    } catch (err) {
      console.error("Message send failed", err);
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col bg-black/95 p-4 backdrop-blur-xl"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-base font-black text-white line-clamp-1">{mission.title}</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Coordination Channel
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-boxRed/20 bg-boxRed/5 p-3 text-zinc-400">
          <ShieldAlert className="h-4 w-4 text-boxRed shrink-0" />
          <span className="text-[10px] font-semibold tracking-wide uppercase leading-relaxed text-zinc-500">
            Text-only protocol. Keep it technical. No media, no spam.
          </span>
        </div>

        {/* Messages list */}
        <div className="mt-4 flex-1 overflow-hidden" ref={scrollContainerRef}>
          <ScrollArea className="h-full pr-3">
            {loading ? (
              <div className="flex h-full items-center justify-center py-20 text-xs font-semibold text-zinc-500">
                Opening channel...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Channel Empty</p>
                <p className="mt-1 text-[11px] text-zinc-500">Send a message to coordinate rendezvous.</p>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {messages.map((message) => {
                  const isSelf = message.sender_id === user.id;
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col max-w-[85%] ${isSelf ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                        {message.sender_name}
                      </span>
                      <div
                        className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                          isSelf
                            ? "rounded-tr-none border-cherryRed/30 bg-cherryRed/10 text-cotton"
                            : "rounded-tl-none border-white/5 bg-zinc-950 text-zinc-200"
                        }`}
                      >
                        {message.message}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Input box */}
        <form onSubmit={send} className="safe-bottom mt-4 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type coordinates or updates..."
            className="h-12 border-white/10 bg-black/40 text-sm text-cotton placeholder-zinc-600 transition focus:border-luxuryGold focus:ring-2 focus:ring-luxuryGold/10"
            required
            autoComplete="off"
          />
          <button
            type="submit"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-cherryRed bg-cherryRed text-cotton shadow-[0_0_20px_rgba(129,1,0,0.25)] hover:bg-cherryRed/90 active:scale-[0.96] transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
