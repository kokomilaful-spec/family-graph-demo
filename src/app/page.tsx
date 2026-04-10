"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import FamilyGraph from "@/components/FamilyGraph";
import GraphSettings, {
  DEFAULT_SETTINGS,
  type GraphSettingsState,
} from "@/components/GraphSettings";
import NodeDetail from "@/components/NodeDetail";
import FamilyInsights from "@/components/FamilyInsights";
import CommandBar from "@/components/CommandBar";
import StatusBar from "@/components/StatusBar";
import FamilyChat from "@/components/FamilyChat";
import RuleEditor from "@/components/RuleEditor";
import PreferenceSidebar from "@/components/PreferenceSidebar";
import type { Command } from "@/types/command";
import type { HouseRuleNode, Edge, FamilyNode, FamilyGraph as FamilyGraphData, SynapseEvent } from "@/types/family";
import { useCelebration } from "@/components/CelebrationEffect";
import WeeklyTrustReceipt from "@/components/WeeklyTrustReceipt";
import { handle_high_risk_event } from "@/lib/livo/high-risk-handler";
import { livo_mediator } from "@/lib/livo/mediator";
import OnboardingTour from "@/components/OnboardingTour";
import mockData from "@/data/family-mock.json";

export default function Home() {
  const [settings, setSettings] = useState<GraphSettingsState>(DEFAULT_SETTINGS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<Command | null>(null);
  const [coachNodeId, setCoachNodeId] = useState<string | null>(null);
  const [dynamicRules, setDynamicRules] = useState<{ node: HouseRuleNode; edges: Edge[] }[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [mediatorShown, setMediatorShown] = useState(false);

  // Celebration effect: confetti particles + Livo reward cards
  const synapseEvents = ((mockData as FamilyGraphData).synapseEvents ?? []) as SynapseEvent[];
  const { celebratingMembers, activeRewards, triggerCelebration, dismissReward } = useCelebration(synapseEvents);

  // High-risk event detection: detect suspicious app installs on children's devices
  const highRiskAlert = useMemo(
    () =>
      handle_high_risk_event(
        synapseEvents,
        mockData.nodes as FamilyNode[],
        mockData.edges as Edge[],
      ),
    [synapseEvents],
  );

  // LivoMediator: detect elder financial risks (Respect & Honor, not standard alert)
  const mediatorAlert = useMemo(
    () =>
      livo_mediator(
        synapseEvents,
        mockData.nodes as FamilyNode[],
        mockData.edges as Edge[],
      ),
    [synapseEvents],
  );

  // Import animation state: imported data + how many nodes revealed so far
  const [importData, setImportData] = useState<FamilyGraphData | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const staggerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAddRule = useCallback((node: HouseRuleNode, edges: Edge[]) => {
    setDynamicRules((prev) => [...prev, { node, edges }]);
  }, []);

  const handleRemoveRule = useCallback((nodeId: string) => {
    setDynamicRules((prev) => prev.filter((r) => r.node.id !== nodeId));
  }, []);

  // ── Export: download all current nodes + edges as JSON ──
  const handleExport = useCallback(() => {
    const base = mockData as FamilyGraphData;
    const allNodes: FamilyNode[] = [
      ...(base.nodes as FamilyNode[]),
      ...dynamicRules.map((r) => r.node),
    ];
    const allEdges: Edge[] = [
      ...base.edges,
      ...dynamicRules.flatMap((r) => r.edges),
    ];
    const payload = { nodes: allNodes, edges: allEdges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `family-soul-${new Date().toISOString().slice(0, 10)}.family`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dynamicRules]);

  // ── Import: read JSON, clear state, stagger nodes in ──
  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as FamilyGraphData;
        if (!parsed.nodes || !parsed.edges) return;

        // Clear dynamic rules
        setDynamicRules([]);
        setSelectedNodeId(null);
        setCoachNodeId(null);

        // Start staggered reveal
        setImportData(parsed);
        setRevealCount(0);

        // Clear any existing timer
        if (staggerTimerRef.current) clearInterval(staggerTimerRef.current);

        let count = 0;
        const total = parsed.nodes.length;
        staggerTimerRef.current = setInterval(() => {
          count++;
          setRevealCount(count);
          if (count >= total) {
            if (staggerTimerRef.current) clearInterval(staggerTimerRef.current);
            staggerTimerRef.current = null;
          }
        }, 80);
      } catch {
        // Invalid JSON — ignore
      }
    };
    reader.readAsText(file);
  }, []);

  // Clean up stagger timer on unmount
  useEffect(() => {
    return () => {
      if (staggerTimerRef.current) clearInterval(staggerTimerRef.current);
    };
  }, []);

  // Derive overrideData: slice imported nodes to revealCount, filter edges accordingly
  const overrideData = importData
    ? (() => {
        const visibleNodes = importData.nodes.slice(0, revealCount) as FamilyNode[];
        const visibleIds = new Set(visibleNodes.map((n) => n.id));
        const visibleEdges = importData.edges.filter(
          (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
        );
        return { nodes: visibleNodes, edges: visibleEdges };
      })()
    : null;

  // Collect all house_rule nodes (static mock + dynamic)
  const allRuleNodes = [
    ...(mockData.nodes.filter((n) => n.type === "house_rule") as HouseRuleNode[]),
    ...dynamicRules.map((r) => r.node),
  ];
  const extraNodes = dynamicRules.map((r) => r.node);
  const extraEdges = dynamicRules.flatMap((r) => r.edges);

  // Derive selected member ID for PreferenceSidebar
  const selectedMemberId = selectedNodeId?.startsWith("m-") ? selectedNodeId : null;

  // Derive viewer role for LivoCoach
  const viewerRole = (() => {
    const viewer = mockData.nodes.find((n) => n.id === settings.viewerId);
    return viewer && "role" in viewer ? (viewer.role as "parent" | "child" | "grandparent" | "sibling" | "other") : "parent";
  })();

  // Compute which members have relevant preferences for focus mode connectors
  const focusMemberIds = useMemo(() => {
    if (!activeCommand?.relevant_context?.length) return null;

    const hasDiet = activeCommand.relevant_context.includes("dietary_preferences");
    const hasActivity = activeCommand.relevant_context.includes("activities");
    const hasDevices = activeCommand.relevant_context.includes("devices");

    if (!hasDiet && !hasActivity && !hasDevices) return null;

    const members = (mockData.nodes as FamilyNode[]).filter((n) => n.type === "member");
    const result: string[] = [];

    for (const member of members) {
      const connectedIds = new Set<string>();
      for (const edge of mockData.edges) {
        if (edge.source === member.id) connectedIds.add(edge.target);
        if (edge.target === member.id) connectedIds.add(edge.source);
      }

      const hasMatch = (mockData.nodes as FamilyNode[]).some((n) => {
        if (!connectedIds.has(n.id)) return false;
        if (hasDiet && n.type === "preference" && "category" in n && n.category === "food") return true;
        if (hasActivity && n.type === "preference" && "category" in n && n.category === "activity") return true;
        if (hasDevices && n.type === "device") return true;
        return false;
      });

      if (hasMatch) result.push(member.id);
    }

    return result.length > 0 ? result : null;
  }, [activeCommand]);

  // Auto-trigger mediator chat on mount (Grandma scam → coaching for Son).
  // Mediator takes priority since the default viewer is Son.
  useEffect(() => {
    if (!mediatorAlert) return;
    if (mediatorAlert.targetNodeId) {
      setCoachNodeId(mediatorAlert.targetNodeId);
      setSelectedNodeId(mediatorAlert.targetNodeId);
      setMediatorShown(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // When the mediator chat is closed, surface the highRiskAlert if it exists (once)
  useEffect(() => {
    if (!highRiskAlert || !mediatorAlert || !mediatorShown) return;
    // coachNodeId was cleared → user closed the mediator coach chat
    if (coachNodeId === null && highRiskAlert.targetNodeId) {
      setCoachNodeId(highRiskAlert.targetNodeId);
      setSelectedNodeId(highRiskAlert.targetNodeId);
    }
  }, [coachNodeId, highRiskAlert, mediatorAlert, mediatorShown]);

  // Open ChatCoach when a high-risk node is selected
  useEffect(() => {
    if (!selectedNodeId) return;
    const node = mockData.nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.riskLevel !== "high") return;

    setCoachNodeId(selectedNodeId);
  }, [selectedNodeId, settings.viewerId]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1a3040]">
      {/* Main area: left sidebar + graph + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Graph Settings (glassmorphism panel) */}
        <aside className="glass-panel flex w-60 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06]">
          <GraphSettings settings={settings} onChange={setSettings} onExport={handleExport} onImport={handleImport} />
          <RuleEditor
            rules={allRuleNodes}
            onAddRule={handleAddRule}
            onRemoveRule={handleRemoveRule}
          />
        </aside>

        {/* Center — Graph */}
        <main className="relative flex-1">
          <FamilyGraph
            settings={settings}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            activeCommand={activeCommand}
            focusMemberIds={focusMemberIds}
            extraNodes={extraNodes}
            extraEdges={extraEdges}
            overrideData={overrideData}
            celebratingMemberIds={celebratingMembers}
          />
          <PreferenceSidebar
            memberId={selectedMemberId}
            activeCommand={activeCommand}
            onClose={() => { setSelectedNodeId(null); setActiveCommand(null); }}
          />
        </main>

        {/* Right — Node Detail + Family Insights */}
        <aside className="glass-panel flex w-72 shrink-0 flex-col border-l border-white/[0.06]">
          {/* Node Detail (collapses when nothing selected) */}
          <div
            className={`shrink-0 overflow-hidden border-b border-white/[0.06] transition-all duration-200 ${
              selectedNodeId ? "max-h-[35%]" : "max-h-0 border-b-0"
            }`}
          >
            <div className="overflow-y-auto" style={{ maxHeight: "100%" }}>
              <NodeDetail
                nodeId={selectedNodeId}
                viewerId={settings.viewerId}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          </div>

          {/* Toggle: Family Insights / Weekly Trust Receipt */}
          <div
            role="tablist"
            aria-label="Right panel tabs"
            className="flex shrink-0 border-b border-white/[0.06]"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                setShowReceipt((prev) => !prev);
                // Move focus to the other tab
                const target = e.currentTarget.querySelector<HTMLButtonElement>(
                  `[aria-selected="${e.key === "ArrowRight" ? !showReceipt : showReceipt ? "true" : "false"}"]`
                );
                // Simpler: just toggle and focus sibling
                const sibling = (e.target as HTMLElement).nextElementSibling ?? (e.target as HTMLElement).previousElementSibling;
                (sibling as HTMLElement)?.focus();
              }
            }}
          >
            <button
              role="tab"
              aria-selected={!showReceipt}
              aria-controls="panel-insights"
              id="tab-insights"
              tabIndex={!showReceipt ? 0 : -1}
              onClick={() => setShowReceipt(false)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                !showReceipt
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Insights
            </button>
            <button
              role="tab"
              aria-selected={showReceipt}
              aria-controls="panel-receipt"
              id="tab-receipt"
              tabIndex={showReceipt ? 0 : -1}
              onClick={() => setShowReceipt(true)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                showReceipt
                  ? "border-b-2 border-emerald-500 text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Trust Receipt
            </button>
          </div>

          <div
            role="tabpanel"
            id={showReceipt ? "panel-receipt" : "panel-insights"}
            aria-labelledby={showReceipt ? "tab-receipt" : "tab-insights"}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {showReceipt ? (
              <WeeklyTrustReceipt
                highRiskAlert={highRiskAlert}
                mediatorAlert={mediatorAlert}
                onClose={() => setShowReceipt(false)}
              />
            ) : (
              <FamilyInsights
                viewerId={settings.viewerId}
                activeCommand={activeCommand}
                onClearCommand={() => setActiveCommand(null)}
                rewardCards={activeRewards}
                onTriggerCelebration={triggerCelebration}
                onDismissReward={dismissReward}
                onSelectNode={setSelectedNodeId}
                mediatorAlert={mediatorAlert}
              />
            )}
          </div>

          {/* Command Bar (bottom of right panel) */}
          <CommandBar onCommand={setActiveCommand} />
        </aside>
      </div>

      {/* Bottom — Status Bar */}
      <StatusBar
        selectedNodeId={selectedNodeId}
        viewerId={settings.viewerId}
        onDeselect={() => setSelectedNodeId(null)}
      />

      {/* Family Chat with Coach View (bottom-right, parent viewers only) */}
      <FamilyChat
        coachNodeId={coachNodeId}
        viewerRole={viewerRole}
        onClose={() => setCoachNodeId(null)}
        negativeEvents={synapseEvents.filter((e) => e.impact === "Negative")}
        highRiskAlert={highRiskAlert}
        mediatorAlert={mediatorAlert}
      />

      {/* First-run onboarding tooltip tour */}
      <OnboardingTour />
    </div>
  );
}
