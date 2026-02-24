import type { SynapseEvent } from "@/types/family";
import type { FamilyNode, Edge } from "@/types/family";

// ── Types ────────────────────────────────────────────────────

export interface HighRiskAlert {
  eventId: string;
  event: SynapseEvent;
  targetNodeId: string;      // The high-risk node (e.g. "d-suspicious-app")
  childId: string;            // The child member involved
  childLabel: string;
  parentId: string;           // The parent to notify (e.g. "m-dad")
  parentLabel: string;
  scripts: TrendlifeScript[];
}

export interface TrendlifeScript {
  tone: string;
  message: string;
  followUp: string;
  livoNote: string;           // Curator guidance for the parent
}

// ── Detection ────────────────────────────────────────────────

/**
 * Scans synapse events for high-risk signals involving children.
 * When detected, returns a HighRiskAlert targeting the first available
 * parent viewer with 3 Trendlife-style coaching scripts.
 *
 * Detection criteria:
 * - Event impact is "Negative" with intensity >= 3
 * - Event description matches app install / suspicious activity patterns
 * - At least one involved member is a child
 * - At least one parent exists in the graph
 */
export function handle_high_risk_event(
  events: SynapseEvent[],
  nodes: FamilyNode[],
  edges: Edge[],
): HighRiskAlert | null {
  // Pattern: new app installs, suspicious apps, unknown software
  const HIGH_RISK_PATTERNS = [
    /suspicious.*app/i,
    /app.*install/i,
    /app.*detect/i,
    /unknown.*app/i,
    /new.*app/i,
    /install.*detect/i,
    /malware/i,
    /unauthorized/i,
  ];

  for (const event of events) {
    // Only negative events with meaningful intensity
    if (event.impact !== "Negative" || event.intensity < 3) continue;

    // Check if description matches high-risk app pattern
    const isAppRisk = HIGH_RISK_PATTERNS.some((p) => p.test(event.description));
    if (!isAppRisk) continue;

    // Find the child involved
    const childNode = event.involvedMembers
      .map((id) => nodes.find((n) => n.id === id))
      .find((n) => n && n.type === "member" && "role" in n && n.role === "child");
    if (!childNode) continue;

    // Find a parent to notify — prefer one already involved in the event
    const involvedParent = event.involvedMembers
      .map((id) => nodes.find((n) => n.id === id))
      .find((n) => n && n.type === "member" && "role" in n && n.role === "parent");

    const anyParent = involvedParent
      ?? nodes.find((n) => n.type === "member" && "role" in n && n.role === "parent");
    if (!anyParent) continue;

    // Find the high-risk node connected to the child (the suspicious app itself)
    const highRiskNodeId = edges
      .filter(
        (e) =>
          (e.source === childNode.id || e.target === childNode.id) &&
          (e.relation === "owns_device" || e.relation === "installed_on"),
      )
      .map((e) => (e.source === childNode.id ? e.target : e.source))
      .find((id) => {
        const n = nodes.find((n) => n.id === id);
        return n && n.riskLevel === "high";
      }) ?? "";

    const childLabel = childNode.label;
    const childAge = "age" in childNode ? childNode.age : undefined;
    const ageContext = childAge ? ` (${childAge} years old)` : "";

    return {
      eventId: event.id,
      event,
      targetNodeId: highRiskNodeId,
      childId: childNode.id,
      childLabel,
      parentId: anyParent.id,
      parentLabel: anyParent.label,
      scripts: buildTrendlifeScripts(childLabel, ageContext, event.description),
    };
  }

  return null;
}

// ── Trendlife Coaching Scripts ────────────────────────────────

function buildTrendlifeScripts(
  childName: string,
  ageContext: string,
  eventDesc: string,
): TrendlifeScript[] {
  return [
    {
      tone: "Safety-First",
      message: `Hey ${childName}, I noticed something new on your device and I want to make sure we're both comfortable with it. I'm not angry — I care about your safety online. Can we look at it together?`,
      followUp: `What made you interested in this app? I'd love to understand.`,
      livoNote: `Trendlife Curator tip: Lead with curiosity, not accusation. ${childName}${ageContext} is more likely to open up when they feel safe, not surveilled. Your goal is understanding, not punishment.`,
    },
    {
      tone: "Trust-Building",
      message: `${childName}, I trust you and I want you to feel comfortable coming to me about things online. I saw something that flagged as unusual — can we have a quick chat about it? No lectures, I promise.`,
      followUp: `Is there anything else on your devices you'd like to tell me about? I promise to listen first.`,
      livoNote: `Trendlife Curator tip: Frame this as a partnership. Children${ageContext ? ` at age ${ageContext.replace(/[() years old]/g, "").trim()}` : ""} respond better to collaborative safety than top-down rules. Ask before you restrict.`,
    },
    {
      tone: "Emotionally Aware",
      message: `I know growing up means exploring new things, and that's okay. I noticed an app that I'm not familiar with, and I'd feel better if we could talk about it. Your feelings and privacy matter to me.`,
      followUp: `How would you feel about us setting up some guidelines together for new app installs?`,
      livoNote: `Trendlife Curator tip: Acknowledge ${childName}'s autonomy. The goal isn't to control — it's to build a family culture where safety conversations happen naturally. Emotional Harmony first.`,
    },
  ];
}
