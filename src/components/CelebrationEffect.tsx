"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SynapseEvent } from "@/types/family";
import mockData from "@/data/family-mock.json";

// ─── Types ──────────────────────────────────────────────────

export interface RewardSuggestion {
  eventId: string;
  event: SynapseEvent;
  suggestion: string;
  memberLabels: string[];
}

// ─── Reward suggestion lookup ───────────────────────────────

const REWARD_RULES: { pattern: RegExp; suggestion: string }[] = [
  { pattern: /hik|outing|outdoor|trail/i, suggestion: "Plan a family picnic to celebrate!" },
  { pattern: /cook|soup|recipe|dinner|meal/i, suggestion: "Treat the family to their favorite restaurant!" },
  { pattern: /cod|project|milestone|complet/i, suggestion: "Get a small gift to mark this achievement!" },
  { pattern: /bak|cookie|cake|treat/i, suggestion: "Share the treats with the neighbors!" },
];

function suggestReward(description: string): string {
  for (const rule of REWARD_RULES) {
    if (rule.pattern.test(description)) return rule.suggestion;
  }
  return "Celebrate together as a family!";
}

function resolveMemberLabels(memberIds: string[]): string[] {
  return memberIds.map((id) => {
    const node = mockData.nodes.find((n) => n.id === id);
    return node?.label ?? id;
  });
}

// ─── Hook ───────────────────────────────────────────────────

const CELEBRATION_DURATION = 8000; // 8 seconds

export function useCelebration(events: SynapseEvent[]) {
  const [celebratingMembers, setCelebratingMembers] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Build reward suggestions for all Positive events (not dismissed)
  const activeRewards: RewardSuggestion[] = events
    .filter((e) => e.impact === "Positive" && !dismissedIds.has(e.id))
    .map((e) => ({
      eventId: e.id,
      event: e,
      suggestion: suggestReward(e.description),
      memberLabels: resolveMemberLabels(e.involvedMembers),
    }));

  const triggerCelebration = useCallback(
    (eventId: string) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      setCelebratingMembers((prev) => {
        const next = new Set(prev);
        for (const mid of event.involvedMembers) next.add(mid);
        return next;
      });

      // Clear previous timer for this event if any
      const existing = timersRef.current.get(eventId);
      if (existing) clearTimeout(existing);

      // Auto-expire after duration
      const timer = setTimeout(() => {
        setCelebratingMembers((prev) => {
          const next = new Set(prev);
          for (const mid of event.involvedMembers) next.delete(mid);
          return next;
        });
        timersRef.current.delete(eventId);
      }, CELEBRATION_DURATION);

      timersRef.current.set(eventId, timer);
    },
    [events],
  );

  const dismissReward = useCallback((eventId: string) => {
    setDismissedIds((prev) => new Set(prev).add(eventId));
  }, []);

  // Auto-trigger for high-intensity Positive events on mount
  useEffect(() => {
    const highImpact = events.filter((e) => e.impact === "Positive" && e.intensity >= 4);
    for (const e of highImpact) {
      triggerCelebration(e.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
    };
  }, []);

  return { celebratingMembers, activeRewards, triggerCelebration, dismissReward };
}

// ─── Livo Reward Card ───────────────────────────────────────

interface LivoRewardCardProps {
  reward: RewardSuggestion;
  onCelebrate: () => void;
  onDismiss: () => void;
}

export function LivoRewardCard({ reward, onCelebrate, onDismiss }: LivoRewardCardProps) {
  return (
    <div className="mb-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500/10 text-xs">
          🎊
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400/70">
          TrendLife Reward
        </span>
      </div>
      <p className="mb-1 text-smleading-relaxed text-zinc-300">
        {reward.event.description}
      </p>
      <p className="mb-2 text-smleading-relaxed text-yellow-300/80">
        💡 {reward.suggestion}
      </p>
      <p className="mb-2 text-xs text-zinc-500">
        {reward.memberLabels.join(", ")}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCelebrate}
          className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-[13px] font-medium text-yellow-400 transition-colors hover:bg-yellow-500/20"
        >
          Celebrate! 🎉
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md border border-white/[0.06] px-2.5 py-1 text-[13px] text-zinc-500 transition-colors hover:text-zinc-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
