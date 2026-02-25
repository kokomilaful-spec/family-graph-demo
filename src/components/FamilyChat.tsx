"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generateCoachingScripts,
  type CoachingScript,
  type UserRole,
} from "@/lib/livo/coaching";
import {
  practiceWithLivo,
  practiceWithGrandma,
  type PracticeTurn,
  type ElderPracticeTurn,
  type PracticeResponse,
} from "@/lib/livo/practice";
import type { SynapseEvent } from "@/types/family";
import type { HighRiskAlert } from "@/lib/livo/high-risk-handler";
import type { MediatorAlert } from "@/lib/livo/mediator";
import { scholar_filter } from "@/lib/livo/filters";
import type { FamilyNode } from "@/types/family";
import mockData from "@/data/family-mock.json";

// ── Types ────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "livo" | "child" | "feedback";
  text: string;
  tone?: string;
  rating?: PracticeResponse["rating"];
}

interface FamilyChatProps {
  /** High-risk node ID that triggers Coach View — null when inactive */
  coachNodeId: string | null;
  viewerRole: UserRole;
  onClose: () => void;
  /** Negative synapse events — auto-triggers Empathy Coach Mode */
  negativeEvents?: SynapseEvent[];
  /** Pre-computed high-risk alert with Trendlife scripts from handle_high_risk_event */
  highRiskAlert?: HighRiskAlert | null;
  /** Pre-computed mediator alert with Respect & Honor scripts from livo_mediator */
  mediatorAlert?: MediatorAlert | null;
}

// ── Empathy-First script generation ─────────────────────────

interface EmpathyScript {
  tone: string;
  message: string;
  followUp: string;
}

function buildEmpathyScripts(event: SynapseEvent): EmpathyScript[] {
  const memberLabels = event.involvedMembers.map((id) => {
    const n = mockData.nodes.find((n) => n.id === id);
    return n?.label ?? id;
  });
  const names = memberLabels.join(" and ");
  const desc = event.description;

  if (/suspicious|app|install/i.test(desc)) {
    return [
      {
        tone: "Warm",
        message: `I noticed something on your device and I want to understand it together. I'm not upset — I care about your safety and want to talk about it.`,
        followUp: `What do you like about this app? Can you show me how it works?`,
      },
      {
        tone: "Curious",
        message: `I saw something I didn't recognize and I'm genuinely curious about it. Can you help me understand what it's for?`,
        followUp: `Do your friends use it too? What do you usually do on it?`,
      },
      {
        tone: "Supportive",
        message: `I know you value your privacy, and I respect that. I also want to make sure we're on the same page about online safety. Can we chat about it?`,
        followUp: `What would make you feel comfortable sharing more about your apps with me?`,
      },
    ];
  }

  if (/rule|trigger|ignore/i.test(desc)) {
    return [
      {
        tone: "Gentle",
        message: `I noticed the ${desc.toLowerCase().includes("tech") ? "tech-free" : "family"} rule wasn't followed last night. Let's talk about what happened — I want to hear your side.`,
        followUp: `Is there something that made it hard to follow the rule? Let's figure it out together.`,
      },
      {
        tone: "Empathetic",
        message: `I know rules can feel frustrating sometimes. I'd love to understand what you were doing that made it hard to stop. Your feelings matter to me.`,
        followUp: `Would adjusting the rule make it easier? What would feel fair to you?`,
      },
      {
        tone: "Collaborative",
        message: `${names}, let's revisit this rule together. I want it to work for everyone, not just feel like a punishment.`,
        followUp: `What if we set up the rule together so it feels more like our agreement?`,
      },
    ];
  }

  // Default empathy scripts
  return [
    {
      tone: "Warm",
      message: `I noticed something that concerns me and I'd love to talk about it. ${names}, I want you to know I'm coming from a place of care, not judgment.`,
      followUp: `How are you feeling about this? I'm here to listen.`,
    },
    {
      tone: "Gentle",
      message: `Something came up that I think we should discuss as a family. ${names}, let's find a quiet moment to talk — no pressure.`,
      followUp: `What would help you feel comfortable talking about this?`,
    },
    {
      tone: "Supportive",
      message: `I want to check in with you about something. I trust you, and I think talking about it openly will help us both feel better.`,
      followUp: `Is there anything you need from me right now?`,
    },
  ];
}

// ── Tone badge colors ────────────────────────────────────────

const TONE_COLORS: Record<string, string> = {
  Gentle: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  Direct: "border-blue-500/30 bg-blue-500/15 text-blue-400",
  Curious: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  Playful: "border-purple-500/30 bg-purple-500/15 text-purple-400",
  Warm: "border-rose-500/30 bg-rose-500/15 text-rose-400",
  Calm: "border-teal-500/30 bg-teal-500/15 text-teal-400",
  Supportive: "border-sky-500/30 bg-sky-500/15 text-sky-400",
  Empathetic: "border-pink-500/30 bg-pink-500/15 text-pink-400",
  Collaborative: "border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
  "Safety-First": "border-red-500/30 bg-red-500/15 text-red-400",
  "Trust-Building": "border-indigo-500/30 bg-indigo-500/15 text-indigo-400",
  "Emotionally Aware": "border-violet-500/30 bg-violet-500/15 text-violet-400",
  "Respect & Honor": "border-amber-600/30 bg-amber-600/15 text-amber-500",
  "Curiosity & Admiration": "border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
  "Family Partnership": "border-orange-500/30 bg-orange-500/15 text-orange-400",
  Scaffolding: "border-lime-500/30 bg-lime-500/15 text-lime-400",
};

const TONE_RING: Record<string, string> = {
  Gentle: "ring-emerald-500/40",
  Direct: "ring-blue-500/40",
  Curious: "ring-amber-500/40",
  Playful: "ring-purple-500/40",
  Warm: "ring-rose-500/40",
  Calm: "ring-teal-500/40",
  Supportive: "ring-sky-500/40",
  Empathetic: "ring-pink-500/40",
  Collaborative: "ring-cyan-500/40",
  "Safety-First": "ring-red-500/40",
  "Trust-Building": "ring-indigo-500/40",
  "Emotionally Aware": "ring-violet-500/40",
  "Respect & Honor": "ring-amber-600/40",
  "Curiosity & Admiration": "ring-yellow-500/40",
  "Family Partnership": "ring-orange-500/40",
  Scaffolding: "ring-lime-500/40",
};

const RATING_STYLES: Record<
  PracticeResponse["rating"],
  { label: string; border: string; bg: string; text: string; dot: string }
> = {
  great: {
    label: "Great",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/8",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  good: {
    label: "Good",
    border: "border-amber-500/30",
    bg: "bg-amber-500/8",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  "needs-work": {
    label: "Needs work",
    border: "border-red-500/30",
    bg: "bg-red-500/8",
    text: "text-red-400",
    dot: "bg-red-400",
  },
};

// ── Glowing Sphere (small inline version) ────────────────────

// ── Component ────────────────────────────────────────────────

export default function FamilyChat({
  coachNodeId,
  viewerRole,
  onClose,
  negativeEvents,
  highRiskAlert,
  mediatorAlert,
}: FamilyChatProps) {
  const [scripts, setScripts] = useState<CoachingScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Practice mode
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<PracticeTurn[]>([]);
  const [practicing, setPracticing] = useState(false);

  // Elder practice mode (Grandma conversations)
  const [elderPracticeHistory, setElderPracticeHistory] = useState<ElderPracticeTurn[]>([]);
  const [elderPracticeIndex, setElderPracticeIndex] = useState(0);

  // Empathy Coach Mode — triggered by negative synapse events
  const [empathyEventId, setEmpathyEventId] = useState<string | null>(null);
  const [empathyDismissed, setEmpathyDismissed] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pick the most intense undismissed negative event
  const activeNegativeEvent = (negativeEvents ?? [])
    .filter((e) => !empathyDismissed.has(e.id))
    .sort((a, b) => b.intensity - a.intensity)[0] ?? null;

  // Empathy mode: active when we have a negative event and no high-risk coach node
  const empathyMode = !coachNodeId && activeNegativeEvent !== null;
  const empathyScripts = activeNegativeEvent ? buildEmpathyScripts(activeNegativeEvent) : [];

  // Trendlife alert mode: handle_high_risk_event detected an app install
  const trendlifeMode = !!(highRiskAlert && coachNodeId && highRiskAlert.targetNodeId === coachNodeId);
  const trendlifeScripts = highRiskAlert?.scripts ?? [];

  // Mediator mode: livo_mediator detected elder financial risk (Respect & Honor)
  const mediatorMode = !!(mediatorAlert && coachNodeId && mediatorAlert.targetNodeId === coachNodeId);
  const mediatorScripts = mediatorAlert?.scripts ?? [];

  // Auto-open empathy mode when a new negative event appears
  useEffect(() => {
    if (activeNegativeEvent && !coachNodeId && empathyEventId !== activeNegativeEvent.id) {
      setEmpathyEventId(activeNegativeEvent.id);
      setMessages([]);
      setInputValue("");
      setSelectedIdx(null);
      setPracticeMode(false);
      setPracticeHistory([]);
    }
  }, [activeNegativeEvent, coachNodeId, empathyEventId]);

  // Resolve node + owner from mock data
  const node = coachNodeId
    ? mockData.nodes.find((n) => n.id === coachNodeId)
    : null;

  const owner = (() => {
    if (!coachNodeId) return null;
    const edge = mockData.edges.find(
      (e) =>
        (e.target === coachNodeId && e.source.startsWith("m-")) ||
        (e.source === coachNodeId && e.target.startsWith("m-"))
    );
    const ownerId = edge
      ? edge.source.startsWith("m-")
        ? edge.source
        : edge.target
      : null;
    return ownerId ? mockData.nodes.find((n) => n.id === ownerId) : null;
  })();

  const childName = owner?.label ?? "Child";
  const isHighRisk = node?.riskLevel === "high";

  // Resolve empathy event member names
  const empathyMemberNames = activeNegativeEvent
    ? activeNegativeEvent.involvedMembers.map((id) => {
        const n = mockData.nodes.find((n) => n.id === id);
        return n?.label ?? id;
      })
    : [];
  const empathyChildName = empathyMemberNames[0] ?? "Family member";

  // ── Fetch coaching scripts when a high-risk node becomes active ──
  const fetchScripts = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      setScripts([]);
      setSelectedIdx(null);
      try {
        const result = await generateCoachingScripts(id, viewerRole);
        setScripts(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate scripts"
        );
      } finally {
        setLoading(false);
      }
    },
    [viewerRole]
  );

  useEffect(() => {
    if (coachNodeId && isHighRisk) {
      fetchScripts(coachNodeId);
      setMessages([]);
      setInputValue("");
      setPracticeMode(false);
      setPracticeHistory([]);
    } else {
      setScripts([]);
      setError(null);
      setSelectedIdx(null);
      setPracticeMode(false);
      setPracticeHistory([]);
    }
  }, [coachNodeId, isHighRisk, fetchScripts]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Apply script text to input field ──
  const handleApply = useCallback(
    (idx: number) => {
      const script = scripts[idx];
      if (!script) return;
      setInputValue(script.message);
      setSelectedIdx(idx);
      inputRef.current?.focus();
    },
    [scripts]
  );

  // ── Enter practice mode ──
  const elderName = mediatorAlert?.elderLabel ?? "Grandma";
  const handleStartPractice = useCallback(() => {
    setPracticeMode(true);
    setPracticeHistory([]);
    setElderPracticeHistory([]);
    const rolePlayTarget = mediatorMode ? elderName : childName;
    const guidanceNote = mediatorMode
      ? `Remember: show respect, not control. Position ${elderName} as the expert. Ask to learn, don't intervene.`
      : `Type what you'd say — I'll respond as ${rolePlayTarget} would, then give you feedback.`;
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: "livo",
        text: `Practice mode active. I'll role-play as ${rolePlayTarget} so you can rehearse your message. ${guidanceNote}`,
      },
    ]);
    inputRef.current?.focus();
  }, [childName, mediatorMode, elderName]);

  // ── Exit practice mode ──
  const handleEndPractice = useCallback(() => {
    setPracticeMode(false);
    setPracticeHistory([]);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-end-${Date.now()}`,
        role: "livo",
        text: "Practice session ended. You can review your coaching scripts above or start a new practice round.",
      },
    ]);
  }, []);

  // ── Send message ──
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || practicing) return;

    const appliedScript =
      selectedIdx !== null ? scripts[selectedIdx] : undefined;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        tone: appliedScript?.tone,
      },
    ]);

    setInputValue("");
    setSelectedIdx(null);

    // ── Practice mode: call server action ──
    if (practiceMode && coachNodeId) {
      setPracticing(true);

      try {
        let result: PracticeResponse;

        if (mediatorMode && mediatorAlert) {
          // Elder practice: role-play as Grandma with Respect & Honor feedback
          result = await practiceWithGrandma(
            coachNodeId,
            mediatorAlert.elderId,
            text,
            elderPracticeHistory,
            elderPracticeIndex,
          );
          // Update elder practice history
          setElderPracticeHistory((prev) => [
            ...prev,
            { role: "parent", text },
            { role: "elder", text: result.childReply },
          ]);
          setElderPracticeIndex((prev) => prev + 1);
        } else {
          // Standard child practice
          result = await practiceWithLivo(
            coachNodeId,
            viewerRole,
            text,
            practiceHistory
          );
          // Update practice history
          setPracticeHistory((prev) => [
            ...prev,
            { role: "parent", text },
            { role: "child", text: result.childReply },
          ]);
        }

        // Add role-play reply (child or elder)
        setMessages((prev) => [
          ...prev,
          {
            id: `child-${Date.now()}`,
            role: "child",
            text: result.childReply,
          },
        ]);

        // Add TrendLife coaching feedback
        setMessages((prev) => [
          ...prev,
          {
            id: `fb-${Date.now()}`,
            role: "feedback",
            text: result.feedback,
            rating: result.rating,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "livo",
            text: `Failed to generate practice response: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ]);
      } finally {
        setPracticing(false);
      }
      return;
    }

    // ── ScholarFilter: Scaffolding mode for child homework ──
    // viewerRole is a string like "parent"/"child" — resolve viewer from nodes by role match
    const viewerForScholar = (mockData.nodes as FamilyNode[]).find(
      (n) => n.type === "member" && "role" in n && n.role === viewerRole,
    );
    const scholarResult = scholar_filter(text, viewerForScholar);
    if (scholarResult.active) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `l-${Date.now()}`,
            role: "livo",
            text: scholarResult.scaffoldResponse,
            tone: "Scaffolding",
          },
        ]);
      }, 600);
      return;
    }

    // ── Normal mode: simple acknowledgement ──
    setTimeout(() => {
      const mediatorFollowUp = mediatorMode && selectedIdx !== null ? mediatorScripts[selectedIdx]?.followUp : undefined;
      const trendlifeFollowUp = trendlifeMode && selectedIdx !== null ? trendlifeScripts[selectedIdx]?.followUp : undefined;
      const empathyFollowUp = empathyMode && selectedIdx !== null ? empathyScripts[selectedIdx]?.followUp : undefined;
      const followUp = mediatorFollowUp ?? trendlifeFollowUp ?? empathyFollowUp ?? appliedScript?.followUp;
      setMessages((prev) => [
        ...prev,
        {
          id: `l-${Date.now()}`,
          role: "livo",
          text: followUp
            ? `Great approach. You might follow up with: "${followUp}"`
            : "Message sent. TrendLife is here if you need more guidance.",
        },
      ]);
    }, 600);
  }, [inputValue, selectedIdx, scripts, empathyMode, empathyScripts, trendlifeMode, trendlifeScripts, mediatorMode, mediatorScripts, mediatorAlert, practiceMode, coachNodeId, viewerRole, practiceHistory, elderPracticeHistory, elderPracticeIndex, practicing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Don't render when no coach node and no empathy mode
  if (!coachNodeId && !empathyMode) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex w-[420px] animate-[slideUp_0.3s_ease-out] flex-col rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/50"
      style={{
        maxHeight: "min(640px, calc(100vh - 80px))",
        background: "rgba(15,15,22,0.8)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">TrendLife Companion</h3>
            <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[11px] font-medium text-indigo-400">
              Family Curator
            </span>
          </div>
          {mediatorMode && mediatorAlert ? (
            <p className="truncate text-xs text-zinc-500">
              Respect &amp; Honor &middot;{" "}
              <span className="text-amber-500">{mediatorAlert.elderLabel}</span>
              {" \u2192 "}
              <span className="text-zinc-400">{mediatorAlert.parentLabel}</span>
            </p>
          ) : trendlifeMode && highRiskAlert ? (
            <p className="truncate text-xs text-zinc-500">
              Trendlife Alert &middot;{" "}
              <span className="text-red-400">{highRiskAlert.childLabel}</span>
              {" \u2192 "}
              <span className="text-zinc-400">{highRiskAlert.parentLabel}</span>
            </p>
          ) : empathyMode && activeNegativeEvent ? (
            <p className="truncate text-xs text-zinc-500">
              Empathy Coach &middot;{" "}
              <span className="text-amber-400/80">{empathyMemberNames.join(", ")}</span>
            </p>
          ) : node && owner ? (
            <p className="truncate text-xs text-zinc-500">
              {practiceMode ? (
                <>
                  Practice &middot; role-playing as{" "}
                  <span className="text-purple-400">{childName}</span>
                </>
              ) : (
                <>
                  Coaching &middot;{" "}
                  <span className="text-zinc-400">{owner.label}</span>
                  {" \u2192 "}
                  <span className="text-red-400">{node.label}</span>
                </>
              )}
            </p>
          ) : null}
        </div>
        {mediatorMode && (
          <span className="flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-xs text-amber-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Mediator
          </span>
        )}
        {trendlifeMode && !mediatorMode && (
          <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Alert
          </span>
        )}
        {empathyMode && (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Empathy
          </span>
        )}
        {!empathyMode && practiceMode && (
          <span className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
            Practice
          </span>
        )}
        {!empathyMode && !practiceMode && isHighRisk && (
          <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            High Risk
          </span>
        )}
        <button
          onClick={() => {
            if (empathyMode && activeNegativeEvent) {
              setEmpathyDismissed((prev) => new Set(prev).add(activeNegativeEvent.id));
              setEmpathyEventId(null);
            }
            onClose();
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* ── Empathy Coach Mode: Empathy-First scripts ── */}
      {empathyMode && activeNegativeEvent && (
        <div className="shrink-0 border-b border-amber-500/15 bg-amber-500/[0.03]">
          {/* Empathy context — no technical details */}
          <div className="flex items-center gap-2 px-4 py-2">
            <svg
              className="h-3.5 w-3.5 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
              Empathy-First Coach
            </span>
          </div>

          {/* Event description — human-readable, no IDs or risk levels */}
          <div className="mx-4 mb-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2">
            <p className="text-[13px] leading-relaxed text-zinc-300">
              {activeNegativeEvent.description}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {empathyMemberNames.join(", ")} &middot; Intensity {activeNegativeEvent.intensity}/5
            </p>
          </div>

          {/* Empathy script accordion */}
          <div className="flex flex-col gap-1 px-4 pb-2">
            {empathyScripts.map((script, idx) => {
              const isSelected = selectedIdx === idx;
              return (
                <div key={idx}>
                  <button
                    onClick={() => setSelectedIdx(isSelected ? null : idx)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "border-amber-500/30 bg-amber-500/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                      {script.tone}
                    </span>
                    <span className="truncate text-[13px] text-zinc-400">&ldquo;{script.message.slice(0, 25)}...&rdquo;</span>
                    <svg className={`ml-auto h-3 w-3 shrink-0 text-zinc-600 transition-transform ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isSelected && (
                    <div className="mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-[13px] leading-relaxed text-zinc-300">&ldquo;{script.message}&rdquo;</p>
                      <p className="mt-1 text-xs italic text-zinc-600">Follow-up: {script.followUp}</p>
                      <button
                        onClick={() => { setInputValue(script.message); setSelectedIdx(idx); inputRef.current?.focus(); }}
                        className="mt-2 flex w-full items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/25"
                      >
                        Apply to Message
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Practice with empathy context */}
          <div className="px-4 pb-3">
            {practiceMode ? (
              <button
                onClick={handleEndPractice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-[13px] font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                End Practice Session
              </button>
            ) : (
              <button
                onClick={handleStartPractice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[13px] font-medium text-amber-400 transition-colors hover:bg-amber-500/15"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Practice with TrendLife
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px]">
                  TrendLife role-plays as {empathyChildName}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── TrendLife Mediator: Respect & Honor scripts for elder financial risks ── */}
      {!empathyMode && mediatorMode && (
        <div className="shrink-0 border-b border-amber-600/15 bg-amber-600/[0.03]">
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-2">
            <svg
              className="h-3.5 w-3.5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21"
              />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-500/80">
              Respect &amp; Honor
            </span>
            <span className="text-[11px] text-zinc-600">
              Elder financial concern
            </span>
          </div>

          {/* Alert context */}
          <div className="mx-4 mb-3 rounded-lg border border-amber-600/15 bg-amber-600/[0.04] px-3 py-2">
            <p className="text-[13px] leading-relaxed text-zinc-300">
              {mediatorAlert!.event.description}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {mediatorAlert!.elderLabel} &middot; Coaching for {mediatorAlert!.parentLabel} &middot; Intensity {mediatorAlert!.event.intensity}/5
            </p>
          </div>

          {/* Respect & Honor coaching script accordion */}
          <div className="flex flex-col gap-1 px-4 pb-2">
            {mediatorScripts.map((script, idx) => {
              const isScriptSelected = selectedIdx === idx;
              const toneClass =
                TONE_COLORS[script.tone] ??
                "border-zinc-500/30 bg-zinc-500/15 text-zinc-400";

              return (
                <div key={idx}>
                  <button
                    onClick={() => setSelectedIdx(isScriptSelected ? null : idx)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                      isScriptSelected
                        ? "border-amber-600/30 bg-amber-600/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
                      {script.tone}
                    </span>
                    <span className="truncate text-[13px] text-zinc-400">&ldquo;{script.message.slice(0, 20)}...&rdquo;</span>
                    <svg className={`ml-auto h-3 w-3 shrink-0 text-zinc-600 transition-transform ${isScriptSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isScriptSelected && (
                    <div className="mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-[13px] leading-relaxed text-zinc-300">&ldquo;{script.message}&rdquo;</p>
                      <p className="mt-1 text-xs italic text-zinc-600">Follow-up: {script.followUp}</p>
                      <p className="mt-1 text-[11px] leading-snug text-amber-500/50">{script.livoNote}</p>
                      <button
                        onClick={() => { setInputValue(script.message); setSelectedIdx(idx); inputRef.current?.focus(); }}
                        className="mt-2 flex w-full items-center justify-center rounded-lg border border-amber-600/30 bg-amber-600/15 px-2.5 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-600/25"
                      >
                        Apply to Message
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Practice button */}
          <div className="px-4 pb-3">
            {practiceMode ? (
              <button
                onClick={handleEndPractice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-[13px] font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                End Practice Session
              </button>
            ) : (
              <button
                onClick={handleStartPractice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-600/25 bg-amber-600/8 px-3 py-2 text-[13px] font-medium text-amber-500 transition-colors hover:bg-amber-600/15"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Practice with TrendLife
                <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-[11px]">
                  TrendLife role-plays as {mediatorAlert!.elderLabel}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Trendlife Alert: handle_high_risk_event coaching scripts ── */}
      {!empathyMode && !mediatorMode && trendlifeMode && (
        <div className="shrink-0 border-b border-red-500/15 bg-red-500/[0.03]">
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-2">
            <svg
              className="h-3.5 w-3.5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-red-400/80">
              Trendlife Alert
            </span>
            <span className="text-[11px] text-zinc-600">
              App install detected
            </span>
          </div>

          {/* Alert context */}
          <div className="mx-4 mb-3 rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2">
            <p className="text-[13px] leading-relaxed text-zinc-300">
              {highRiskAlert!.event.description}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {highRiskAlert!.childLabel} &rarr; {highRiskAlert!.parentLabel} &middot; Intensity {highRiskAlert!.event.intensity}/5
            </p>
          </div>

          {/* Trendlife coaching script accordion */}
          <div className="flex flex-col gap-1 px-4 pb-2">
            {trendlifeScripts.map((script, idx) => {
              const isScriptSelected = selectedIdx === idx;
              const toneClass =
                TONE_COLORS[script.tone] ??
                "border-zinc-500/30 bg-zinc-500/15 text-zinc-400";

              return (
                <div key={idx}>
                  <button
                    onClick={() => setSelectedIdx(isScriptSelected ? null : idx)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                      isScriptSelected
                        ? "border-red-500/30 bg-red-500/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
                      {script.tone}
                    </span>
                    <span className="truncate text-[13px] text-zinc-400">&ldquo;{script.message.slice(0, 25)}...&rdquo;</span>
                    <svg className={`ml-auto h-3 w-3 shrink-0 text-zinc-600 transition-transform ${isScriptSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isScriptSelected && (
                    <div className="mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-[13px] leading-relaxed text-zinc-300">&ldquo;{script.message}&rdquo;</p>
                      <p className="mt-1 text-xs italic text-zinc-600">Follow-up: {script.followUp}</p>
                      <p className="mt-1 text-[11px] leading-snug text-indigo-400/60">{script.livoNote}</p>
                      <button
                        onClick={() => { setInputValue(script.message); setSelectedIdx(idx); inputRef.current?.focus(); }}
                        className="mt-2 flex w-full items-center justify-center rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
                      >
                        Apply to Message
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Practice button */}
          <div className="px-4 pb-3">
            {practiceMode ? (
              <button
                onClick={handleEndPractice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-[13px] font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                End Practice Session
              </button>
            ) : (
              <button
                onClick={handleStartPractice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/15"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Practice with TrendLife
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px]">
                  TrendLife role-plays as {childName}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Coach View: TrendLife's Coaching section ── */}
      {!empathyMode && !trendlifeMode && !mediatorMode && isHighRisk && (
        <div className="shrink-0 border-b border-indigo-500/15 bg-indigo-500/[0.03]">
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-2">
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
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400/80">
              TrendLife Coaching
            </span>
            <span className="text-[11px] text-zinc-600">
              {loading
                ? "generating..."
                : scripts.length > 0
                  ? `${scripts.length} scripts`
                  : ""}
            </span>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-52 shrink-0 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02] p-3"
                >
                  <div className="mb-2 h-4 w-14 rounded-full bg-white/[0.06]" />
                  <div className="mb-1 h-3 w-full rounded bg-white/[0.04]" />
                  <div className="mb-1 h-3 w-4/5 rounded bg-white/[0.04]" />
                  <div className="h-3 w-3/5 rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 pb-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-center">
                <p className="mb-1.5 text-xs text-red-400">{error}</p>
                <button
                  onClick={() => coachNodeId && fetchScripts(coachNodeId)}
                  className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/20"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Script cards — accordion */}
          {!loading && !error && scripts.length > 0 && (
            <div className="flex flex-col gap-1 px-4 pb-2">
              {scripts.map((script, idx) => {
                const isSelected = selectedIdx === idx;
                const toneClass =
                  TONE_COLORS[script.tone] ??
                  "border-zinc-500/30 bg-zinc-500/15 text-zinc-400";

                return (
                  <div key={idx}>
                    <button
                      onClick={() => setSelectedIdx(isSelected ? null : idx)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                        isSelected
                          ? "border-indigo-500/30 bg-indigo-500/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
                        {script.tone}
                      </span>
                      <span className="truncate text-[13px] text-zinc-400">&ldquo;{script.message.slice(0, 25)}...&rdquo;</span>
                      <svg className={`ml-auto h-3 w-3 shrink-0 text-zinc-600 transition-transform ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isSelected && (
                      <div className="mt-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <p className="text-[13px] leading-relaxed text-zinc-300">&ldquo;{script.message}&rdquo;</p>
                        <p className="mt-1 text-xs italic text-zinc-600">Follow-up: {script.followUp}</p>
                        <button
                          onClick={() => handleApply(idx)}
                          className="mt-2 flex w-full items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/25"
                        >
                          Apply to Message
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Practice with TrendLife button */}
          {!loading && !error && scripts.length > 0 && (
            <div className="px-4 pb-3">
              {practiceMode ? (
                <button
                  onClick={handleEndPractice}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-[13px] font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                    />
                  </svg>
                  End Practice Session
                </button>
              ) : (
                <button
                  onClick={handleStartPractice}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/8 px-3 py-2 text-[13px] font-medium text-purple-400 transition-colors hover:bg-purple-500/15"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  Practice with TrendLife
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[11px]">
                    TrendLife role-plays as {childName}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Chat messages area ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && mediatorMode && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-600/[0.04] px-3 py-2.5">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21"
              />
            </svg>
            <p className="text-[13px] leading-relaxed text-zinc-400">
              TrendLife Companion detected a{" "}
              <span className="font-medium text-amber-500">
                financial concern
              </span>{" "}
              involving {mediatorAlert?.elderLabel}. This is{" "}
              <span className="font-medium text-amber-400">
                not a standard alert
              </span>
              . Choose a{" "}
              <span className="font-medium text-amber-500">
                Respect &amp; Honor script
              </span>{" "}
              to approach with deference — treat{" "}
              {mediatorAlert?.elderLabel} as the expert, not the problem.
            </p>
          </div>
        )}

        {messages.length === 0 && trendlifeMode && !mediatorMode && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-500/[0.04] px-3 py-2.5">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-[13px] leading-relaxed text-zinc-400">
              TrendLife Companion detected a{" "}
              <span className="font-medium text-red-400">
                new app install
              </span>{" "}
              from {highRiskAlert?.childLabel}. Choose a{" "}
              <span className="font-medium text-indigo-400">
                Trendlife coaching script
              </span>{" "}
              above to start a conversation, or{" "}
              <span className="font-medium text-purple-400">
                practice with TrendLife
              </span>{" "}
              first. Each script includes Curator guidance notes.
            </p>
          </div>
        )}

        {messages.length === 0 && !isHighRisk && !empathyMode && !trendlifeMode && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-600">
              No active coaching session.
            </p>
          </div>
        )}

        {messages.length === 0 && empathyMode && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/[0.04] px-3 py-2.5">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <p className="text-[13px] leading-relaxed text-zinc-400">
              TrendLife Companion detected a moment that needs care. Choose an{" "}
              <span className="font-medium text-amber-400">
                empathy-first script
              </span>{" "}
              above to start a conversation — or{" "}
              <span className="font-medium text-purple-400">
                practice with TrendLife
              </span>{" "}
              first.
            </p>
          </div>
        )}

        {messages.length === 0 && !empathyMode && isHighRisk && !loading && scripts.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg bg-indigo-500/[0.04] px-3 py-2.5">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
            <p className="text-[13px] leading-relaxed text-zinc-400">
              Select a coaching script above, then press{" "}
              <span className="font-medium text-indigo-400">
                Apply to Message
              </span>{" "}
              to populate the input — or click{" "}
              <span className="font-medium text-purple-400">
                Practice with TrendLife
              </span>{" "}
              to rehearse your message first.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            // ── Child / Elder role-play bubble ──
            if (msg.role === "child") {
              const rpName = mediatorMode ? elderName : childName;
              const isElder = mediatorMode;
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className={`max-w-[85%] rounded-xl rounded-bl-sm border px-3 py-2 text-zinc-300 ${
                    isElder
                      ? "border-amber-500/20 bg-amber-500/[0.06]"
                      : "border-purple-500/20 bg-purple-500/[0.06]"
                  }`}>
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
                        isElder
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}>
                        {rpName.charAt(0)}
                      </span>
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                        isElder ? "text-amber-400/70" : "text-purple-400/70"
                      }`}>
                        {rpName} (role-play)
                      </span>
                    </div>
                    <p className="text-smleading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            }

            // ── Coaching feedback bubble ──
            if (msg.role === "feedback") {
              const ratingStyle = msg.rating
                ? RATING_STYLES[msg.rating]
                : null;
              return (
                <div key={msg.id} className="flex justify-start">
                  <div
                    className={`max-w-[85%] rounded-xl rounded-bl-sm border px-3 py-2 ${
                      ratingStyle
                        ? `${ratingStyle.border} ${ratingStyle.bg}`
                        : "border-white/[0.06] bg-white/[0.03]"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400/60">
                        TrendLife Feedback
                      </span>
                      {ratingStyle && (
                        <span
                          className={`flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-medium ${ratingStyle.border} ${ratingStyle.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${ratingStyle.dot}`}
                          />
                          {ratingStyle.label}
                        </span>
                      )}
                    </div>
                    <p className="text-smleading-relaxed text-zinc-300">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            }

            // ── User + Livo bubbles ──
            return (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.role === "user"
                      ? "rounded-br-sm border border-indigo-500/20 bg-indigo-500/10 text-zinc-200"
                      : "rounded-bl-sm border border-white/[0.06] bg-white/[0.03] text-zinc-300"
                  }`}
                >
                  {msg.role === "livo" && (
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-indigo-400/60">
                      TrendLife
                    </span>
                  )}
                  {msg.tone && (
                    <span
                      className={`mb-1 mr-1 inline-block rounded-full border px-1.5 py-px text-[11px] font-medium ${
                        TONE_COLORS[msg.tone] ??
                        "border-zinc-500/30 bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {msg.tone}
                    </span>
                  )}
                  <p className="text-smleading-relaxed">{msg.text}</p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator during practice */}
          {practicing && (() => {
            const rpName = mediatorMode ? elderName : childName;
            const isElder = mediatorMode;
            return (
              <div className="flex justify-start">
                <div className={`rounded-xl rounded-bl-sm border px-3 py-2 ${
                  isElder
                    ? "border-amber-500/20 bg-amber-500/[0.06]"
                    : "border-purple-500/20 bg-purple-500/[0.06]"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${
                      isElder
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {rpName.charAt(0)}
                    </span>
                    <span className={`text-[11px] ${isElder ? "text-amber-400/60" : "text-purple-400/60"}`}>
                      {rpName} is typing
                    </span>
                    <span className="flex gap-0.5">
                      <span className={`h-1 w-1 animate-bounce rounded-full ${isElder ? "bg-amber-400/50" : "bg-purple-400/50"}`} style={{ animationDelay: "0ms" }} />
                      <span className={`h-1 w-1 animate-bounce rounded-full ${isElder ? "bg-amber-400/50" : "bg-purple-400/50"}`} style={{ animationDelay: "150ms" }} />
                      <span className={`h-1 w-1 animate-bounce rounded-full ${isElder ? "bg-amber-400/50" : "bg-purple-400/50"}`} style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (
                  selectedIdx !== null &&
                  e.target.value !== scripts[selectedIdx]?.message
                ) {
                  setSelectedIdx(null);
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={practicing}
              placeholder={
                practicing
                  ? `Waiting for ${mediatorMode ? elderName : empathyMode ? empathyChildName : childName}'s reply...`
                  : practiceMode
                    ? `Say something to ${mediatorMode ? elderName : empathyMode ? empathyChildName : childName}...`
                    : mediatorMode
                      ? "Type or apply a Respect & Honor script..."
                      : trendlifeMode
                        ? "Type or apply a Trendlife coaching script..."
                        : empathyMode
                        ? "Type or apply an empathy script..."
                        : isHighRisk
                          ? "Type or apply a coaching script..."
                          : "Type a message..."
              }
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-2 pl-8 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/50 focus:bg-zinc-800/80 disabled:opacity-50"
            />
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
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076c1.14 0 2.274-.078 3.398-.23 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || practicing}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400 transition-colors hover:bg-indigo-500/25 disabled:opacity-30 disabled:hover:bg-indigo-500/15"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
        {selectedIdx !== null && !practiceMode && (
          <p className="mt-1 text-xs text-indigo-400/60">
            <span className="font-medium">{scripts[selectedIdx]?.tone}</span>{" "}
            script applied &middot;{" "}
            <button
              onClick={() => {
                setSelectedIdx(null);
                setInputValue("");
              }}
              className="underline hover:text-indigo-400"
            >
              clear
            </button>
          </p>
        )}
        {practiceMode && !practicing && (
          <p className={`mt-1 text-xs ${mediatorMode ? "text-amber-400/60" : "text-purple-400/60"}`}>
            Practice mode &middot; TrendLife is role-playing as{" "}
            <span className="font-medium">{mediatorMode ? elderName : childName}</span>
            {mediatorMode && (
              <span className="ml-1 text-amber-500/50">&middot; Respect &amp; Honor</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
