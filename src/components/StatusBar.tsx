"use client";

import type { FamilyGraph as FamilyGraphData, FamilyNode, MemberNode } from "@/types/family";
import mockData from "@/data/family-mock.json";

const data = mockData as FamilyGraphData;

interface StatusBarProps {
  selectedNodeId: string | null;
  viewerId: string;
  onDeselect: () => void;
}

export default function StatusBar({ selectedNodeId, viewerId, onDeselect }: StatusBarProps) {
  const selectedNode = selectedNodeId
    ? data.nodes.find((n) => n.id === selectedNodeId)
    : null;

  const viewer = data.nodes.find((n) => n.id === viewerId) as MemberNode | undefined;
  const viewerLabel = viewer?.label ?? "User";
  const viewerRole = viewer?.role ?? "member";

  const highRiskCount = data.nodes.filter((n) => n.riskLevel === "high").length;
  const achievementCount = data.nodes.filter((n) => n.isAchievement).length;

  return (
    <div className="flex h-7 items-center justify-between border-t border-white/[0.06] bg-[rgba(15,15,22,0.6)] px-4 text-[13px] text-zinc-500 backdrop-blur-xl">
      <span className="flex items-center gap-1.5">
        <span className="text-zinc-400">Viewing as</span>
        <span className="font-medium text-zinc-300">{viewerLabel}</span>
        <span className="rounded bg-zinc-800 px-1 py-0.5 text-[11px] text-zinc-500">{viewerRole}</span>
        {highRiskCount > 0 && (
          <>
            <span className="text-zinc-700">&middot;</span>
            <span className="text-red-400/80">{highRiskCount} alert{highRiskCount > 1 ? "s" : ""}</span>
          </>
        )}
        {achievementCount > 0 && (
          <>
            <span className="text-zinc-700">&middot;</span>
            <span className="text-yellow-400/70">{achievementCount} achievement{achievementCount > 1 ? "s" : ""}</span>
          </>
        )}
      </span>
      {selectedNode ? (
        <span>
          <span className="text-zinc-300">{selectedNode.label}</span>
          {" · "}
          <button
            onClick={onDeselect}
            className="text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200"
          >
            Esc to deselect
          </button>
        </span>
      ) : (
        <span className="text-zinc-600">Click a node to inspect</span>
      )}
    </div>
  );
}
