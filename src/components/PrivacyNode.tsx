"use client";

import type { FamilyNode, NodeType } from "@/types/family";

const TYPE_COLORS: Record<NodeType, string> = {
  member: "#3b82f6",
  preference: "#f59e0b",
  device: "#8b5cf6",
  document: "#10b981",
  health: "#ef4444",
  house_rule: "#06b6d4",
};

const TYPE_ICONS: Record<NodeType, React.ReactNode> = {
  member: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
    </svg>
  ),
  preference: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  device: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v15a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  document: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  health: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  house_rule: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

interface PrivacyNodeProps {
  node: FamilyNode;
  isOwner: boolean;
  ownerLabel?: string;
  onClose: () => void;
}

export default function PrivacyNode({
  node,
  isOwner,
  ownerLabel,
  onClose,
}: PrivacyNodeProps) {
  const color = TYPE_COLORS[node.type];
  const visLabel = node.visibility === "private" ? "Private" : "Guarded";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="relative flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {TYPE_ICONS[node.type]}
            {/* Lock badge */}
            <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {isOwner ? node.label : `${visLabel} Node`}
            </h2>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {node.type}
              </span>
              <span className="inline-block rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                {visLabel}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Session status */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
            isOwner
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-zinc-700/50 bg-zinc-800/30"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isOwner ? "animate-pulse bg-emerald-400" : "bg-zinc-600"
            }`}
          />
          <span className={`text-xs font-medium ${isOwner ? "text-emerald-400" : "text-zinc-500"}`}>
            {isOwner ? "Owner Session Active" : "Owner Session Inactive"}
          </span>
        </div>
      </div>

      {/* Content — blurred or revealed */}
      <div className="relative flex-1">
        {/* Properties (always rendered, blurred when not owner) */}
        <div
          className={`border-b border-zinc-800 px-4 py-3 transition-[filter] duration-500 ${
            isOwner ? "" : "pointer-events-none select-none blur-[6px]"
          }`}
          aria-hidden={!isOwner}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Properties
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Type</span>
              <span className="rounded px-2 py-0.5 text-xs capitalize text-zinc-300">{node.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">ID</span>
              <span className="rounded px-2 py-0.5 text-xs text-zinc-300">{node.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Visibility</span>
              <span className="rounded px-2 py-0.5 text-xs capitalize text-zinc-300">{node.visibility}</span>
            </div>
            {node.riskLevel && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Risk</span>
                <span className="rounded px-2 py-0.5 text-xs capitalize text-zinc-300">{node.riskLevel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Lock overlay (only when not owner) */}
        {!isOwner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-700/40 bg-zinc-900/80 px-6 py-5 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-zinc-300">Content Protected</p>
                <p className="mt-1 text-[10px] leading-tight text-zinc-500">
                  {ownerLabel
                    ? `Switch to ${ownerLabel}'s session to reveal`
                    : "Only the owner can view this node"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revealed content (only when owner) */}
      {isOwner && (
        <div className="animate-in fade-in slide-in-from-bottom-2 px-4 py-3 duration-500">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-500/70">
            Full Access
          </p>
          <p className="text-xs leading-relaxed text-zinc-400">
            You are viewing this node as its owner. All details are visible.
          </p>
        </div>
      )}
    </div>
  );
}
