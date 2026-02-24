import type { SynapseEvent, FamilyNode, Edge } from "@/types/family";

// ── Types ────────────────────────────────────────────────────

export interface MediatorAlert {
  eventId: string;
  event: SynapseEvent;
  targetNodeId: string;       // The risky node (e.g. "doc-gold-fund")
  elderId: string;             // The elder member involved (e.g. "m-grandma")
  elderLabel: string;
  parentId: string;            // The parent to coach (e.g. "m-dad")
  parentLabel: string;
  scripts: RespectHonorScript[];
}

export interface RespectHonorScript {
  tone: string;
  message: string;
  followUp: string;
  livoNote: string;            // Curator guidance for the parent
}

// ── Detection ────────────────────────────────────────────────

/**
 * LivoMediator: Scans synapse events for high-risk financial signals
 * involving elders (grandparents). Unlike handle_high_risk_event which
 * triggers standard safety alerts for children, LivoMediator produces
 * "Respect & Honor" coaching scripts that treat the elder as the expert.
 *
 * Detection criteria:
 * - Event impact is "Negative" with intensity >= 3
 * - Event description matches financial risk patterns (gold fund,
 *   investment, high return, scam, etc.)
 * - At least one involved member is a grandparent
 * - At least one parent exists in the graph to be coached
 *
 * Key principle: Do NOT trigger a standard alert. Instead, coach
 * the parent to approach the elder with deference and curiosity.
 */
export function livo_mediator(
  events: SynapseEvent[],
  nodes: FamilyNode[],
  edges: Edge[],
): MediatorAlert | null {
  const FINANCIAL_RISK_PATTERNS = [
    /gold.*fund/i,
    /high.*return/i,
    /15%.*return/i,
    /investment.*scam/i,
    /investment.*risk/i,
    /ponzi/i,
    /guaranteed.*return/i,
    /suspicious.*invest/i,
    /financial.*risk/i,
    /risky.*invest/i,
    /unregistered.*fund/i,
    /too.*good.*true/i,
  ];

  for (const event of events) {
    // Only negative events with meaningful intensity
    if (event.impact !== "Negative" || event.intensity < 3) continue;

    // Check if description matches financial risk pattern
    const isFinancialRisk = FINANCIAL_RISK_PATTERNS.some((p) =>
      p.test(event.description),
    );
    if (!isFinancialRisk) continue;

    // Find the elder (grandparent) involved
    const elderNode = event.involvedMembers
      .map((id) => nodes.find((n) => n.id === id))
      .find(
        (n) =>
          n &&
          n.type === "member" &&
          "role" in n &&
          n.role === "grandparent",
      );
    if (!elderNode) continue;

    // Find a parent to coach — prefer one already involved in the event
    const involvedParent = event.involvedMembers
      .map((id) => nodes.find((n) => n.id === id))
      .find(
        (n) => n && n.type === "member" && "role" in n && n.role === "parent",
      );

    const anyParent =
      involvedParent ??
      nodes.find(
        (n) => n.type === "member" && "role" in n && n.role === "parent",
      );
    if (!anyParent) continue;

    // Find the high-risk financial node connected to the elder
    const targetNodeId =
      edges
        .filter(
          (e) =>
            (e.source === elderNode.id || e.target === elderNode.id) &&
            (e.relation === "authored" || e.relation === "related_to"),
        )
        .map((e) =>
          e.source === elderNode.id ? e.target : e.source,
        )
        .find((id) => {
          const n = nodes.find((n) => n.id === id);
          return n && n.riskLevel === "high";
        }) ?? "";

    const elderLabel = elderNode.label;
    const parentLabel = anyParent.label;

    return {
      eventId: event.id,
      event,
      targetNodeId,
      elderId: elderNode.id,
      elderLabel,
      parentId: anyParent.id,
      parentLabel,
      scripts: buildRespectHonorScripts(elderLabel, parentLabel, event.description),
    };
  }

  return null;
}

// ── Respect & Honor Coaching Scripts ─────────────────────────

function buildRespectHonorScripts(
  elderName: string,
  parentName: string,
  eventDesc: string,
): RespectHonorScript[] {
  return [
    {
      tone: "Respect & Honor",
      message: `Hey Mom, you're an expert in gold. Can you teach me how to check this firm's credentials? I'd love to learn from your experience before we commit any money.`,
      followUp: `What was it about this fund that caught your eye? I bet you noticed something I'd miss.`,
      livoNote: `Trendlife Curator tip: ${elderName} has decades of life experience. Position yourself as the learner, not the authority. By asking her to teach you, you honor her wisdom while naturally guiding a due-diligence conversation. Never say "you got scammed" — say "teach me how to evaluate this."`,
    },
    {
      tone: "Curiosity & Admiration",
      message: `Mom, I heard you're looking into a gold investment — that sounds really interesting! I don't know much about this area. Could we sit down together and go through the details? I trust your judgment and I'd love to understand it better.`,
      followUp: `Have you talked to anyone else about it? Maybe we could also ask Uncle Chen — he used to work in banking.`,
      livoNote: `Trendlife Curator tip: Frame the conversation as a family learning opportunity, not a intervention. ${elderName} is more receptive when she feels admired, not doubted. Bringing in a trusted third party (Uncle, friend) adds perspective without undermining her.`,
    },
    {
      tone: "Family Partnership",
      message: `Mom, I was thinking — our family finances affect all of us, and I'd love your guidance on how to evaluate investments. You've always been smart with money. Can we review this gold fund together as a family project?`,
      followUp: `What if we made a checklist together? Things like — is the firm registered, what are the fees, can we verify the returns?`,
      livoNote: `Trendlife Curator tip: Turn this into a shared activity, not a solo decision. ${elderName} keeps her dignity and agency while ${parentName} gains visibility into the details. The "family project" framing makes due diligence feel collaborative, not controlling.`,
    },
  ];
}
