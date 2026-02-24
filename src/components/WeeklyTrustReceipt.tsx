"use client";

import { useMemo } from "react";
import type {
  FamilyGraph as FamilyGraphData,
  FamilyNode,
  MemberNode,
  SynapseEvent,
  Edge,
} from "@/types/family";
import type { HighRiskAlert } from "@/lib/livo/high-risk-handler";
import type { MediatorAlert } from "@/lib/livo/mediator";
import mockData from "@/data/family-mock.json";

// ── Types ────────────────────────────────────────────────────

export interface TrustMetrics {
  scholarRedirects: number;       // Homework shortcuts → scaffolding
  scholarDetails: string[];       // Kids whose homework was redirected
  scamsIntercepted: number;       // Financial scams blocked for elders
  scamDetails: string[];          // Details of intercepted scams
  positiveEvents: number;         // Positive family moments this week
  negativeEvents: number;         // Concerns handled
  familyBondScore: number;        // 0-100 composite trust score
  topMoment: string;              // Best family moment of the week
  weekLabel: string;              // e.g. "Feb 17 – Feb 24"
}

interface WeeklyTrustReceiptProps {
  highRiskAlert: HighRiskAlert | null;
  mediatorAlert: MediatorAlert | null;
  onClose: () => void;
}

// ── Metrics computation ──────────────────────────────────────

function computeTrustMetrics(
  events: SynapseEvent[],
  nodes: FamilyNode[],
  edges: Edge[],
  highRiskAlert: HighRiskAlert | null,
  mediatorAlert: MediatorAlert | null,
): TrustMetrics {
  // Scholar redirects: count child members who have homework-capable ages
  // In production this would track actual filter activations; for demo we
  // infer from graph structure (children with device access = learning context)
  const children = nodes.filter(
    (n) => n.type === "member" && "role" in n && n.role === "child",
  ) as MemberNode[];

  const scholarDetails: string[] = [];
  for (const child of children) {
    // Children with device edges = digital learning, eligible for ScholarFilter
    const hasDevice = edges.some(
      (e) =>
        e.relation === "owns_device" &&
        (e.source === child.id || e.target === child.id),
    );
    if (hasDevice) {
      scholarDetails.push(`${child.label} (age ${child.age ?? "?"})`);
    }
  }
  // Each child with device access represents potential homework redirections
  // Using event count as proxy: each negative event involving children = 1 redirect
  const childNegativeEvents = events.filter(
    (e) =>
      e.impact === "Negative" &&
      e.involvedMembers.some((id) =>
        children.some((c) => c.id === id),
      ),
  );
  const scholarRedirects = Math.max(scholarDetails.length, childNegativeEvents.length);

  // Scams intercepted: count financial risk events involving elders
  const scamDetails: string[] = [];
  if (mediatorAlert) {
    scamDetails.push(
      `${mediatorAlert.elderLabel}: ${mediatorAlert.event.description}`,
    );
  }
  // Also check for any high-risk financial document nodes connected to elders
  const elders = nodes.filter(
    (n) => n.type === "member" && "role" in n && n.role === "grandparent",
  );
  const elderIds = new Set(elders.map((n) => n.id));
  const financialRiskNodes = nodes.filter(
    (n) => n.type === "document" && n.riskLevel === "high" && "docType" in n && n.docType === "financial",
  );
  for (const frn of financialRiskNodes) {
    const connectedToElder = edges.some(
      (e) =>
        (e.source === frn.id && elderIds.has(e.target)) ||
        (e.target === frn.id && elderIds.has(e.source)),
    );
    if (connectedToElder) {
      const elder = elders.find((el) =>
        edges.some(
          (e) =>
            (e.source === frn.id && e.target === el.id) ||
            (e.target === frn.id && e.source === el.id),
        ),
      );
      const detail = `${elder?.label ?? "Elder"}: ${frn.label} flagged`;
      if (!scamDetails.includes(detail)) {
        scamDetails.push(detail);
      }
    }
  }
  const scamsIntercepted = scamDetails.length;

  // Event counts
  const positiveEvents = events.filter((e) => e.impact === "Positive").length;
  const negativeEvents = events.filter((e) => e.impact === "Negative").length;

  // Top moment: highest intensity positive event
  const topPositive = events
    .filter((e) => e.impact === "Positive")
    .sort((a, b) => b.intensity - a.intensity)[0];
  const topMoment = topPositive?.description ?? "No positive moments recorded";

  // Family bond score: composite metric
  // Base: 50 + (positive * 8) - (negative * 5) + (scholar * 3) + (scam * 10)
  const raw =
    50 +
    positiveEvents * 8 -
    negativeEvents * 5 +
    scholarRedirects * 3 +
    scamsIntercepted * 10;
  const familyBondScore = Math.max(0, Math.min(100, raw));

  // Week label
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekLabel = `${fmt(weekAgo)} \u2013 ${fmt(now)}`;

  return {
    scholarRedirects,
    scholarDetails,
    scamsIntercepted,
    scamDetails,
    positiveEvents,
    negativeEvents,
    familyBondScore,
    topMoment,
    weekLabel,
  };
}

// ── Component ────────────────────────────────────────────────

export default function WeeklyTrustReceipt({
  highRiskAlert,
  mediatorAlert,
  onClose,
}: WeeklyTrustReceiptProps) {
  const data = mockData as FamilyGraphData;
  const events = (data.synapseEvents ?? []) as SynapseEvent[];

  const metrics = useMemo(
    () =>
      computeTrustMetrics(
        events,
        data.nodes as FamilyNode[],
        data.edges as Edge[],
        highRiskAlert,
        mediatorAlert,
      ),
    [events, data.nodes, data.edges, highRiskAlert, mediatorAlert],
  );

  // Score color
  const scoreColor =
    metrics.familyBondScore >= 80
      ? "text-emerald-400"
      : metrics.familyBondScore >= 60
        ? "text-amber-400"
        : "text-red-400";

  const scoreBarColor =
    metrics.familyBondScore >= 80
      ? "bg-emerald-500"
      : metrics.familyBondScore >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-xs">
          <svg
            className="h-3.5 w-3.5 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-200">
            Weekly Trust Receipt
          </span>
          <p className="text-[10px] text-zinc-600">{metrics.weekLabel}</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
          Livo
        </span>
        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-400"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Family Bond Score */}
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Family Bond Score
            </p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${scoreColor}`}>
              {metrics.familyBondScore}
              <span className="text-sm font-normal text-zinc-600">/100</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600">This week</p>
            <p className="text-[10px] text-emerald-400/70">
              {metrics.positiveEvents} positive &middot; {metrics.negativeEvents} handled
            </p>
          </div>
        </div>
        {/* Score bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${scoreBarColor}`}
            style={{ width: `${metrics.familyBondScore}%` }}
          />
        </div>
      </div>

      {/* Scholar Redirects */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500/10">
            <svg
              className="h-4 w-4 text-lime-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-lime-400 tabular-nums">
                {metrics.scholarRedirects}
              </span>
              <span className="text-xs text-zinc-400">
                Learning Shortcuts Redirected
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              ScholarFilter: Homework requests redirected to understanding
            </p>
          </div>
        </div>
        {/* Scholar details */}
        {metrics.scholarDetails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {metrics.scholarDetails.map((detail) => (
              <span
                key={detail}
                className="rounded-full border border-lime-500/20 bg-lime-500/[0.06] px-2 py-0.5 text-[10px] text-lime-400/80"
              >
                {detail}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scams Intercepted */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <svg
              className="h-4 w-4 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-amber-400 tabular-nums">
                {metrics.scamsIntercepted}
              </span>
              <span className="text-xs text-zinc-400">
                Financial Scams Intercepted
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              LivoMediator: Elder financial risks handled with Respect &amp; Honor
            </p>
          </div>
        </div>
        {/* Scam details */}
        {metrics.scamDetails.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {metrics.scamDetails.map((detail, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1.5"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <span className="text-[10px] leading-snug text-zinc-300">
                  {detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Moment */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Top Family Moment
        </p>
        <div className="mt-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
          <p className="text-xs leading-relaxed text-zinc-300">
            {metrics.topMoment}
          </p>
        </div>

        {/* Mini event breakdown */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-500/[0.06] px-2 py-1.5 text-center">
            <p className="text-sm font-bold text-emerald-400 tabular-nums">
              {metrics.positiveEvents}
            </p>
            <p className="text-[9px] text-zinc-600">Positive</p>
          </div>
          <div className="rounded-lg bg-red-500/[0.06] px-2 py-1.5 text-center">
            <p className="text-sm font-bold text-red-400 tabular-nums">
              {metrics.negativeEvents}
            </p>
            <p className="text-[9px] text-zinc-600">Handled</p>
          </div>
          <div className="rounded-lg bg-indigo-500/[0.06] px-2 py-1.5 text-center">
            <p className="text-sm font-bold text-indigo-400 tabular-nums">
              {(mockData as FamilyGraphData).nodes.filter((n) => n.type === "member").length}
            </p>
            <p className="text-[9px] text-zinc-600">Members</p>
          </div>
        </div>

        {/* Livo signature */}
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-indigo-500/[0.04] px-2.5 py-2">
          <div className="h-2 w-2 rounded-full bg-indigo-400/60" />
          <p className="text-[10px] italic text-zinc-500">
            &ldquo;Trust is built one redirected shortcut at a time. Keep going, family.&rdquo;
          </p>
          <span className="ml-auto text-[9px] text-indigo-400/50">
            &mdash; Livo
          </span>
        </div>
      </div>
    </div>
  );
}
