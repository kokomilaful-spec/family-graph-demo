"use client";

import { useMemo } from "react";
import {
  UtensilsCrossed,
  Footprints,
  Smartphone,
  Heart,
  X,
  ChevronRight,
  Zap,
} from "lucide-react";
import type {
  FamilyNode,
  MemberNode,
  PreferenceNode,
  DeviceNode,
  Edge,
} from "@/types/family";
import type { Command } from "@/types/command";
import mockData from "@/data/family-mock.json";

// ─── Category definitions ────────────────────────────────────

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgClass: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "diet",
    label: "Diet",
    icon: <UtensilsCrossed size={14} />,
    color: "#f59e0b",
    bgClass: "rgba(245,158,11,0.1)",
  },
  {
    key: "activity",
    label: "Activity",
    icon: <Footprints size={14} />,
    color: "#3b82f6",
    bgClass: "rgba(59,130,246,0.1)",
  },
  {
    key: "tech",
    label: "Tech",
    icon: <Smartphone size={14} />,
    color: "#8b5cf6",
    bgClass: "rgba(139,92,246,0.1)",
  },
  {
    key: "health",
    label: "Health",
    icon: <Heart size={14} />,
    color: "#10b981",
    bgClass: "rgba(16,185,129,0.1)",
  },
];

const FOCUS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  diet: { label: "Dietary Preferences", icon: <UtensilsCrossed size={14} />, color: "#f59e0b" },
  activity: { label: "Activity Preferences", icon: <Footprints size={14} />, color: "#3b82f6" },
  tech: { label: "Devices", icon: <Smartphone size={14} />, color: "#8b5cf6" },
};

// ─── Sentiment display ───────────────────────────────────────

const SENTIMENT_ICON: Record<string, string> = {
  loves: "❤️",
  likes: "👍",
  dislikes: "👎",
  avoids: "🚫",
};

// ─── Types ───────────────────────────────────────────────────

interface GroupedItem {
  id: string;
  label: string;
  detail: string;
  sentiment?: string;
}

interface FocusMemberGroup {
  member: MemberNode;
  items: GroupedItem[];
}

interface PreferenceSidebarProps {
  memberId: string | null;
  activeCommand?: Command | null;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────

export default function PreferenceSidebar({
  memberId,
  activeCommand,
  onClose,
}: PreferenceSidebarProps) {
  const data = mockData as { nodes: FamilyNode[]; edges: Edge[] };

  // ── Focus mode detection ──
  const focusType = useMemo(() => {
    if (!activeCommand?.relevant_context?.length) return null;
    if (activeCommand.relevant_context.includes("dietary_preferences")) return "diet";
    if (activeCommand.relevant_context.includes("activities")) return "activity";
    if (activeCommand.relevant_context.includes("devices")) return "tech";
    return null;
  }, [activeCommand]);

  const isFocusMode = focusType !== null;

  // ── Focus data: all members with matching preferences ──
  const focusGroups = useMemo((): FocusMemberGroup[] => {
    if (!focusType) return [];

    const members = data.nodes.filter((n) => n.type === "member") as MemberNode[];

    if (focusType === "tech") {
      const results: FocusMemberGroup[] = [];
      for (const m of members) {
        const deviceIds = new Set<string>();
        for (const e of data.edges) {
          if (e.source === m.id && e.relation === "owns_device") deviceIds.add(e.target);
          if (e.target === m.id && e.relation === "owns_device") deviceIds.add(e.source);
        }
        const devices = data.nodes.filter(
          (n) => deviceIds.has(n.id) && n.type === "device",
        ) as DeviceNode[];
        if (devices.length) {
          results.push({
            member: m,
            items: devices.map((d) => ({
              id: d.id,
              label: d.label,
              detail: [d.platform, d.os].filter(Boolean).join(" · "),
            })),
          });
        }
      }
      return results;
    }

    // Preferences (diet or activity)
    const categoryFilter = focusType === "diet" ? "food" : "activity";
    const results: FocusMemberGroup[] = [];
    for (const m of members) {
      const prefIds = new Set<string>();
      for (const e of data.edges) {
        if (e.source === m.id && e.relation === "has_preference") prefIds.add(e.target);
        if (e.target === m.id && e.relation === "has_preference") prefIds.add(e.source);
      }
      const prefs = data.nodes.filter(
        (n) =>
          prefIds.has(n.id) &&
          n.type === "preference" &&
          (n as PreferenceNode).category === categoryFilter,
      ) as PreferenceNode[];
      if (prefs.length) {
        results.push({
          member: m,
          items: prefs.map((p) => ({
            id: p.id,
            label: p.label,
            detail: p.sentiment,
            sentiment: p.sentiment,
          })),
        });
      }
    }
    return results;
  }, [focusType, data.nodes, data.edges]);

  // ── Single-member mode ──
  const member = useMemo(() => {
    if (!memberId) return null;
    const n = data.nodes.find((nd) => nd.id === memberId);
    return n?.type === "member" ? n : null;
  }, [memberId, data.nodes]);

  const groups = useMemo(() => {
    if (!member) return [];

    const connectedIds = new Set<string>();
    for (const edge of data.edges) {
      if (edge.source === member.id && !edge.target.startsWith("m-"))
        connectedIds.add(edge.target);
      if (edge.target === member.id && !edge.source.startsWith("m-"))
        connectedIds.add(edge.source);
    }

    const connectedNodes = data.nodes.filter((n) => connectedIds.has(n.id));
    const grouped: Record<string, GroupedItem[]> = {};

    for (const node of connectedNodes) {
      if (node.type === "preference") {
        const pref = node as PreferenceNode;
        const catKey = pref.category === "food" ? "diet" : pref.category;
        if (!grouped[catKey]) grouped[catKey] = [];
        grouped[catKey].push({
          id: pref.id,
          label: pref.label,
          detail: pref.sentiment,
          sentiment: pref.sentiment,
        });
      } else if (node.type === "device") {
        const dev = node as DeviceNode;
        if (!grouped["tech"]) grouped["tech"] = [];
        grouped["tech"].push({
          id: dev.id,
          label: dev.label,
          detail: [dev.platform, dev.os].filter(Boolean).join(" · "),
        });
      }
    }

    return CATEGORIES.filter((c) => grouped[c.key]?.length).map((c) => ({
      ...c,
      items: grouped[c.key],
    }));
  }, [member, data.nodes, data.edges]);

  // Sidebar is open in focus mode OR when a member is selected
  const isOpen = isFocusMode || !!member;
  const meta = focusType ? FOCUS_META[focusType] : null;

  return (
    <div
      className={`absolute left-0 top-0 z-20 flex h-full flex-col overflow-hidden border-r transition-all duration-300 ease-out ${
        isOpen ? "w-64 opacity-100" : "w-0 opacity-0"
      } ${isFocusMode ? "border-amber-500/20" : "border-white/[0.06]"}`}
      style={{
        background: "rgba(15,15,22,0.55)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.02)",
      }}
    >
      {/* ── Focus Mode View ── */}
      {isFocusMode && meta && (
        <>
          {/* Focus header */}
          <div
            className="flex items-center gap-2 border-b px-4 py-3"
            style={{ borderColor: `${meta.color}30` }}
          >
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
              style={{ background: `${meta.color}20`, color: meta.color }}
            >
              <Zap size={12} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                Focus Mode
              </div>
              <div className="truncate text-xs text-zinc-300">
                {activeCommand?.summary ?? "Livo Context Active"}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>

          {/* Focus category label */}
          <div className="flex items-center gap-2 px-4 py-2" style={{ background: `${meta.color}08` }}>
            <span style={{ color: meta.color }}>{meta.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-[9px] text-zinc-600">
              {focusGroups.length} member{focusGroups.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Focus member groups */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {focusGroups.length === 0 ? (
              <div className="px-2 py-8 text-center text-xs text-zinc-600">
                No matching preferences
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {focusGroups.map((group) => (
                  <div
                    key={group.member.id}
                    className="rounded-lg border px-3 py-2"
                    style={{
                      borderColor: `${meta.color}18`,
                      background: `${meta.color}06`,
                    }}
                  >
                    {/* Member header */}
                    <div className="mb-1.5 flex items-center gap-2">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
                      >
                        {group.member.label.charAt(0)}
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-200">
                        {group.member.label}
                      </span>
                      <span className="text-[9px] capitalize text-zinc-600">
                        {group.member.role}
                      </span>
                    </div>

                    {/* Preference items */}
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 py-1 pl-7"
                      >
                        {item.sentiment && (
                          <span className="text-xs">
                            {SENTIMENT_ICON[item.sentiment] ?? "·"}
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-300">
                          {item.label}
                        </span>
                        <span className="text-[10px] capitalize text-zinc-600">
                          {item.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Single-Member View (only when NOT in focus mode) ── */}
      {!isFocusMode && member && (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(59,130,246,0.15)" }}
            >
              <span className="w-full text-center text-xs font-bold text-blue-400">
                {member.label.charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-100">
                {member.label}
              </div>
              <div className="text-[10px] capitalize text-zinc-500">
                {"role" in member ? member.role : ""} ·{" "}
                {"age" in member && member.age ? `${member.age}y` : ""}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {groups.length === 0 ? (
              <div className="px-2 py-8 text-center text-xs text-zinc-600">
                No preferences found
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <div key={group.key}>
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded"
                        style={{ background: group.bgClass, color: group.color }}
                      >
                        {group.icon}
                      </div>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: group.color }}
                      >
                        {group.label}
                      </span>
                      <span className="text-[9px] text-zinc-600">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                        >
                          {item.sentiment && (
                            <span className="text-xs">
                              {SENTIMENT_ICON[item.sentiment] ?? "·"}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] text-zinc-300">
                              {item.label}
                            </div>
                            <div className="truncate text-[10px] capitalize text-zinc-600">
                              {item.detail}
                            </div>
                          </div>
                          <ChevronRight
                            size={12}
                            className="shrink-0 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
