"use client";

import { useState, useEffect, useCallback } from "react";
import {
  generateCoachingScripts,
  type CoachingScript,
  type UserRole,
} from "@/lib/livo/coaching";
import mockData from "@/data/family-mock.json";

interface LivoCoachProps {
  nodeId: string | null;
  viewerRole: UserRole;
  onClose: () => void;
}

// ── Main Component ───────────────────────────────────────────

export default function LivoCoach({ nodeId, viewerRole, onClose }: LivoCoachProps) {
  const [scripts, setScripts] = useState<CoachingScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [nudgedIdx, setNudgedIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const node = nodeId ? mockData.nodes.find((n) => n.id === nodeId) : null;

  // Find the child who owns this node
  const owner = (() => {
    if (!nodeId) return null;
    const edge = mockData.edges.find(
      (e) =>
        (e.target === nodeId && e.source.startsWith("m-")) ||
        (e.source === nodeId && e.target.startsWith("m-"))
    );
    const ownerId = edge
      ? edge.source.startsWith("m-")
        ? edge.source
        : edge.target
      : null;
    return ownerId ? mockData.nodes.find((n) => n.id === ownerId) : null;
  })();

  const fetchScripts = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setScripts([]);
    setCopiedIdx(null);
    setNudgedIdx(null);
    try {
      const result = await generateCoachingScripts(id, viewerRole);
      setScripts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scripts");
    } finally {
      setLoading(false);
    }
  }, [viewerRole]);

  useEffect(() => {
    if (nodeId) {
      fetchScripts(nodeId);
    } else {
      setScripts([]);
      setError(null);
    }
  }, [nodeId, fetchScripts]);

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  }, []);

  const handleNudge = useCallback((idx: number) => {
    setNudgedIdx(idx);
    setTimeout(() => setNudgedIdx(null), 2500);
  }, []);

  if (!nodeId) return null;

  const toneColors: Record<string, string> = {
    Gentle: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Direct: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Curious: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Playful: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Warm: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    Calm: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 animate-[slideUp_0.3s_ease-out] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/50"
      style={{
        background: "rgba(15, 15, 22, 0.75)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">TrendLife Companion</h3>
          <p className="text-xs text-indigo-400/70">Family Curator</p>
          {node && owner && (
            <p className="text-xs text-zinc-500">
              Recalling {owner.label}&apos;s memory:{" "}
              <span className="text-red-400">{node.label}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            High Risk
          </span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[420px] overflow-y-auto px-4 py-3">
        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="mb-2 h-4 w-16 rounded-full bg-white/[0.06]" />
                <div className="mb-1.5 h-3 w-full rounded bg-white/[0.04]" />
                <div className="mb-1.5 h-3 w-4/5 rounded bg-white/[0.04]" />
                <div className="h-3 w-3/5 rounded bg-white/[0.04]" />
              </div>
            ))}
            <p className="text-center text-xs text-zinc-600">TrendLife is recalling family memories...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="mb-2 text-sm text-red-400">{error}</p>
            <button
              onClick={() => nodeId && fetchScripts(nodeId)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Scripts — accordion */}
        {!loading && !error && scripts.length > 0 && (
          <div className="flex flex-col gap-1">
            {scripts.map((script, idx) => {
              const isOpen = expandedIdx === idx;
              const colorClass = toneColors[script.tone] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
              return (
                <div key={idx}>
                  <button
                    onClick={() => setExpandedIdx(isOpen ? null : idx)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                      isOpen
                        ? "border-indigo-500/30 bg-indigo-500/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                      {script.tone}
                    </span>
                    <span className="truncate text-[13px] text-zinc-400">&ldquo;{script.message.slice(0, 25)}...&rdquo;</span>
                    <svg className={`ml-auto h-3 w-3 shrink-0 text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-[13px] leading-relaxed text-zinc-300">&ldquo;{script.message}&rdquo;</p>
                      <p className="mt-1 text-xs italic text-zinc-600">Follow-up: {script.followUp}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(script.message, idx)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
                        >
                          {copiedIdx === idx ? (
                            <span className="text-emerald-400">Copied!</span>
                          ) : (
                            "Copy"
                          )}
                        </button>
                        <button
                          onClick={() => handleNudge(idx)}
                          className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-500/20"
                        >
                          {nudgedIdx === idx ? (
                            <span className="text-indigo-300">Nudge sent!</span>
                          ) : (
                            "TrendLife Nudge"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
