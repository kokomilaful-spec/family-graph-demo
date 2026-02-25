import type { FamilyNode, MemberNode, PreferenceNode, HealthNode, Edge } from "@/types/family";

// ── Types ────────────────────────────────────────────────────

export interface ScholarFilterResult {
  active: boolean;
  scaffoldResponse: string;
  childName: string;
  childAge: number;
}

export interface DietaryRestriction {
  memberId: string;
  memberLabel: string;
  source: "preference" | "health";
  label: string;
  sentiment?: string;
  severity?: string;
}

export interface ValueFilterResult {
  restrictions: DietaryRestriction[];
  instruction: string;
  cpNote: string;       // CP值 (best value) guidance
}

// ── ScholarFilter ────────────────────────────────────────────

/**
 * ScholarFilter: Detects when a child viewer sends a homework-related
 * message and switches TrendLife to "Scaffolding Mode" — responding only
 * with guiding questions, never direct answers.
 *
 * Purpose: Build critical thinking by making the child figure out
 * the answer themselves, with TrendLife acting as a Socratic tutor.
 */

const HOMEWORK_PATTERNS = [
  /homework/i,
  /\bmath\b/i,
  /\bscience\b/i,
  /\bhistory\b/i,
  /\benglish\b/i,
  /what is .{3,}/i,
  /how do (i|you|we) (solve|calculate|find|answer)/i,
  /help me (with|do|solve|finish|answer)/i,
  /can you (help|explain|tell me|answer|solve)/i,
  /what('s| is) the answer/i,
  /solve (this|the)/i,
  /explain (this|how|why|what)/i,
  /\btest\b.*\btomorrow\b/i,
  /\btomorrow\b.*\btest\b/i,
  /\bexam\b/i,
  /\bquiz\b/i,
  /\bessay\b/i,
  /\breport\b.*\bdue\b/i,
  /\bdue\b.*\breport\b/i,
  /\bproject\b.*\bschool\b/i,
  /\bschool\b.*\bproject\b/i,
  /\bstudy\b/i,
  /\b\d+\s*[\+\-\*\/\×\÷]\s*\d+/i,
];

export function scholar_filter(
  message: string,
  viewerNode: FamilyNode | undefined,
): ScholarFilterResult {
  const inactive: ScholarFilterResult = {
    active: false,
    scaffoldResponse: "",
    childName: "",
    childAge: 0,
  };

  // Only active for child viewers
  if (!viewerNode || viewerNode.type !== "member") return inactive;
  const member = viewerNode as MemberNode;
  if (member.role !== "child") return inactive;

  // Check if message matches homework patterns
  const isHomework = HOMEWORK_PATTERNS.some((p) => p.test(message));
  if (!isHomework) return inactive;

  const childName = member.label;
  const childAge = member.age ?? 10;

  // Build scaffolding response (Socratic questions, no direct answers)
  const scaffoldResponse = buildScaffoldResponse(message, childName, childAge);

  return {
    active: true,
    scaffoldResponse,
    childName,
    childAge,
  };
}

function buildScaffoldResponse(
  message: string,
  childName: string,
  age: number,
): string {
  // Math-related
  if (/\bmath\b|\d+\s*[\+\-\*\/\×\÷]\s*\d+|calculate|equation/i.test(message)) {
    return `Great question, ${childName}! Before I help, let me ask you: What do you already know about this type of problem? Can you break it into smaller steps? Try the first step, and I'll guide you from there.`;
  }

  // Science-related
  if (/\bscience\b|experiment|molecule|atom|cell|plant|animal|physics|chemistry|biology/i.test(message)) {
    return `Interesting topic, ${childName}! What have you observed or read about this so far? If you had to make a guess, what do you think the answer might be? Let's reason through it together.`;
  }

  // Essay / report
  if (/\bessay\b|\breport\b|\bwriting\b|\bwrite\b/i.test(message)) {
    return `Let's work on this together, ${childName}! First — what's the main idea you want to communicate? Can you tell me in one sentence what your essay should be about? That's always the best place to start.`;
  }

  // History
  if (/\bhistory\b|\bwar\b|\bking\b|\bdynasty\b|\bempire\b/i.test(message)) {
    return `Good question, ${childName}! What do you already know about this time period? Think about who was involved and why it mattered. Can you find one key fact to start with?`;
  }

  // Generic homework
  return `I can see you're working hard, ${childName}! Instead of giving you the answer directly, let me help you think through it. What part of this question do you understand? What part is confusing? Let's start with what you know and build from there.`;
}

// ── ValueFilter ──────────────────────────────────────────────

/**
 * ValueFilter: When a food-related command is triggered, aggregates ALL
 * dietary restrictions across the family — from both preference nodes
 * (food category) and health nodes (dietary conditions) — into a single
 * instruction for the food agent, prioritizing CP值 (best value) options.
 *
 * Sources:
 * 1. Preference nodes with category="food" (e.g. "No Meat" avoids)
 * 2. Health nodes linked to members (e.g. Diabetes → Low-Salt Diet)
 * 3. Member healthTags (e.g. Grandma's "Low-Salt Diet")
 */
export function value_filter(
  nodes: FamilyNode[],
  edges: Edge[],
): ValueFilterResult {
  const restrictions: DietaryRestriction[] = [];

  // 1. Preference-based dietary restrictions (food category)
  const prefEdges = edges.filter((e) => e.relation === "has_preference");
  for (const edge of prefEdges) {
    const memberId = edge.source.startsWith("m-") ? edge.source : edge.target;
    const prefId = edge.source.startsWith("m-") ? edge.target : edge.source;
    const member = nodes.find((n) => n.id === memberId) as MemberNode | undefined;
    const pref = nodes.find((n) => n.id === prefId) as PreferenceNode | undefined;
    if (member && pref?.category === "food") {
      restrictions.push({
        memberId: member.id,
        memberLabel: member.label,
        source: "preference",
        label: pref.label,
        sentiment: pref.sentiment,
      });
    }
  }

  // 2. Health-based dietary restrictions
  const healthEdges = edges.filter((e) => e.relation === "has_health_condition");
  for (const edge of healthEdges) {
    const memberId = edge.source.startsWith("m-") ? edge.source : edge.target;
    const healthId = edge.source.startsWith("m-") ? edge.target : edge.source;
    const member = nodes.find((n) => n.id === memberId) as MemberNode | undefined;
    const health = nodes.find((n) => n.id === healthId) as HealthNode | undefined;
    if (member && health) {
      // Check if this health condition implies dietary restriction
      const dietaryKeywords = /diet|salt|sugar|gluten|lactose|allerg|intoleran/i;
      if (dietaryKeywords.test(health.label) || dietaryKeywords.test(health.condition)) {
        restrictions.push({
          memberId: member.id,
          memberLabel: member.label,
          source: "health",
          label: health.label,
          severity: health.severity,
        });
      }
    }
  }

  // 3. Member healthTags as additional restrictions
  const members = nodes.filter((n) => n.type === "member") as MemberNode[];
  for (const member of members) {
    if (member.healthTags) {
      for (const tag of member.healthTags) {
        // Avoid duplicates from health nodes
        const alreadyHas = restrictions.some(
          (r) => r.memberId === member.id && r.label === tag,
        );
        if (!alreadyHas) {
          restrictions.push({
            memberId: member.id,
            memberLabel: member.label,
            source: "health",
            label: tag,
          });
        }
      }
    }
  }

  // Build aggregated instruction for food agent
  const instruction = buildFoodInstruction(restrictions);
  const cpNote = buildCpNote(restrictions);

  return { restrictions, instruction, cpNote };
}

function buildFoodInstruction(restrictions: DietaryRestriction[]): string {
  if (restrictions.length === 0) {
    return "No dietary restrictions detected. Order freely!";
  }

  const lines: string[] = [];

  // Group by member
  const byMember = new Map<string, DietaryRestriction[]>();
  for (const r of restrictions) {
    const existing = byMember.get(r.memberLabel) ?? [];
    existing.push(r);
    byMember.set(r.memberLabel, existing);
  }

  for (const [memberLabel, memberRestrictions] of byMember) {
    const parts = memberRestrictions.map((r) => {
      if (r.source === "health") {
        return `${r.label} (health)`;
      }
      return `${r.sentiment ?? "note"}: ${r.label}`;
    });
    lines.push(`${memberLabel}: ${parts.join(", ")}`);
  }

  return `Dietary constraints for this order:\n${lines.join("\n")}\n\nPlease ensure all items comply with the above restrictions.`;
}

function buildCpNote(restrictions: DietaryRestriction[]): string {
  const healthRestrictions = restrictions.filter((r) => r.source === "health");
  const prefRestrictions = restrictions.filter((r) => r.source === "preference" && r.sentiment === "avoids");

  const mustAvoid = [
    ...healthRestrictions.map((r) => r.label),
    ...prefRestrictions.map((r) => r.label),
  ];

  if (mustAvoid.length === 0) {
    return "No hard restrictions — maximize CP\u5024 (best value) freely!";
  }

  return `CP\u5024 Tip: Look for set meals or family combos that satisfy all ${mustAvoid.length} restriction(s): ${mustAvoid.join(", ")}. Shared dishes reduce per-person cost. Prioritize restaurants with clear allergen labeling.`;
}
