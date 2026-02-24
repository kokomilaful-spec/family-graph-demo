"use client";

import { useState, useCallback } from "react";
import { parseCommand } from "@/lib/agent/parser";
import type { Command } from "@/types/command";

interface CommandBarProps {
  onCommand: (command: Command) => void;
}

export default function CommandBar({ onCommand }: CommandBarProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || loading) return;

      setLoading(true);
      setError(null);
      try {
        const command = await parseCommand(trimmed);
        onCommand(command);
        setInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse command");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, onCommand],
  );

  return (
    <div className="border-t border-white/[0.06] px-3 py-2.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Livo... e.g. 'Order dinner'"
            disabled={loading}
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-2 pl-8 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/50 focus:bg-zinc-800/80 disabled:opacity-50"
          />
          {/* Sparkle icon */}
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        </div>
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400 transition-colors hover:bg-indigo-500/25 disabled:opacity-30 disabled:hover:bg-indigo-500/15"
        >
          {loading ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </form>
      {error && (
        <p className="mt-1.5 text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
