"use client";

import type {
  FamilyGraph as FamilyGraphData,
  FamilyNode,
  NodeType,
} from "@/types/family";
import mockData from "@/data/family-mock.json";
import PrivacyNode from "@/components/PrivacyNode";

const data = mockData as FamilyGraphData;

const TYPE_COLORS: Record<NodeType, string> = {
  member: "#3b82f6",
  preference: "#f59e0b",
  device: "#8b5cf6",
  document: "#10b981",
  health: "#ef4444",
  house_rule: "#06b6d4",
};

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
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

function getNodeMeta(node: FamilyNode): { key: string; value: string; color?: string }[] {
  const meta: { key: string; value: string; color?: string }[] = [
    { key: "Type", value: node.type },
    { key: "ID", value: node.id },
  ];

  if (node.riskLevel) {
    meta.push({ key: "Risk Level", value: node.riskLevel, color: RISK_COLORS[node.riskLevel] });
  }
  if (node.visibility) {
    meta.push({ key: "Visibility", value: node.visibility });
  }
  if (node.isAchievement) {
    meta.push({ key: "Achievement", value: "Yes", color: "#eab308" });
  }

  if (node.type === "member") {
    meta.push({ key: "Role", value: node.role });
    if (node.age != null) meta.push({ key: "Age", value: String(node.age) });
    if (node.healthTags?.length) meta.push({ key: "Health", value: node.healthTags.join(", "), color: "#ef4444" });
    if (node.adminLevel) meta.push({ key: "Admin Level", value: node.adminLevel });
  }
  if (node.type === "preference") {
    meta.push({ key: "Category", value: node.category });
    meta.push({ key: "Sentiment", value: node.sentiment });
  }
  if (node.type === "device") {
    meta.push({ key: "Platform", value: node.platform });
    if (node.os) meta.push({ key: "OS", value: node.os });
  }
  if (node.type === "document") {
    meta.push({ key: "Doc Type", value: node.docType });
  }
  if (node.type === "health") {
    meta.push({ key: "Condition", value: node.condition });
    if (node.severity) meta.push({ key: "Severity", value: node.severity });
  }
  if (node.type === "house_rule") {
    meta.push({ key: "Trigger", value: node.trigger });
    meta.push({ key: "Condition", value: node.condition });
    meta.push({ key: "Action", value: node.action });
  }
  return meta;
}

interface NodeDetailProps {
  nodeId: string | null;
  viewerId: string;
  onClose: () => void;
}

/** Find the owner member of a non-member node by walking edges */
function findNodeOwner(nodeId: string): string | null {
  for (const edge of data.edges) {
    if (edge.target === nodeId && edge.source.startsWith("m-")) return edge.source;
    if (edge.source === nodeId && edge.target.startsWith("m-")) return edge.target;
  }
  return null;
}

export default function NodeDetail({ nodeId, viewerId, onClose }: NodeDetailProps) {
  if (!nodeId) return null;

  const node = data.nodes.find((n) => n.id === nodeId) as FamilyNode | undefined;
  if (!node) return null;

  const connections = data.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const otherId = e.source === nodeId ? e.target : e.source;
      const otherNode = data.nodes.find((n) => n.id === otherId);
      return { relation: e.relation, label: e.label, node: otherNode };
    });

  const color = TYPE_COLORS[node.type];
  const isHighRisk = node.riskLevel === "high";
  const isAchievement = node.isAchievement;

  // Ownership & access control
  const isOwner = node.type === "member" || findNodeOwner(node.id) === viewerId;
  const isMasked = isHighRisk && !isOwner;
  const isPrivate = !isOwner && !isMasked &&
    (node.visibility === "private" || node.visibility === "guarded");

  // For private/guarded non-owner nodes, render the PrivacyNode component
  if (isPrivate) {
    const ownerMemberId = findNodeOwner(node.id);
    const ownerNode = ownerMemberId
      ? data.nodes.find((n) => n.id === ownerMemberId)
      : undefined;
    return (
      <PrivacyNode
        node={node}
        isOwner={false}
        ownerLabel={ownerNode?.label}
        onClose={onClose}
      />
    );
  }

  // For owner-viewed private/guarded nodes, render PrivacyNode with full access
  const isOwnerPrivate = isOwner && node.type !== "member" &&
    (node.visibility === "private" || node.visibility === "guarded");
  if (isOwnerPrivate) {
    return (
      <PrivacyNode
        node={node}
        isOwner={true}
        onClose={onClose}
      />
    );
  }

  // For masked nodes, show restricted info only
  const meta = isMasked
    ? [
        { key: "Type", value: node.type },
        { key: "Risk Level", value: "high", color: RISK_COLORS.high },
        { key: "Access", value: "Restricted", color: "#71717a" },
      ]
    : getNodeMeta(node);

  const displayLabel = isMasked ? "\u26a0 System Alert" : node.label;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              backgroundColor: isHighRisk
                ? "rgba(239,68,68,0.15)"
                : isAchievement
                  ? "rgba(234,179,8,0.15)"
                  : `${color}20`,
              color: isHighRisk ? "#ef4444" : isAchievement ? "#eab308" : color,
            }}
          >
            {isMasked ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              TYPE_ICONS[node.type]
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{displayLabel}</h2>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {node.type}
              </span>
              {isHighRisk && (
                <span className="inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                  High Risk
                </span>
              )}
              {isAchievement && (
                <span className="inline-block rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-400">
                  Achievement
                </span>
              )}
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

      {/* Masked access banner */}
      {isMasked && (
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3">
            <p className="text-smleading-relaxed text-zinc-400">
              This node has been flagged as <span className="font-medium text-red-400">high risk</span>.
              Details are restricted to the node owner.
            </p>
            <button
              onClick={() => alert(`Access request sent for "${node.label}" to the node owner.`)}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Request Access
            </button>
          </div>
        </div>
      )}

      {/* Properties */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-widest text-zinc-500">
          Properties
        </p>
        <div className="flex flex-col gap-1.5">
          {meta.map((m) => (
            <div key={m.key} className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">{m.key}</span>
              <span
                className="rounded px-2 py-0.5 text-smcapitalize"
                style={{
                  backgroundColor: m.color ? `${m.color}15` : undefined,
                  color: m.color ?? undefined,
                }}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Connections (hidden for masked nodes) */}
      {!isMasked && (
        <div className="px-4 py-3">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-widest text-zinc-500">
            Connections
            <span className="ml-1.5 text-zinc-600">({connections.length})</span>
          </p>
          <div className="flex flex-col gap-1">
            {connections.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-basehover:bg-zinc-800/60"
              >
                {c.node && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[c.node.type as NodeType] }}
                  />
                )}
                <span className="text-zinc-300">{c.node?.label ?? "?"}</span>
                <span className="ml-auto text-[13px] text-zinc-600">
                  {c.relation.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
