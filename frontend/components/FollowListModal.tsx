"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  initialTab: "followers" | "following";
  onViewProfile: (userId: number) => void;
  api: (path: string, options?: RequestInit) => Promise<any>;
}

export default function FollowListModal({
  isOpen,
  onClose,
  userId,
  initialTab,
  onViewProfile,
  api,
}: FollowListModalProps) {
  const [activeTab, setActiveTab] = useState<"followers" | "following">(initialTab);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync tab with initialTab prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Fetch users when userId, activeTab or isOpen changes
  useEffect(() => {
    if (!isOpen || !userId) return;

    async function fetchUsers() {
      setLoading(true);
      setUsers([]);
      try {
        const endpoint = `/follow/${userId}/${activeTab}`;
        const data = await api(endpoint);
        setUsers(data || []);
      } catch (err) {
        console.error(`Failed to load ${activeTab}:`, err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [userId, activeTab, isOpen, api]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="relative w-full max-w-md mx-auto bg-zinc-950 border-t border-white/[0.08] rounded-t-3xl px-4 pt-5 pb-8 max-h-[75vh] flex flex-col z-[1001] shadow-2xl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-zinc-800 rounded-full mx-auto mb-4 shrink-0" />

        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Connections
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 justify-center mb-2 shrink-0">
          {(["followers", "following"] as const).map((tabType) => {
            const isActive = activeTab === tabType;
            return (
              <button
                key={tabType}
                onClick={() => setActiveTab(tabType)}
                className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${
                  isActive
                    ? "bg-[#8B0000] text-white"
                    : "bg-zinc-900 text-zinc-500 border border-white/[0.08] hover:text-zinc-300"
                }`}
              >
                {tabType}
              </button>
            );
          })}
        </div>

        {/* User list area */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2 scrollbar-none">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse bg-zinc-900 rounded-xl h-14 w-full border border-white/[0.04]"
                />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-600 font-bold uppercase tracking-widest">
              No users yet.
            </div>
          ) : (
            users.map((rowUser) => {
              const initials = rowUser.name
                ? rowUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                : "??";

              return (
                <div
                  key={rowUser.id}
                  onClick={() => {
                    onViewProfile(rowUser.id);
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-900 border border-white/[0.06] hover:border-white/[0.12] cursor-pointer transition"
                >
                  {rowUser.avatar_url ? (
                    <img
                      src={rowUser.avatar_url}
                      alt={rowUser.name}
                      className="w-9 h-9 rounded-full object-cover border border-[#8B0000]/40 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-[#8B0000]/40 text-[11px] font-black text-[#8B0000] flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-black text-white uppercase tracking-wide truncate">
                      {rowUser.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold truncate">
                      {rowUser.department} · {rowUser.college}
                    </p>
                  </div>

                  <div className="text-[10px] font-black text-[#8B0000] uppercase tracking-wider shrink-0">
                    {rowUser.reputationScore} AURA
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
