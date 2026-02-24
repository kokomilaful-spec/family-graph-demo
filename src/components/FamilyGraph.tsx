"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { FamilyGraph as FamilyGraphData, FamilyNode, Edge, NodeType, PreferenceNode } from "@/types/family";
import type { Command } from "@/types/command";
import type { GraphSettingsState } from "@/components/GraphSettings";
import { applyVisibilityGate } from "@/lib/visibility-gate";
import mockData from "@/data/family-mock.json";

const NODE_COLORS: Record<NodeType, string> = {
  member: "#3b82f6",
  preference: "#f59e0b",
  device: "#8b5cf6",
  document: "#10b981",
  health: "#ef4444",
  house_rule: "#eab308",
};

const DIMMED_NODE = "#2a2a30";
const DIMMED_LINK = "#1e1e24";
const ACTIVE_LINK = "#4a9eff";
const DEFAULT_LINK = "#333340";
const GLOW_COLOR = "#22c55e";
const RISK_HIGH_COLOR = "#ef4444";
const RISK_MEDIUM_COLOR = "#f59e0b";
const ACHIEVEMENT_COLOR = "#eab308";

const NODE_RADIUS: Record<NodeType, number> = {
  member: 8,
  preference: 6,
  device: 5,
  document: 5,
  health: 5,
  house_rule: 6,
};

// ─── Z-depth layer system ────────────────────────────────────
// Bottom (0): shared family documents — grounded "base" layer
// Middle (1): members, preferences, devices — core relational layer
// Top (2): personal/private nodes, achievements — floating "memory" layer

const DEPTH_SCALE = [0.75, 1.0, 1.2];
const LAYER_NAMES = ["Base Layer", "Core Layer", "Memory Layer"];

// ─── Shape path helpers ──────────────────────────────────────
// Each draws a closed path centered at (x, y) fitting inside radius r.
// member = circle, preference = diamond, device = rounded square,
// document = hexagon, house_rule = pentagon

function shapePath(
  ctx: CanvasRenderingContext2D,
  type: NodeType,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  switch (type) {
    case "preference": {
      // Diamond (rotated square)
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    }
    case "device": {
      // Rounded square
      const half = r * 0.82;
      const rr = r * 0.25;
      ctx.moveTo(x - half + rr, y - half);
      ctx.lineTo(x + half - rr, y - half);
      ctx.quadraticCurveTo(x + half, y - half, x + half, y - half + rr);
      ctx.lineTo(x + half, y + half - rr);
      ctx.quadraticCurveTo(x + half, y + half, x + half - rr, y + half);
      ctx.lineTo(x - half + rr, y + half);
      ctx.quadraticCurveTo(x - half, y + half, x - half, y + half - rr);
      ctx.lineTo(x - half, y - half + rr);
      ctx.quadraticCurveTo(x - half, y - half, x - half + rr, y - half);
      ctx.closePath();
      break;
    }
    case "document": {
      // Hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "health": {
      // Cross / plus shape
      const arm = r * 0.35;
      ctx.moveTo(x - arm, y - r);
      ctx.lineTo(x + arm, y - r);
      ctx.lineTo(x + arm, y - arm);
      ctx.lineTo(x + r, y - arm);
      ctx.lineTo(x + r, y + arm);
      ctx.lineTo(x + arm, y + arm);
      ctx.lineTo(x + arm, y + r);
      ctx.lineTo(x - arm, y + r);
      ctx.lineTo(x - arm, y + arm);
      ctx.lineTo(x - r, y + arm);
      ctx.lineTo(x - r, y - arm);
      ctx.lineTo(x - arm, y - arm);
      ctx.closePath();
      break;
    }
    case "house_rule": {
      // Pentagon
      for (let i = 0; i < 5; i++) {
        const angle = ((2 * Math.PI) / 5) * i - Math.PI / 2;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default: {
      // member → circle
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      break;
    }
  }
}

function getDepthLayer(node: {
  type: NodeType;
  visibility?: string;
  isAchievement?: boolean;
}): 0 | 1 | 2 {
  if (node.isAchievement) return 2;
  if (node.visibility === "private" || node.visibility === "guarded") return 2;
  if (node.type === "document" && (node.visibility === "family" || !node.visibility))
    return 0;
  return 1;
}

// ─── Health Status types ────────────────────────────────────

interface HealthStatus {
  hasRisk: boolean;
  hasAchievement: boolean;
  riskCount: number;
  achievementCount: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  riskLevel?: string;
  visibility?: string;
  isAchievement?: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: unknown;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  label?: string;
  weight?: number;
}

interface FamilyGraphProps {
  settings: GraphSettingsState;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  activeCommand?: Command | null;
  focusMemberIds?: string[] | null;
  extraNodes?: FamilyNode[];
  extraEdges?: Edge[];
  overrideData?: FamilyGraphData | null;
  celebratingMemberIds?: Set<string>;
}

export default function FamilyGraph({
  settings,
  selectedNodeId,
  onNodeSelect,
  activeCommand,
  focusMemberIds,
  extraNodes,
  extraEdges,
  overrideData,
  celebratingMemberIds,
}: FamilyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ForceGraph, setForceGraph] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [tick, setTick] = useState(0);
  const prevFocusRef = useRef<string | null>(null);
  const bloomRef = useRef(0); // 0..1 spring bloom progress

  // Animation tick for pulsing glows + spring bloom
  useEffect(() => {
    let raf: number;
    const animate = () => {
      setTick(Date.now());
      // Decay bloom toward 0 (spring settling)
      if (bloomRef.current > 0.001) {
        bloomRef.current *= 0.92; // exponential decay
      } else {
        bloomRef.current = 0;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Apply force settings
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;

    const chargeStrength = -(settings.nodeSpacing * 3 + 30);
    fg.d3Force("charge")?.strength(chargeStrength);

    const dist = settings.linkLength * 1.5 + 20;
    fg.d3Force("link")?.distance(dist);

    const linkStrength = settings.linkForce / 100;
    fg.d3Force("link")?.strength(linkStrength);

    const centerStrength = settings.centerForce / 100;
    fg.d3Force("center")?.strength(centerStrength);

    fg.d3ReheatSimulation();
  }, [settings.nodeSpacing, settings.linkLength, settings.linkForce, settings.centerForce]);

  const fullData = useMemo<FamilyGraphData>(() => {
    // When overrideData is active (import animation), use it directly
    if (overrideData) return overrideData;

    const base = mockData as FamilyGraphData;
    if (!extraNodes?.length && !extraEdges?.length) return base;
    return {
      nodes: [...base.nodes, ...(extraNodes ?? [])] as FamilyNode[],
      edges: [...base.edges, ...(extraEdges ?? [])],
    };
  }, [extraNodes, extraEdges, overrideData]);

  // Apply visibility gate based on current viewer
  const rawData = useMemo(
    () => applyVisibilityGate(fullData, settings.viewerId),
    [fullData, settings.viewerId],
  );

  // Count connections per node for leaf-node filtering
  const connectionCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of rawData.edges) {
      counts[e.source] = (counts[e.source] || 0) + 1;
      counts[e.target] = (counts[e.target] || 0) + 1;
    }
    return counts;
  }, [rawData.edges]);

  // The active focus member (from settings dropdown)
  const focusMemberId = settings.selectedId;

  // Determine if a member node is currently "focused" via click
  const focusedMember = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = rawData.nodes.find((n) => n.id === selectedNodeId);
    return node?.type === "member" ? selectedNodeId : null;
  }, [selectedNodeId, rawData.nodes]);

  // The effective focus: either clicked member or dropdown selection
  const effectiveFocus = focusedMember ?? focusMemberId;

  // ── Spring bloom animation on focus change ──
  useEffect(() => {
    if (effectiveFocus !== prevFocusRef.current) {
      prevFocusRef.current = effectiveFocus;
      if (effectiveFocus && fgRef.current) {
        // Trigger bloom: set to 1, will decay via rAF
        bloomRef.current = 1;

        const fg = fgRef.current;

        // Temporarily increase charge for a "spring outward" push
        const baseCharge = -(settings.nodeSpacing * 3 + 30);
        fg.d3Force("charge")?.strength(baseCharge * 2.5);

        // Temporarily increase link distance
        const baseDist = settings.linkLength * 1.5 + 20;
        fg.d3Force("link")?.distance(baseDist * 1.8);

        // Reheat the simulation to trigger movement
        fg.d3ReheatSimulation();

        // Spring back to normal forces after the bloom settles
        const timer = setTimeout(() => {
          if (!fgRef.current) return;
          fg.d3Force("charge")?.strength(baseCharge);
          fg.d3Force("link")?.distance(baseDist);
          fg.d3ReheatSimulation();
        }, 600);

        return () => clearTimeout(timer);
      }
    }
  }, [effectiveFocus, settings.nodeSpacing, settings.linkLength]);

  // Build highlighted sets from effective focus
  const highlightedIds = useMemo(() => {
    if (!effectiveFocus) return null;
    const ids = new Set<string>();
    ids.add(effectiveFocus);
    for (const edge of rawData.edges) {
      if (edge.source === effectiveFocus) ids.add(edge.target);
      else if (edge.target === effectiveFocus) ids.add(edge.source);
    }
    return ids;
  }, [effectiveFocus, rawData.edges]);

  const highlightedEdges = useMemo(() => {
    if (!effectiveFocus) return null;
    const keys = new Set<string>();
    for (const edge of rawData.edges) {
      if (edge.source === effectiveFocus || edge.target === effectiveFocus) {
        keys.add(`${edge.source}__${edge.target}`);
      }
    }
    return keys;
  }, [effectiveFocus, rawData.edges]);

  // ── Health Status per member ──
  // Summarizes the risk/achievement profile of each member's connected nodes
  const memberHealth = useMemo(() => {
    const health: Record<string, HealthStatus> = {};
    const memberNodes = rawData.nodes.filter((n) => n.type === "member");

    for (const member of memberNodes) {
      let riskCount = 0;
      let achievementCount = 0;

      // Walk edges to find connected non-member nodes
      for (const edge of rawData.edges) {
        let connectedId: string | null = null;
        if (edge.source === member.id) connectedId = edge.target;
        else if (edge.target === member.id) connectedId = edge.source;
        if (!connectedId) continue;

        const connectedNode = rawData.nodes.find((n) => n.id === connectedId) as FamilyNode | undefined;
        if (!connectedNode || connectedNode.type === "member") continue;

        if (connectedNode.riskLevel === "high") riskCount++;
        if (connectedNode.isAchievement) achievementCount++;
      }

      health[member.id] = {
        hasRisk: riskCount > 0,
        hasAchievement: achievementCount > 0,
        riskCount,
        achievementCount,
      };
    }

    return health;
  }, [rawData]);

  // ── Node ownership map ──
  // Maps each non-member node to its owner member ID (via edges)
  const nodeOwnerMap = useMemo(() => {
    const owners: Record<string, string> = {};
    for (const node of rawData.nodes) {
      if (node.type === "member") continue;
      for (const edge of rawData.edges) {
        let memberId: string | null = null;
        if (edge.target === node.id && edge.source.startsWith("m-")) {
          memberId = edge.source;
        } else if (edge.source === node.id && edge.target.startsWith("m-")) {
          memberId = edge.target;
        }
        if (memberId) {
          owners[node.id] = memberId;
          break;
        }
      }
    }
    return owners;
  }, [rawData]);

  // ── Synced node IDs from active AI command ──
  // Determines which graph nodes are being referenced by the AI's relevant_context
  const syncedNodeIds = useMemo(() => {
    if (!activeCommand?.relevant_context?.length) return null;
    const ids = new Set<string>();

    for (const ctxType of activeCommand.relevant_context) {
      switch (ctxType) {
        case "dietary_preferences":
          for (const n of rawData.nodes) {
            if (n.type === "preference" && (n as PreferenceNode).category === "food") ids.add(n.id);
          }
          break;
        case "activities":
          for (const n of rawData.nodes) {
            if (n.type === "preference" && (n as PreferenceNode).category === "activity") ids.add(n.id);
          }
          break;
        case "devices":
          for (const n of rawData.nodes) {
            if (n.type === "device") ids.add(n.id);
          }
          break;
        case "documents":
          for (const n of rawData.nodes) {
            if (n.type === "document" && n.visibility !== "private") ids.add(n.id);
          }
          break;
        case "members":
          for (const n of rawData.nodes) {
            if (n.type === "member") ids.add(n.id);
          }
          break;
      }
    }

    return ids.size > 0 ? ids : null;
  }, [activeCommand, rawData.nodes]);

  // Filter nodes by visibility settings
  const graphData = useMemo(() => {
    let nodes = rawData.nodes.filter((n) => settings.visibleTypes[n.type]);

    if (!settings.showLeafNodes) {
      nodes = nodes.filter((n) => (connectionCount[n.id] || 0) > 1);
    }

    if (!settings.showUnconnected && effectiveFocus && highlightedIds) {
      nodes = nodes.filter((n) => highlightedIds.has(n.id));
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    const links = rawData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
        label: e.label,
        weight: (e as { weight?: number }).weight,
      }));

    return {
      nodes: nodes.map((n) => ({ ...n })) as GraphNode[],
      links: links as GraphLink[],
    };
  }, [rawData, settings.visibleTypes, settings.showLeafNodes, settings.showUnconnected, effectiveFocus, highlightedIds, connectionCount]);

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const depth = getDepthLayer(node);
      const baseR = NODE_RADIUS[node.type] || 5;
      const r = baseR * DEPTH_SCALE[depth];
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      const isDimmed = highlightedIds !== null && !highlightedIds.has(node.id);
      const isSelected = node.id === selectedNodeId;
      const isHighRisk = node.riskLevel === "high";
      const isMediumRisk = node.riskLevel === "medium";
      const isAchievement = node.isAchievement === true;
      const isOwner = node.type === "member" || nodeOwnerMap[node.id] === settings.viewerId;
      const isMasked = isHighRisk && !isOwner;
      const isPrivate = !isOwner && !isMasked &&
        (node.visibility === "private" || node.visibility === "guarded");

      // ── Pulsing red glow for high-risk nodes ──
      if (isHighRisk && !isDimmed) {
        const pulse = (Math.sin(tick / 300) + 1) / 2;
        const outerRadius = r + 8 + pulse * 6;
        const alpha = 0.15 + pulse * 0.25;

        const grad = ctx.createRadialGradient(x, y, r, x, y, outerRadius);
        grad.addColorStop(0, `rgba(239,68,68,${alpha})`);
        grad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = RISK_HIGH_COLOR;
        ctx.lineWidth = 1.5 + pulse;
        ctx.shadowColor = RISK_HIGH_COLOR;
        ctx.shadowBlur = 8 + pulse * 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Pulsing amber glow for medium-risk nodes ──
      if (isMediumRisk && !isDimmed) {
        const pulse = (Math.sin(tick / 500) + 1) / 2;
        const outerRadius = r + 6 + pulse * 4;
        const alpha = 0.1 + pulse * 0.15;

        const grad = ctx.createRadialGradient(x, y, r, x, y, outerRadius);
        grad.addColorStop(0, `rgba(245,158,11,${alpha})`);
        grad.addColorStop(1, "rgba(245,158,11,0)");
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, 2 * Math.PI);
        ctx.strokeStyle = RISK_MEDIUM_COLOR;
        ctx.lineWidth = 1 + pulse * 0.5;
        ctx.shadowColor = RISK_MEDIUM_COLOR;
        ctx.shadowBlur = 6 + pulse * 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Celebratory gold glow + particle emitter for achievements ──
      if (isAchievement && !isDimmed) {
        const shimmer = (Math.sin(tick / 400 + 1) + 1) / 2;
        const outerRadius = r + 8 + shimmer * 4;

        // Outer radial glow
        const grad = ctx.createRadialGradient(x, y, r, x, y, outerRadius);
        grad.addColorStop(0, `rgba(234,179,8,${0.2 + shimmer * 0.2})`);
        grad.addColorStop(1, "rgba(234,179,8,0)");
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();

        // Glow ring
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = ACHIEVEMENT_COLOR;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = ACHIEVEMENT_COLOR;
        ctx.shadowBlur = 10 + shimmer * 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Gold particle emitter — continuous stream radiating outward
        const PARTICLE_COUNT = 14;
        const CYCLE_DURATION = 2200; // ms per particle lifecycle
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const phase = (i / PARTICLE_COUNT) * Math.PI * 2;
          // Lifecycle position 0..1 (each particle on its own offset cycle)
          const t = ((tick + i * (CYCLE_DURATION / PARTICLE_COUNT)) % CYCLE_DURATION) / CYCLE_DURATION;

          // Spawn angle (slowly rotating, each particle offset)
          const angle = phase + tick / 4000;

          // Distance from center increases over lifecycle
          const dist = r + 3 + t * 22;

          // Upward drift for rising effect
          const driftY = -t * t * 10;

          // Position
          const px = x + Math.cos(angle) * dist;
          const py = y + Math.sin(angle) * dist + driftY;

          // Fade: full at spawn, transparent at end
          const alpha = (1 - t) * 0.85;

          // Size: starts small, grows, then shrinks
          const sizeCurve = Math.sin(t * Math.PI);
          const size = 0.4 + sizeCurve * 1.8;

          if (alpha > 0.02) {
            // Warm gold to white-gold color shift
            const r255 = Math.round(234 + (1 - t) * 21);
            const g255 = Math.round(179 + t * 50);

            ctx.beginPath();
            ctx.arc(px, py, size, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(${r255},${g255},8,${alpha})`;
            ctx.fill();

            // Particle glow halo
            if (size > 1) {
              ctx.beginPath();
              ctx.arc(px, py, size + 1.5, 0, 2 * Math.PI);
              ctx.fillStyle = `rgba(234,179,8,${alpha * 0.15})`;
              ctx.fill();
            }
          }
        }
      }

      // ── Confetti burst for celebrating members ──
      if (node.type === "member" && celebratingMemberIds?.has(node.id) && !isDimmed) {
        const CONFETTI_COUNT = 20;
        const CONFETTI_CYCLE = 3000;
        const CONFETTI_COLORS = [
          [255, 107, 107],
          [255, 217, 61],
          [78, 205, 196],
          [199, 125, 255],
          [255, 159, 67],
        ];

        for (let i = 0; i < CONFETTI_COUNT; i++) {
          const phase = (i / CONFETTI_COUNT) * Math.PI * 2;
          const t =
            ((tick + i * (CONFETTI_CYCLE / CONFETTI_COUNT)) % CONFETTI_CYCLE) /
            CONFETTI_CYCLE;
          const angle = phase + tick / 3000 + Math.sin(i * 1.7) * 0.5;
          const dist = r + 4 + t * 30;
          const driftY = -t * t * 14 + t * 8;
          const wobble = Math.sin(tick / 200 + i * 2.3) * 3;

          const px = x + Math.cos(angle) * dist + wobble;
          const py = y + Math.sin(angle) * dist + driftY;
          const alpha = (1 - t) * 0.9;
          const [cr, cg, cb] = CONFETTI_COLORS[i % CONFETTI_COLORS.length];

          if (alpha > 0.02) {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle + tick / 300);
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
            ctx.fillRect(-1.5, -0.8, 3, 1.6);
            ctx.restore();
          }
        }
      }

      // ── Golden glow for house_rule nodes ──
      if (node.type === "house_rule" && !isDimmed && !isHighRisk) {
        const shimmer = (Math.sin(tick / 500) + 1) / 2;
        const outerR = r + 6 + shimmer * 3;

        const grad = ctx.createRadialGradient(x, y, r, x, y, outerR);
        grad.addColorStop(0, `rgba(234,179,8,${0.18 + shimmer * 0.15})`);
        grad.addColorStop(1, "rgba(234,179,8,0)");
        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, 2 * Math.PI);
        ctx.strokeStyle = ACHIEVEMENT_COLOR;
        ctx.lineWidth = 1.2 + shimmer * 0.5;
        ctx.shadowColor = ACHIEVEMENT_COLOR;
        ctx.shadowBlur = 8 + shimmer * 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Red pulse for health nodes ──
      if (node.type === "health" && !isDimmed) {
        const pulse = (Math.sin(tick / 600) + 1) / 2;
        const outerR = r + 5 + pulse * 2;

        const grad = ctx.createRadialGradient(x, y, r, x, y, outerR);
        grad.addColorStop(0, `rgba(239,68,68,${0.15 + pulse * 0.1})`);
        grad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 1, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1 + pulse * 0.4;
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 6 + pulse * 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Green glow for selected node ──
      if (isSelected && !isHighRisk && !isAchievement) {
        const gradient = ctx.createRadialGradient(x, y, r, x, y, r + 10);
        gradient.addColorStop(0, `${GLOW_COLOR}40`);
        gradient.addColorStop(1, `${GLOW_COLOR}00`);
        ctx.beginPath();
        ctx.arc(x, y, r + 10, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = GLOW_COLOR;
        ctx.lineWidth = 2;
        ctx.shadowColor = GLOW_COLOR;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Z-depth shadow effects ──
      if (!isDimmed) {
        if (depth === 0) {
          // Bottom layer: ground platform shadow
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(x, y + r + 2, r * 1.4, r * 0.4, 0, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fill();
          // Dashed depth ring to indicate grounded layer
          ctx.beginPath();
          ctx.arc(x, y, r + 1, 0, 2 * Math.PI);
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = "rgba(16,185,129,0.2)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        } else if (depth === 2) {
          // Top layer: elevated float shadow (offset to simulate height)
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(x + 1.5, y + r + 5, r * 1.1, r * 0.3, 0, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fill();
          // Subtle upward glow ring for floating nodes
          const floatPulse = (Math.sin(tick / 800) + 1) / 2;
          ctx.beginPath();
          ctx.arc(x, y, r + 2 + floatPulse, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(139,92,246,${0.12 + floatPulse * 0.08})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        }
      }

      // ── Node shape (glassmorphism style) ──
      // Determine the base color for this node
      let baseColor: string;
      let fillAlpha: number;
      if (isDimmed) {
        baseColor = DIMMED_NODE;
        fillAlpha = 0.4;
      } else if (isHighRisk) {
        baseColor = RISK_HIGH_COLOR;
        fillAlpha = 0.85;
      } else if (isMediumRisk) {
        baseColor = RISK_MEDIUM_COLOR;
        fillAlpha = 0.85;
      } else if (isAchievement) {
        baseColor = ACHIEVEMENT_COLOR;
        fillAlpha = 0.85;
      } else if (isSelected) {
        baseColor = GLOW_COLOR;
        fillAlpha = 0.9;
      } else {
        baseColor = NODE_COLORS[node.type];
        fillAlpha = depth === 0 ? 0.5 : 0.7;
      }

      // Preference nodes: reduced opacity unless parent member is highlighted
      if (node.type === "preference" && !isDimmed && !isSelected && !isHighRisk && !isMediumRisk && !isAchievement) {
        const isParentHighlighted = highlightedIds !== null && highlightedIds.has(node.id);
        if (!isParentHighlighted) {
          fillAlpha = 0.55;
        }
      }

      // Glass body fill (semi-transparent, shape-specific)
      shapePath(ctx, node.type, x, y, r);
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = baseColor;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Glass rim (bright edge)
      if (!isDimmed) {
        shapePath(ctx, node.type, x, y, r);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Inner highlight (top-left specular reflection)
        ctx.save();
        const hlX = x - r * 0.3;
        const hlY = y - r * 0.3;
        const hlR = r * 0.5;
        const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
        hlGrad.addColorStop(0, "rgba(255,255,255,0.25)");
        hlGrad.addColorStop(1, "rgba(255,255,255,0)");
        shapePath(ctx, node.type, x, y, r);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(hlX, hlY, hlR, 0, 2 * Math.PI);
        ctx.fillStyle = hlGrad;
        ctx.fill();
        ctx.restore();
      }

      // ── Frosted lock overlay for private nodes (non-owner) ──
      if (isPrivate && !isDimmed) {
        // Frosted glass overlay
        ctx.save();
        shapePath(ctx, node.type, x, y, r);
        ctx.clip();

        // Semi-transparent frosted fill
        ctx.fillStyle = "rgba(24, 24, 30, 0.7)";
        ctx.fillRect(x - r, y - r, r * 2, r * 2);

        // Diagonal noise lines (simulating frosted glass texture)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 0.5;
        for (let i = -r * 2; i < r * 2; i += 3) {
          ctx.beginPath();
          ctx.moveTo(x + i, y - r);
          ctx.lineTo(x + i + r, y + r);
          ctx.stroke();
        }

        ctx.restore();

        // Lock icon on top
        const lockSize = Math.max(r * 0.55, 3);
        ctx.save();
        ctx.strokeStyle = "rgba(161, 161, 170, 0.8)";
        ctx.lineWidth = Math.max(lockSize * 0.2, 0.8);
        ctx.lineCap = "round";

        // Lock shackle (U shape)
        const shackleW = lockSize * 0.6;
        const shackleH = lockSize * 0.5;
        ctx.beginPath();
        ctx.arc(x, y - lockSize * 0.15, shackleW / 2, Math.PI, 0);
        ctx.stroke();

        // Lock body (rounded rect)
        const bodyW = lockSize * 0.9;
        const bodyH = lockSize * 0.65;
        const bodyY = y - lockSize * 0.15 + shackleH * 0.05;
        ctx.fillStyle = "rgba(113, 113, 122, 0.5)";
        ctx.beginPath();
        ctx.roundRect(x - bodyW / 2, bodyY, bodyW, bodyH, lockSize * 0.1);
        ctx.fill();
        ctx.stroke();

        // Keyhole dot
        ctx.beginPath();
        ctx.arc(x, bodyY + bodyH * 0.4, lockSize * 0.1, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(161, 161, 170, 0.9)";
        ctx.fill();

        ctx.restore();
      }

      // ── Label ──
      const fontSize = Math.max(12 / globalScale, 2);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // Preference nodes: match the faded opacity for the label too
      const isPrefFaded = node.type === "preference" && !isDimmed && !isSelected && !isHighRisk && !isMediumRisk && !isAchievement
        && !(highlightedIds !== null && highlightedIds.has(node.id));

      if (isDimmed) {
        ctx.fillStyle = "#3f3f46";
      } else if (isHighRisk) {
        ctx.fillStyle = RISK_HIGH_COLOR;
      } else if (isAchievement) {
        ctx.fillStyle = ACHIEVEMENT_COLOR;
      } else if (isSelected) {
        ctx.fillStyle = GLOW_COLOR;
      } else if (isPrivate) {
        ctx.fillStyle = "#71717a";
      } else {
        ctx.fillStyle = "#d4d4d8";
      }
      if (isPrefFaded) ctx.globalAlpha = 0.6;
      const displayLabel = isMasked
        ? "\u26a0 System Alert"
        : isPrivate
          ? "\ud83d\udd12 Private"
          : node.label;
      ctx.fillText(displayLabel, x, y + r + 3);
      if (isPrefFaded) ctx.globalAlpha = 1;

      // ── Health Status indicator (member nodes only) ──
      if (node.type === "member" && !isDimmed) {
        const health = memberHealth[node.id];
        if (!health) return;

        const badges: { color: string; glowColor: string }[] = [];
        if (health.hasRisk) badges.push({ color: RISK_HIGH_COLOR, glowColor: RISK_HIGH_COLOR });
        if (health.hasAchievement) badges.push({ color: ACHIEVEMENT_COLOR, glowColor: ACHIEVEMENT_COLOR });

        // If no risk or achievement, show a green "all clear" badge
        if (badges.length === 0) {
          badges.push({ color: "#22c55e", glowColor: "#22c55e" });
        }

        const badgeR = Math.max(2.5 / Math.sqrt(globalScale), 1.2);
        const badgeY = y - r - badgeR - 2;
        const totalWidth = badges.length * (badgeR * 2 + 2) - 2;
        const startX = x - totalWidth / 2 + badgeR;

        for (let i = 0; i < badges.length; i++) {
          const bx = startX + i * (badgeR * 2 + 2);
          const badge = badges[i];

          // Subtle glow behind badge
          ctx.beginPath();
          ctx.arc(bx, badgeY, badgeR + 1.5, 0, 2 * Math.PI);
          ctx.fillStyle = `${badge.glowColor}30`;
          ctx.fill();

          // Badge dot
          ctx.beginPath();
          ctx.arc(bx, badgeY, badgeR, 0, 2 * Math.PI);
          ctx.fillStyle = badge.color;
          ctx.fill();

          // For risk badges, add a subtle pulse ring
          if (badge.color === RISK_HIGH_COLOR) {
            const pulse = (Math.sin(tick / 400) + 1) / 2;
            ctx.beginPath();
            ctx.arc(bx, badgeY, badgeR + 1 + pulse * 2, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(239,68,68,${0.3 + pulse * 0.3})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── Sync Glow pulse ring (AI context active) ──
      if (syncedNodeIds?.has(node.id) && !isDimmed) {
        const syncPulse = (Math.sin(tick / 350 + Math.PI / 3) + 1) / 2;
        const syncR = r + 4 + syncPulse * 4;

        // Outer glow halo
        const syncGrad = ctx.createRadialGradient(x, y, r, x, y, syncR + 4);
        syncGrad.addColorStop(0, `rgba(129,140,248,${0.12 + syncPulse * 0.1})`);
        syncGrad.addColorStop(1, "rgba(129,140,248,0)");
        ctx.beginPath();
        ctx.arc(x, y, syncR + 4, 0, 2 * Math.PI);
        ctx.fillStyle = syncGrad;
        ctx.fill();

        // Dashed ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, syncR, 0, 2 * Math.PI);
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = -tick / 80; // animated dash crawl
        ctx.strokeStyle = `rgba(129,140,248,${0.4 + syncPulse * 0.35})`;
        ctx.lineWidth = 1 + syncPulse * 0.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── Focus connectors (sidebar → member node) ──
      if (
        focusMemberIds?.includes(node.id) &&
        node.type === "member" &&
        !isDimmed &&
        fgRef.current
      ) {
        const fg = fgRef.current;
        // Convert sidebar right-edge (256px screen) to graph coords
        const sidebarEdge = fg.screen2GraphCoords(256, 0);
        const nodeScreen = fg.graph2ScreenCoords(x, y);
        const startGraph = fg.screen2GraphCoords(256, nodeScreen.y);

        const startX = sidebarEdge.x;
        const startY = startGraph.y;
        const dx = x - startX;
        const cp1X = startX + dx * 0.35;
        const cp2X = startX + dx * 0.65;

        const pulse = (Math.sin(tick / 350) + 1) / 2;

        ctx.save();

        // Outer glow (wide, soft amber)
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1X, startY, cp2X, y, x, y);
        ctx.strokeStyle = `rgba(245,158,11,${0.04 + pulse * 0.06})`;
        ctx.lineWidth = 10 + pulse * 4;
        ctx.lineCap = "round";
        ctx.stroke();

        // Inner dashed line (animated crawl)
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1X, startY, cp2X, y, x, y);
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -tick / 50;
        ctx.strokeStyle = `rgba(245,158,11,${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 1.5 + pulse * 0.5;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling dot along the Bezier
        const t = ((tick / 1800) % 1);
        const mt = 1 - t;
        const dotX = mt * mt * mt * startX + 3 * mt * mt * t * cp1X + 3 * mt * t * t * cp2X + t * t * t * x;
        const dotY = mt * mt * mt * startY + 3 * mt * mt * t * startY + 3 * mt * t * t * y + t * t * t * y;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2 + pulse, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(245,158,11,${0.6 + pulse * 0.3})`;
        ctx.fill();

        // Arrival node ring pulse
        const arriveGrad = ctx.createRadialGradient(x, y, r, x, y, r + 6 + pulse * 3);
        arriveGrad.addColorStop(0, `rgba(245,158,11,${0.1 + pulse * 0.08})`);
        arriveGrad.addColorStop(1, "rgba(245,158,11,0)");
        ctx.beginPath();
        ctx.arc(x, y, r + 6 + pulse * 3, 0, 2 * Math.PI);
        ctx.fillStyle = arriveGrad;
        ctx.fill();

        ctx.restore();
      }
    },
    [highlightedIds, selectedNodeId, tick, memberHealth, nodeOwnerMap, settings.viewerId, syncedNodeIds, focusMemberIds],
  );

  // ── Glassmorphism tooltip ──
  const nodeTooltip = useCallback(
    (node: GraphNode) => {
      const depth = getDepthLayer(node);
      const isOwner = node.type === "member" || nodeOwnerMap[node.id] === settings.viewerId;
      const masked = node.riskLevel === "high" && !isOwner;
      const label = masked ? "\u26a0 System Alert" : node.label;
      const typeColor = NODE_COLORS[node.type];

      let badges = "";
      if (node.riskLevel === "high") {
        badges += `<span style="color:#ef4444;font-size:10px">\u25cf High Risk</span>`;
      } else if (node.riskLevel === "medium") {
        badges += `<span style="color:#f59e0b;font-size:10px">\u25cf Medium</span>`;
      }
      if (node.isAchievement) {
        badges += `<span style="color:#eab308;font-size:10px">\u2605 Achievement</span>`;
      }

      return `<div style="
        display:flex;flex-direction:column;gap:4px;padding:10px 14px;min-width:120px;
      ">
        <div style="font-size:13px;font-weight:600;color:#f4f4f5">${label}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="color:${typeColor};font-size:11px;text-transform:capitalize">${node.type}</span>
          <span style="color:#52525b;font-size:10px">${LAYER_NAMES[depth]}</span>
        </div>
        ${badges ? `<div style="display:flex;gap:6px;margin-top:2px">${badges}</div>` : ""}
        ${masked ? `<div style="color:#71717a;font-size:10px;margin-top:2px">Click to request access</div>` : ""}
      </div>`;
    },
    [nodeOwnerMap, settings.viewerId],
  );

  const linkColor = useCallback(
    (link: GraphLink) => {
      const w = link.weight ?? 0;
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (highlightedEdges !== null) {
        const key = `${sourceId}__${targetId}`;
        if (!highlightedEdges.has(key)) return DIMMED_LINK;
      }

      // Weight-based color for member-to-member links
      if (w >= 4 && sourceId.startsWith("m-") && targetId.startsWith("m-")) {
        // Bright warm glow for frequent interactions
        return w >= 5 ? "#60a5fa" : "#3b82f6";
      }

      if (highlightedEdges !== null) return ACTIVE_LINK;
      return DEFAULT_LINK;
    },
    [highlightedEdges],
  );

  // Custom link glow for high-weight connections + sync glow
  const paintLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;
      if (!source.x || !target.x) return;

      const sourceId = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;

      // ── Sync Glow: glowing dashed line for AI-referenced edges ──
      if (syncedNodeIds) {
        const sourceIsSynced = syncedNodeIds.has(sourceId);
        const targetIsSynced = syncedNodeIds.has(targetId);
        const sourceIsMember = sourceId.startsWith("m-");
        const targetIsMember = targetId.startsWith("m-");

        // Draw sync glow when a synced non-member connects to a member,
        // or when both endpoints are synced
        const isSyncEdge =
          (sourceIsSynced && targetIsMember) ||
          (targetIsSynced && sourceIsMember) ||
          (sourceIsSynced && targetIsSynced);

        if (isSyncEdge) {
          const syncPulse = (Math.sin(tick / 400) + 1) / 2;
          const sx = source.x;
          const sy = source.y ?? 0;
          const tx = target.x;
          const ty = target.y ?? 0;

          // Outer glow (wide, soft)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = `rgba(129,140,248,${0.06 + syncPulse * 0.08})`;
          ctx.lineWidth = 6 + syncPulse * 3;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.restore();

          // Inner dashed line (animated crawl)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -tick / 60;
          ctx.strokeStyle = `rgba(129,140,248,${0.35 + syncPulse * 0.35})`;
          ctx.lineWidth = 1.5 + syncPulse * 0.5;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // Traveling dot along the edge
          const dotT = ((tick / 1200) % 1);
          const dotX = sx + (tx - sx) * dotT;
          const dotY = sy + (ty - sy) * dotT;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1.5 + syncPulse, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(165,180,252,${0.6 + syncPulse * 0.3})`;
          ctx.fill();
        }
      }

      // ── Weight glow: only for high-weight member-to-member links ──
      const w = link.weight ?? 0;
      if (w < 4) return;
      if (!sourceId.startsWith("m-") || !targetId.startsWith("m-")) return;

      // Check if this link is dimmed
      if (highlightedEdges !== null) {
        const key = `${sourceId}__${targetId}`;
        if (!highlightedEdges.has(key)) return;
      }

      const pulse = (Math.sin(tick / 600) + 1) / 2;
      const glowWidth = (w / 5) * 4 + pulse * 2;
      const alpha = 0.08 + (w / 5) * 0.12 + pulse * 0.04;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(source.x, source.y ?? 0);
      ctx.lineTo(target.x, target.y ?? 0);
      ctx.strokeStyle = `rgba(96,165,250,${alpha})`;
      ctx.lineWidth = glowWidth;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    },
    [highlightedEdges, tick, syncedNodeIds],
  );

  const linkCanvasMode = useCallback(
    () => "after" as const,
    [],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeSelect(node.id === selectedNodeId ? null : node.id);
    },
    [onNodeSelect, selectedNodeId],
  );

  const handleBackgroundRightClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onNodeSelect(null);
    },
    [onNodeSelect],
  );

  const handleNodeDragEnd = useCallback((node: GraphNode) => {
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  if (!ForceGraph) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center text-zinc-500"
        style={{ backgroundColor: "#0f0f14" }}
      >
        Loading graph…
      </div>
    );
  }

  const [legendOpen, setLegendOpen] = useState(true);

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ backgroundColor: "#0f0f14" }}>
      {/* Floating graph legend */}
      <div className="absolute bottom-4 left-4 z-10">
        {legendOpen ? (
          <div className="rounded-lg border border-white/[0.06] bg-[rgba(15,15,22,0.85)] px-3 py-2 backdrop-blur-lg">
            <button
              onClick={() => setLegendOpen(false)}
              className="mb-1.5 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              Legend
              <svg className="h-3 w-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <div className="flex flex-col gap-1">
              {(Object.entries(NODE_COLORS) as [NodeType, string][]).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: color, opacity: 0.8 }}
                  />
                  <span className="text-[10px] capitalize text-zinc-400">
                    {type === "house_rule" ? "House Rule" : type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setLegendOpen(true)}
            className="rounded-lg border border-white/[0.06] bg-[rgba(15,15,22,0.85)] px-2.5 py-1.5 text-[10px] text-zinc-500 backdrop-blur-lg transition-colors hover:text-zinc-300"
          >
            Legend
          </button>
        )}
      </div>

      <ForceGraph
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        nodeLabel={nodeTooltip}
        nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
          const r = (NODE_RADIUS[node.type] || 5) + 4;
          shapePath(ctx, node.type, node.x ?? 0, node.y ?? 0, r);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={linkColor}
        linkCanvasObjectMode={linkCanvasMode}
        linkCanvasObject={paintLink}
        linkWidth={(link: GraphLink) => {
          const w = link.weight ?? 0;
          const sourceId = typeof link.source === "string" ? link.source : link.source.id;
          const targetId = typeof link.target === "string" ? link.target : link.target.id;

          // Weight-based width for member-to-member links
          if (w >= 3 && sourceId.startsWith("m-") && targetId.startsWith("m-")) {
            const base = 0.6 + (w / 5) * 1.4;
            if (highlightedEdges) {
              return highlightedEdges.has(`${sourceId}__${targetId}`) ? base + 0.5 : 0.3;
            }
            return base;
          }

          if (!highlightedEdges) return 1;
          return highlightedEdges.has(`${sourceId}__${targetId}`) ? 1.5 : 0.5;
        }}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkLabel={(link: GraphLink) => link.label || link.relation}
        onNodeClick={handleNodeClick}
        onBackgroundRightClick={handleBackgroundRightClick}
        onNodeDragEnd={handleNodeDragEnd}
        enableNodeDrag={true}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        backgroundColor="#0f0f14"
      />
    </div>
  );
}
