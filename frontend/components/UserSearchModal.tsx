"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, X, Loader2 } from "lucide-react";

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  api: (path: string, options?: RequestInit) => Promise<any>;
  onViewProfile: (userId: number) => void;
}

export default function UserSearchModal({
  isOpen,
  onClose,
  currentUserId,
  api,
  onViewProfile,
}: UserSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const data = await api(`/users/search?q=${encodeURIComponent(query)}&currentUserId=${currentUserId}`);
        setResults(data || []);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, currentUserId, api]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-start">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div
        initial={{ y: "-100%" }}
        animate={{ y: 0 }}
        exit={{ y: "-100%" }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="relative w-full max-w-md mx-auto bg-zinc-950 border-b border-white/[0.08] rounded-b-3xl px-4 pt-5 pb-6 z-[1001] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Peers Search
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Input area */}
        <div className="relative flex items-center">
          <Search
            size={15}
            className="absolute left-4 text-zinc-500 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or department..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:ring-1 focus:ring-[#8B0000]/50 focus:border-[#8B0000]/50 focus:outline-none transition"
          />
        </div>

        {/* Results section */}
        <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-none">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 text-[#8B0000] animate-spin" />
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest text-center py-6">
              No users found.
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 text-center py-6">
              SEARCH BY NAME OR DEPARTMENT
            </div>
          )}

          {!loading && results.map((result) => {
            const initials = result.name
              ? result.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
              : "??";

            return (
              <div
                key={result.id}
                onClick={() => {
                  onViewProfile(result.id);
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-900 border border-white/[0.06] hover:border-white/[0.12] cursor-pointer transition"
              >
                {result.avatar_url ? (
                  <img
                    src={result.avatar_url}
                    alt={result.name}
                    className="w-9 h-9 rounded-full object-cover border border-[#8B0000]/40 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-zinc-900 border border-[#8B0000]/40 text-[11px] font-black text-[#8B0000] flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                )}
                
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-black text-white uppercase tracking-wide truncate">
                    {result.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold truncate">
                    {result.department} · {result.college}
                  </p>
                </div>

                <div className="text-[10px] font-black text-[#8B0000] uppercase tracking-wider shrink-0">
                  {result.reputationScore} AURA
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
