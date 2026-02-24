"use client";

import { useState, useMemo } from "react";
import type {
  FamilyGraph as FamilyGraphData,
  FamilyNode,
  MemberNode,
  PreferenceNode,
  HealthNode,
  DeviceNode,
  DocumentNode,
  Edge,
  SynapseEvent,
} from "@/types/family";
import type { Command, RelevantContext } from "@/types/command";
import { dispatch } from "@/lib/devices/controller";
import { LivoRewardCard, type RewardSuggestion } from "@/components/CelebrationEffect";
import type { MediatorAlert } from "@/lib/livo/mediator";
import { value_filter, type ValueFilterResult } from "@/lib/livo/filters";
import mockData from "@/data/family-mock.json";

const data = mockData as FamilyGraphData;

// ── Insight types ──

interface Insight {
  id: string;
  icon: string;
  category: "safety" | "suggestion" | "celebration" | "reminder";
  message: string;
  actionLabel: string;
  onAction: () => void;
  timestamp?: string;
}

// ── Relevant Context types ──

interface ContextItem {
  id: string;
  icon: string;
  label: string;
  detail: string;
  checked: boolean;
}

interface ContextSection {
  type: RelevantContext;
  title: string;
  icon: string;
  items: ContextItem[];
}

interface CategoryStyle {
  border: string;
  bg: string;
  iconBg: string;
  actionText: string;
  actionHover: string;
  headerText: string;
}

const CATEGORY_STYLES: Record<Insight["category"], CategoryStyle> = {
  safety: {
    border: "border-red-500/25",
    bg: "bg-red-500/[0.06]",
    iconBg: "bg-red-500/10",
    actionText: "text-red-400",
    actionHover: "hover:bg-red-500/15",
    headerText: "text-red-400",
  },
  celebration: {
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/[0.04]",
    iconBg: "bg-yellow-500/10",
    actionText: "text-yellow-400",
    actionHover: "hover:bg-yellow-500/15",
    headerText: "text-yellow-400/80",
  },
  suggestion: {
    border: "border-blue-500/15",
    bg: "bg-blue-500/[0.03]",
    iconBg: "bg-blue-500/10",
    actionText: "text-blue-400",
    actionHover: "hover:bg-blue-500/15",
    headerText: "text-blue-400/80",
  },
  reminder: {
    border: "border-emerald-500/15",
    bg: "bg-emerald-500/[0.03]",
    iconBg: "bg-emerald-500/10",
    actionText: "text-emerald-400",
    actionHover: "hover:bg-emerald-500/15",
    headerText: "text-emerald-400/80",
  },
};

const CATEGORY_META: Record<Insight["category"], { icon: string; label: string }> = {
  safety: { icon: "\ud83d\udee1\ufe0f", label: "Safety" },
  celebration: { icon: "\ud83c\udf89", label: "Celebration" },
  suggestion: { icon: "\ud83d\udca1", label: "Suggestions" },
  reminder: { icon: "\ud83d\udccb", label: "Reminders" },
};

// ── Helpers ──

function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sub-components ──

function CompactInsightCard({ insight, style }: { insight: Insight; style: CategoryStyle }) {
  return (
    <div
      className={`group flex items-start gap-2 rounded-lg border ${style.border} ${style.bg} px-3 py-2 transition-colors`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] ${style.iconBg}`}>
        {insight.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-snug text-zinc-300">
          {insight.message}
        </p>
        {insight.timestamp && (
          <p className="mt-0.5 text-[9px] text-zinc-600">
            {formatRelativeTime(insight.timestamp)}
          </p>
        )}
      </div>
      <button
        onClick={insight.onAction}
        title={insight.actionLabel}
        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium opacity-60 transition-opacity group-hover:opacity-100 ${style.actionText} ${style.actionHover}`}
      >
        {insight.actionLabel}
      </button>
    </div>
  );
}

function CollapsibleSection({
  category,
  items,
  isCollapsed,
  onToggle,
}: {
  category: Insight["category"];
  items: Insight[];
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const style = CATEGORY_STYLES[category];
  const meta = CATEGORY_META[category];
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-lg border ${style.border} ${style.bg} px-3 py-2 transition-colors hover:brightness-125`}
      >
        <span className="text-sm">{meta.icon}</span>
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${style.headerText}`}>
          {meta.label}
        </span>
        <span className={`text-[10px] ${style.headerText} opacity-60`}>
          ({items.length})
        </span>
        <svg
          className={`ml-auto h-3 w-3 text-zinc-500 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="mt-1.5 flex flex-col gap-1 pl-1">
          {items.map((insight) => (
            <CompactInsightCard key={insight.id} insight={insight} style={style} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FamilyInsightsProps {
  viewerId: string;
  activeCommand?: Command | null;
  onClearCommand?: () => void;
  rewardCards?: RewardSuggestion[];
  onTriggerCelebration?: (eventId: string) => void;
  onDismissReward?: (eventId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  mediatorAlert?: MediatorAlert | null;
}

export default function FamilyInsights({ viewerId, activeCommand, onClearCommand, rewardCards, onTriggerCelebration, onDismissReward, onSelectNode, mediatorAlert }: FamilyInsightsProps) {
  const viewer = data.nodes.find((n) => n.id === viewerId) as MemberNode | undefined;
  const viewerLabel = viewer?.label ?? "User";

  const insights = useMemo(() => {
    const result: Insight[] = [];
    const events = ((data as FamilyGraphData).synapseEvents ?? []) as SynapseEvent[];

    // ── 1. Safety: Detect high-risk nodes connected to family members ──
    // Skip nodes already covered by mediatorAlert (avoids duplicate cards)
    const highRiskNodes = data.nodes.filter(
      (n) => n.riskLevel === "high" && !(mediatorAlert && mediatorAlert.targetNodeId === n.id),
    );
    for (const riskNode of highRiskNodes) {
      // Find which member owns/connects to this risk node
      const ownerEdge = data.edges.find(
        (e) =>
          (e.target === riskNode.id && e.source.startsWith("m-")) ||
          (e.source === riskNode.id && e.target.startsWith("m-")),
      );
      if (ownerEdge) {
        const memberId =
          ownerEdge.source.startsWith("m-") ? ownerEdge.source : ownerEdge.target;
        const member = data.nodes.find((n) => n.id === memberId);
        if (member) {
          const nodeId = riskNode.id;
          // Find the matching negative synapse event for this member
          const matchingEvent = events.find(
            (ev) => ev.impact === "Negative" && ev.involvedMembers.includes(memberId),
          );
          result.push({
            id: `risk-${riskNode.id}`,
            icon: "\ud83d\udee1\ufe0f",
            category: "safety",
            message: `${riskNode.label} detected on ${member.label}'s device. Review recommended.`,
            actionLabel: "Review Now",
            timestamp: matchingEvent?.timestamp,
            onAction: () => {
              if (onSelectNode) {
                onSelectNode(nodeId);
              }
            },
          });
        }
      }
    }

    // Mediator: Elder financial risk → Respect & Honor coaching card
    if (mediatorAlert) {
      const targetId = mediatorAlert.targetNodeId;
      result.push({
        id: `mediator-${mediatorAlert.eventId}`,
        icon: "\ud83c\udfdb\ufe0f",
        category: "safety",
        message: `${mediatorAlert.elderLabel} is researching a high-risk investment. Use Respect & Honor \u2014 ask to learn from her expertise, not to intervene.`,
        actionLabel: "Talk to Family",
        timestamp: mediatorAlert.event.timestamp,
        onAction: () => {
          if (onSelectNode) {
            onSelectNode(targetId);
          }
        },
      });
    }

    // ── 2. Suggestion: Cross-reference preferences for activity ideas ──
    const prefEdges = data.edges.filter((e) => e.relation === "has_preference");
    const memberPrefs: Record<string, FamilyNode[]> = {};
    for (const edge of prefEdges) {
      const memberId = edge.source.startsWith("m-") ? edge.source : edge.target;
      const prefId = edge.source.startsWith("m-") ? edge.target : edge.source;
      const pref = data.nodes.find((n) => n.id === prefId);
      if (pref) {
        if (!memberPrefs[memberId]) memberPrefs[memberId] = [];
        memberPrefs[memberId].push(pref);
      }
    }

    // Find food-related preferences that could combine
    const foodPrefs = prefEdges
      .map((e) => {
        const prefNode = data.nodes.find(
          (n) => n.id === (e.source.startsWith("m-") ? e.target : e.source),
        );
        const memberId = e.source.startsWith("m-") ? e.source : e.target;
        const member = data.nodes.find((n) => n.id === memberId);
        return prefNode?.type === "preference" &&
          (prefNode as { category?: string }).category === "food"
          ? { member, pref: prefNode }
          : null;
      })
      .filter(Boolean) as { member: FamilyNode; pref: FamilyNode }[];

    if (foodPrefs.length >= 2) {
      const avoids = foodPrefs.find(
        (f) => (f.pref as { sentiment?: string }).sentiment === "avoids",
      );
      const loves = foodPrefs.find(
        (f) => (f.pref as { sentiment?: string }).sentiment === "loves",
      );
      if (avoids && loves) {
        result.push({
          id: "food-combo",
          icon: "\ud83c\udf72",
          category: "suggestion",
          message: `${avoids.member.label} avoids ${avoids.pref.label.toLowerCase()} and ${loves.member.label} loves ${loves.pref.label.toLowerCase()} \u2014 plan a meal everyone enjoys?`,
          actionLabel: "Plan Meal",
          onAction: () =>
            alert(
              `Opening meal planner with dietary notes: ${avoids.member.label} (no ${avoids.pref.label.toLowerCase()}), ${loves.member.label} (loves ${loves.pref.label.toLowerCase()})...`,
            ),
        });
      }
    }

    // ── 3. Celebration: Achievement nodes ──
    const achievements = data.nodes.filter((n) => n.isAchievement);
    for (const ach of achievements) {
      const ownerEdge = data.edges.find(
        (e) =>
          (e.target === ach.id && e.source.startsWith("m-")) ||
          (e.source === ach.id && e.target.startsWith("m-")),
      );
      const memberId = ownerEdge
        ? ownerEdge.source.startsWith("m-")
          ? ownerEdge.source
          : ownerEdge.target
        : null;
      const member = memberId
        ? data.nodes.find((n) => n.id === memberId)
        : null;

      // Find matching positive event for this achievement
      const achEvent = memberId
        ? events.find(
            (ev) => ev.impact === "Positive" && ev.involvedMembers.includes(memberId),
          )
        : undefined;
      result.push({
        id: `ach-${ach.id}`,
        icon: "\ud83c\udfc6",
        category: "celebration",
        message: member
          ? `${member.label} completed "${ach.label}"! Time to celebrate this milestone.`
          : `"${ach.label}" is a new achievement!`,
        actionLabel: "Celebrate",
        timestamp: achEvent?.timestamp,
        onAction: () =>
          alert(
            `Sending celebration to the family for "${ach.label}"! \ud83c\udf89`,
          ),
      });
    }

    // ── 4. Reminder: Authored documents that may need attention ──
    const authoredEdges = data.edges.filter((e) => e.relation === "authored");
    for (const edge of authoredEdges) {
      const memberId = edge.source.startsWith("m-") ? edge.source : edge.target;
      const docId = edge.source.startsWith("m-") ? edge.target : edge.source;
      const member = data.nodes.find((n) => n.id === memberId);
      const doc = data.nodes.find((n) => n.id === docId);
      if (member && doc && doc.visibility !== "private") {
        result.push({
          id: `doc-${doc.id}`,
          icon: "\ud83d\udccb",
          category: "reminder",
          message: `${member.label} manages the ${doc.label}. Should ${viewerLabel} help out tonight?`,
          actionLabel: "Offer Help",
          onAction: () =>
            alert(
              `Sending "${viewerLabel} wants to help with ${doc.label}" to ${member.label}...`,
            ),
        });
      }
    }

    // ── 5. Suggestion: High interaction weight → quality time ──
    const strongBonds = data.edges.filter(
      (e) =>
        (e.weight ?? 0) >= 5 &&
        e.source.startsWith("m-") &&
        e.target.startsWith("m-"),
    );
    for (const bond of strongBonds) {
      const memberA = data.nodes.find((n) => n.id === bond.source);
      const memberB = data.nodes.find((n) => n.id === bond.target);
      if (memberA && memberB) {
        // Find a shared activity preference
        const aPrefs = (memberPrefs[memberA.id] || []).filter(
          (p) => (p as { category?: string }).category === "activity",
        );
        const activity = aPrefs[0];
        result.push({
          id: `bond-${bond.id}`,
          icon: "\ud83d\udc9e",
          category: "suggestion",
          message: activity
            ? `${memberA.label} & ${memberB.label} interact frequently \u2014 plan a ${activity.label.toLowerCase()} outing?`
            : `${memberA.label} & ${memberB.label} have a strong bond. Schedule family time together?`,
          actionLabel: activity ? `Plan ${activity.label}` : "Schedule Time",
          onAction: () =>
            alert(
              `Creating family event for ${memberA.label} & ${memberB.label}...`,
            ),
        });
      }
    }

    return result;
  }, [viewerLabel, onSelectNode, mediatorAlert]);

  // ── Uber Eats order preview state ──
  const [orderPreview, setOrderPreview] = useState<ValueFilterResult | null>(null);

  // ── Collapse state (suggestion & reminder collapsed by default) ──
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Insight["category"]>>(
    () => new Set(["suggestion", "reminder"]),
  );
  const toggleCategory = (cat: Insight["category"]) => {
    if (cat === "safety") return; // never collapse safety
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ── Deduplicate: hide celebration insights that have a reward card ──
  const rewardAchIds = useMemo(
    () => new Set(rewardCards?.map((r) => r.eventId) ?? []),
    [rewardCards],
  );
  const deduplicatedInsights = useMemo(
    () =>
      insights.filter((ins) => {
        if (ins.category === "celebration" && ins.id.startsWith("ach-")) {
          const nodeId = ins.id.replace("ach-", "");
          // Check if any reward card references this achievement node
          return !rewardCards?.some((r) =>
            r.event.involvedMembers.some((mid) =>
              data.edges.some(
                (e) =>
                  ((e.source === mid && e.target === nodeId) ||
                   (e.target === mid && e.source === nodeId)),
              ),
            ),
          );
        }
        return true;
      }),
    [insights, rewardCards, rewardAchIds],
  );

  // ── Group by category in priority order ──
  const groupedInsights = useMemo(() => {
    const groups: Record<Insight["category"], Insight[]> = {
      safety: [],
      celebration: [],
      suggestion: [],
      reminder: [],
    };
    for (const ins of deduplicatedInsights) {
      groups[ins.category].push(ins);
    }
    return groups;
  }, [deduplicatedInsights]);

  // ── Build relevant context sections from the active command ──
  const contextSections = useMemo(() => {
    if (!activeCommand?.relevant_context?.length) return [];

    const sections: ContextSection[] = [];

    for (const ctxType of activeCommand.relevant_context) {
      switch (ctxType) {
        case "dietary_preferences": {
          // Use ValueFilter to aggregate preferences + health-based restrictions
          const vf = value_filter(data.nodes as FamilyNode[], data.edges as Edge[]);
          const items: ContextItem[] = vf.restrictions.map((r) => ({
            id: `${r.memberId}-${r.label}`,
            icon: r.source === "health"
              ? "\ud83c\udfe5"
              : r.sentiment === "avoids" ? "\u274c"
              : r.sentiment === "loves" ? "\u2764\ufe0f"
              : "\ud83d\udc4d",
            label: r.memberLabel,
            detail: r.source === "health"
              ? `${r.label} (health${r.severity ? ` \u00b7 ${r.severity}` : ""})`
              : `${r.sentiment} ${r.label}`,
            checked: true,
          }));
          if (items.length > 0) {
            // Add CP\u5024 guidance as a special item at the end
            items.push({
              id: "cp-value-note",
              icon: "\ud83d\udcb0",
              label: "CP\u5024 Tip",
              detail: vf.cpNote,
              checked: true,
            });
            sections.push({
              type: "dietary_preferences",
              title: "Dietary Constraints",
              icon: "\ud83c\udf7d\ufe0f",
              items,
            });
          }
          break;
        }

        case "activities": {
          const items: ContextItem[] = [];
          const prefEdges = data.edges.filter((e) => e.relation === "has_preference");
          for (const edge of prefEdges) {
            const memberId = edge.source.startsWith("m-") ? edge.source : edge.target;
            const prefId = edge.source.startsWith("m-") ? edge.target : edge.source;
            const member = data.nodes.find((n) => n.id === memberId) as MemberNode | undefined;
            const pref = data.nodes.find((n) => n.id === prefId) as PreferenceNode | undefined;
            if (member && pref?.category === "activity") {
              items.push({
                id: pref.id,
                icon: "\ud83c\udfaf",
                label: member.label,
                detail: `${pref.sentiment} ${pref.label}`,
                checked: true,
              });
            }
          }
          if (items.length > 0) {
            sections.push({
              type: "activities",
              title: "Activity Preferences",
              icon: "\ud83c\udfc3",
              items,
            });
          }
          break;
        }

        case "devices": {
          const deviceNodes = data.nodes.filter((n) => n.type === "device") as DeviceNode[];
          const items: ContextItem[] = deviceNodes.map((d) => {
            const ownerEdge = data.edges.find(
              (e) =>
                (e.relation === "owns_device") &&
                ((e.target === d.id && e.source.startsWith("m-")) ||
                  (e.source === d.id && e.target.startsWith("m-"))),
            );
            const ownerId = ownerEdge
              ? ownerEdge.source.startsWith("m-") ? ownerEdge.source : ownerEdge.target
              : null;
            const owner = ownerId ? data.nodes.find((n) => n.id === ownerId) : null;
            return {
              id: d.id,
              icon: d.riskLevel === "high" ? "\u26a0\ufe0f" : "\ud83d\udcf1",
              label: d.label,
              detail: owner ? `${owner.label}'s \u00b7 ${d.platform}` : d.platform,
              checked: d.riskLevel !== "high",
            };
          });
          if (items.length > 0) {
            sections.push({
              type: "devices",
              title: "Devices",
              icon: "\ud83d\udda5\ufe0f",
              items,
            });
          }
          break;
        }

        case "documents": {
          const docNodes = data.nodes.filter((n) => n.type === "document") as DocumentNode[];
          const items: ContextItem[] = docNodes
            .filter((d) => d.visibility !== "private")
            .map((d) => {
              const authorEdge = data.edges.find(
                (e) =>
                  (e.relation === "authored" || e.relation === "created_by") &&
                  ((e.target === d.id && e.source.startsWith("m-")) ||
                    (e.source === d.id && e.target.startsWith("m-"))),
              );
              const authorId = authorEdge
                ? authorEdge.source.startsWith("m-") ? authorEdge.source : authorEdge.target
                : null;
              const author = authorId ? data.nodes.find((n) => n.id === authorId) : null;
              return {
                id: d.id,
                icon: d.isAchievement ? "\ud83c\udfc6" : "\ud83d\udcc4",
                label: d.label,
                detail: author ? `by ${author.label} \u00b7 ${d.docType}` : d.docType,
                checked: true,
              };
            });
          if (items.length > 0) {
            sections.push({
              type: "documents",
              title: "Documents",
              icon: "\ud83d\udcc1",
              items,
            });
          }
          break;
        }

        case "members": {
          const memberNodes = data.nodes.filter((n) => n.type === "member") as MemberNode[];
          const items: ContextItem[] = memberNodes.map((m) => ({
            id: m.id,
            icon: m.role === "parent" ? "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67" : "\ud83e\uddd2",
            label: m.label,
            detail: `${m.role}${m.age ? ` \u00b7 age ${m.age}` : ""}`,
            checked: !activeCommand.target_member || activeCommand.target_member === m.id,
          }));
          if (items.length > 0) {
            sections.push({
              type: "members",
              title: "Family Members",
              icon: "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66",
              items,
            });
          }
          break;
        }

        case "schedules": {
          // No schedule data in mock — show placeholder
          sections.push({
            type: "schedules",
            title: "Schedules",
            icon: "\ud83d\udcc5",
            items: [
              {
                id: "no-schedule",
                icon: "\ud83d\udcc5",
                label: "No upcoming events",
                detail: "Calendar is clear",
                checked: true,
              },
            ],
          });
          break;
        }
      }
    }

    return sections;
  }, [activeCommand]);

  // ── Priority badge colors ──
  const PRIORITY_COLORS: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-400",
    high: "bg-orange-500/15 text-orange-400",
    medium: "bg-yellow-500/15 text-yellow-400",
    low: "bg-zinc-700/50 text-zinc-400",
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-xs">
          <svg
            className="h-3.5 w-3.5 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-zinc-200">Family Insights</span>
        <span className="ml-auto rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
          Livo
        </span>
      </div>

      {/* Viewer context */}
      <div className="border-b border-white/[0.06] px-4 py-2">
        <p className="text-[10px] text-zinc-600">
          Suggestions for{" "}
          <span className="font-medium text-zinc-400">{viewerLabel}</span>
          {" \u00b7 "}
          {deduplicatedInsights.length} insights
        </p>
      </div>

      {/* ── Active Command: Relevant Context ── */}
      {activeCommand && contextSections.length > 0 && (
        <div className="border-b border-indigo-500/20 bg-indigo-500/[0.03]">
          {/* Command summary bar */}
          <div className="flex items-center gap-2 border-b border-indigo-500/10 px-4 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/15 text-[10px] text-indigo-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-200">
                {activeCommand.summary}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-medium text-indigo-400">
                  {activeCommand.action}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${PRIORITY_COLORS[activeCommand.priority]}`}>
                  {activeCommand.priority}
                </span>
                {activeCommand.location !== "unknown" && (
                  <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] text-zinc-400">
                    {activeCommand.location.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClearCommand}
              className="rounded p-0.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Relevant Context header */}
          <div className="px-4 pt-2.5 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">
              Relevant Context
            </p>
          </div>

          {/* Context sections */}
          <div className="px-3 pb-3">
            {contextSections.map((section) => (
              <div key={section.type} className="mt-2">
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <span className="text-xs">{section.icon}</span>
                  <span className="text-[10px] font-medium text-zinc-400">
                    {section.title}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                    >
                      {/* Checkmark */}
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                          item.checked
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-700/40 text-zinc-600"
                        }`}
                      >
                        {item.checked ? (
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        )}
                      </span>
                      {/* Item icon */}
                      <span className="text-xs">{item.icon}</span>
                      {/* Label + detail */}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-zinc-300">{item.label}</span>
                        <span className="ml-1.5 text-[10px] text-zinc-600">{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ValueFilter: Aggregated food instruction for COOK/BUY commands */}
          {(activeCommand.action === "COOK" || activeCommand.action === "BUY") &&
            activeCommand.relevant_context.includes("dietary_preferences") && (() => {
              const vf = value_filter(data.nodes as FamilyNode[], data.edges as Edge[]);
              return vf.restrictions.length > 0 ? (
                <div className="mx-3 mb-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/70">
                    Food Agent Instruction
                  </p>
                  <p className="whitespace-pre-line text-[11px] leading-relaxed text-zinc-300">
                    {vf.instruction}
                  </p>
                  <p className="mt-1.5 text-[10px] text-emerald-400/60">
                    {vf.cpNote}
                  </p>
                </div>
              ) : null;
            })()}

          {/* Dispatch action button */}
          <div className="px-3 pb-3">
            {(activeCommand.action === "COOK" || activeCommand.action === "BUY") ? (
              <>
                <button
                  onClick={() => {
                    const vf = value_filter(data.nodes as FamilyNode[], data.edges as Edge[]);
                    setOrderPreview(vf);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/15 px-3 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/25"
                >
                  Order on Uber Eats
                  <span className="text-sm">🛵</span>
                </button>

                {/* Order summary card */}
                {orderPreview && (
                  <div className="mt-2 rounded-lg border border-green-500/20 bg-green-500/[0.04] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm">🛵</span>
                      <span className="text-[11px] font-semibold text-green-400">Uber Eats — Family Order</span>
                    </div>

                    <p className="mb-2 text-[10px] text-zinc-500">
                      Party size: {new Set(orderPreview.restrictions.map((r) => r.memberLabel)).size} members
                    </p>

                    <div className="flex flex-col gap-1">
                      {orderPreview.restrictions.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px]">
                          <span>{r.source === "health" ? "\ud83c\udfe5" : r.sentiment === "avoids" ? "\u274c" : "\u2764\ufe0f"}</span>
                          <span className="text-zinc-300">{r.label}</span>
                          <span className="text-zinc-600">({r.memberLabel})</span>
                        </div>
                      ))}
                    </div>

                    <p className="mt-2 text-[10px] text-green-400/60">{orderPreview.cpNote}</p>

                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => {
                          const result = dispatch(activeCommand);
                          setOrderPreview(null);
                          alert(`✅ ${result.message}`);
                        }}
                        className="flex-1 rounded-md bg-green-500/20 py-1.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-500/30"
                      >
                        Confirm Order 🛵
                      </button>
                      <button
                        onClick={() => setOrderPreview(null)}
                        className="rounded-md px-3 py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  const result = dispatch(activeCommand);
                  alert(
                    result.status === "dispatched"
                      ? `Dispatched to ${result.device}: ${result.message}`
                      : `${result.message}`,
                  );
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-3 py-2 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/25"
              >
                Execute Command
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Insight cards — grouped by category with collapsible sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-2.5">
          {/* Reward cards (always at top) */}
          {rewardCards?.map((reward) => (
            <LivoRewardCard
              key={reward.eventId}
              reward={reward}
              onCelebrate={() => onTriggerCelebration?.(reward.eventId)}
              onDismiss={() => onDismissReward?.(reward.eventId)}
            />
          ))}

          {/* Safety — always expanded */}
          {groupedInsights.safety.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className={`flex items-center gap-2 rounded-lg border ${CATEGORY_STYLES.safety.border} ${CATEGORY_STYLES.safety.bg} px-3 py-2`}>
                <span className="text-sm">{CATEGORY_META.safety.icon}</span>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${CATEGORY_STYLES.safety.headerText}`}>
                  {CATEGORY_META.safety.label}
                </span>
                <span className={`text-[10px] ${CATEGORY_STYLES.safety.headerText} opacity-60`}>
                  ({groupedInsights.safety.length})
                </span>
              </div>
              <div className="flex flex-col gap-1 pl-1">
                {groupedInsights.safety.map((ins) => (
                  <CompactInsightCard key={ins.id} insight={ins} style={CATEGORY_STYLES.safety} />
                ))}
              </div>
            </div>
          )}

          {/* Celebration — expanded by default */}
          <CollapsibleSection
            category="celebration"
            items={groupedInsights.celebration}
            isCollapsed={collapsedCategories.has("celebration")}
            onToggle={() => toggleCategory("celebration")}
          />

          {/* Suggestion — collapsed by default */}
          <CollapsibleSection
            category="suggestion"
            items={groupedInsights.suggestion}
            isCollapsed={collapsedCategories.has("suggestion")}
            onToggle={() => toggleCategory("suggestion")}
          />

          {/* Reminder — collapsed by default */}
          <CollapsibleSection
            category="reminder"
            items={groupedInsights.reminder}
            isCollapsed={collapsedCategories.has("reminder")}
            onToggle={() => toggleCategory("reminder")}
          />

          {/* Empty state */}
          {deduplicatedInsights.length === 0 && !rewardCards?.length && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-xs text-zinc-500">No insights at the moment</p>
              <p className="mt-1 text-[10px] text-zinc-600">Family is doing great!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
