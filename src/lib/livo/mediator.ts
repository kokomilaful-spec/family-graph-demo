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
 * - Event description matches financial risk patterns (investment group,
 *   high return, scam, etc.)
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
    /investment.*group/i,
    /投資.*群組/i,
    /可疑.*投資/i,
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
      message: `Mom, I heard you joined an investment group? I don't know much about investing — could you teach me how to evaluate it?`,
      followUp: `How did you find that group? What do they discuss?`,
      livoNote: `Let ${elderName} be the teacher, not the accused. Asking "teach me" works far better than saying "you got scammed."`,
    },
    {
      tone: "Curiosity & Admiration",
      message: `Mom, that group sounds interesting — can we look into it together? I'd love to learn from you.`,
      followUp: `Has anyone in the group actually made money? We could check together.`,
      livoNote: `Turn the conversation into learning together, not intervening. ${elderName} is more open when she feels respected.`,
    },
    {
      tone: "Family Partnership",
      message: `Mom, family finances affect all of us — can we look into this group together?`,
      followUp: `Let's make a checklist: Is the firm registered? What are the fees? Are the returns too high?`,
      livoNote: `Turn verification into a family activity. ${elderName} keeps the lead, and ${parentName} stays informed.`,
    },
  ];
}
