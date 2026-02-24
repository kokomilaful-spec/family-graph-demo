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

  // High-risk event detection: auto-trigger coaching for Dad
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

  // Auto-trigger chat for Dad when handle_high_risk_event detects an app install
  useEffect(() => {
    if (!highRiskAlert) return;
    // Switch viewer to the notified parent (Dad)
    if (settings.viewerId !== highRiskAlert.parentId) {
      setSettings((prev) => ({ ...prev, viewerId: highRiskAlert.parentId }));
    }
    // Open coach mode targeting the suspicious node
    if (highRiskAlert.targetNodeId) {
      setCoachNodeId(highRiskAlert.targetNodeId);
      setSelectedNodeId(highRiskAlert.targetNodeId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Auto-trigger mediator chat for Dad when livo_mediator detects elder financial risk.
  // If highRiskAlert took priority on mount, surface mediator when coach chat is closed.
  useEffect(() => {
    if (!mediatorAlert) return;
    if (!highRiskAlert) {
      // No competing alert — open immediately on mount
      if (settings.viewerId !== mediatorAlert.parentId) {
        setSettings((prev) => ({ ...prev, viewerId: mediatorAlert.parentId }));
      }
      if (mediatorAlert.targetNodeId) {
        setCoachNodeId(mediatorAlert.targetNodeId);
        setSelectedNodeId(mediatorAlert.targetNodeId);
        setMediatorShown(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // When the coach chat is closed and mediatorAlert exists, surface it (once)
  useEffect(() => {
    if (!mediatorAlert || !highRiskAlert || mediatorShown) return;
    // coachNodeId was cleared → user closed the highRisk coach chat
    if (coachNodeId === null && mediatorAlert.targetNodeId) {
      setCoachNodeId(mediatorAlert.targetNodeId);
      setSelectedNodeId(mediatorAlert.targetNodeId);
      setMediatorShown(true);
    }
  }, [coachNodeId, mediatorAlert, highRiskAlert, mediatorShown]);

  // Open ChatCoach when a high-risk node is selected by a parent viewer
  useEffect(() => {
    if (!selectedNodeId) return;
    const node = mockData.nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.riskLevel !== "high") return;

    // Only show for parent viewers
    const viewer = mockData.nodes.find((n) => n.id === settings.viewerId);
    if (!viewer || !("role" in viewer) || viewer.role !== "parent") return;

    setCoachNodeId(selectedNodeId);
  }, [selectedNodeId, settings.viewerId]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a10]">
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
          <div className="flex shrink-0 border-b border-white/[0.06]">
            <button
              onClick={() => setShowReceipt(false)}
              className={`flex-1 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                !showReceipt
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Insights
            </button>
            <button
              onClick={() => setShowReceipt(true)}
              className={`flex-1 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                showReceipt
                  ? "border-b-2 border-emerald-500 text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              Trust Receipt
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
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
    </div>
  );
}
