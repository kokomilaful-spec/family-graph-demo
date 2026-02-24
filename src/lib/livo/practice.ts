"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import mockData from "@/data/family-mock.json";
import type { UserRole } from "./coaching";

// ── Schema ───────────────────────────────────────────────────

const PracticeResponseSchema = z.object({
  childReply: z
    .string()
    .describe(
      "A realistic reply from the child — how they would actually respond to this message. " +
        "1-3 sentences. Authentic teen/kid voice, not overly cooperative."
    ),
  feedback: z
    .string()
    .describe(
      "Livo's coaching feedback on the parent's message. " +
        "1-2 sentences. Constructive and specific — highlight what worked " +
        "or what could be improved in tone, phrasing, or approach."
    ),
  rating: z.enum(["great", "good", "needs-work"]).describe(
    "Quick assessment: 'great' if the message is empathetic and effective, " +
      "'good' if it's decent but could improve, " +
      "'needs-work' if it sounds like lecturing, blaming, or surveillance."
  ),
});

export type PracticeResponse = z.infer<typeof PracticeResponseSchema>;

// ── Conversation turn for context ────────────────────────────

export interface PracticeTurn {
  role: "parent" | "child";
  text: string;
}

// ── Server action ────────────────────────────────────────────

// ── Elder practice response schema ──────────────────────────

const ElderPracticeResponseSchema = z.object({
  childReply: z
    .string()
    .describe(
      "A realistic reply from the elder (grandparent) — how they would actually respond. " +
        "1-3 sentences. Authentic elderly voice. They may be proud, defensive, or dismissive " +
        "depending on whether the message shows respect or control."
    ),
  feedback: z
    .string()
    .describe(
      "Livo's coaching feedback on the parent's message. " +
        "1-2 sentences. Focus on the respect-vs-control spectrum: " +
        "Did it treat the elder as an expert or as a problem? " +
        "Specific, constructive, Respect & Honor framework."
    ),
  rating: z.enum(["great", "good", "needs-work"]).describe(
    "Quick assessment: 'great' if the message shows genuine respect and positions the elder as expert, " +
      "'good' if it's okay but slightly controlling, " +
      "'needs-work' if it sounds patronizing, controlling, or dismissive of the elder's autonomy."
  ),
});

export type ElderPracticeResponse = z.infer<typeof ElderPracticeResponseSchema>;

// ── Conversation turn for elder context ─────────────────────

export interface ElderPracticeTurn {
  role: "parent" | "elder";
  text: string;
}

// ── Offline fallback for Grandma practice ───────────────────

const GRANDMA_PRACTICE_REPLIES: { elderReply: string; feedback: string; rating: PracticeResponse["rating"] }[] = [
  {
    elderReply: "Hmm, you want to learn about gold? That's good. When I was young, gold was the safest investment. This fund promises good returns.",
    feedback: "Good start — you positioned yourself as the learner. Try adding more curiosity about the specific firm's credentials to naturally guide due diligence.",
    rating: "good",
  },
  {
    elderReply: "I appreciate you asking. But I've been managing money longer than you've been alive. I know what I'm doing.",
    feedback: "The elder felt slightly controlled. Try more respect, less control — ask her to teach you rather than questioning her judgment.",
    rating: "needs-work",
  },
  {
    elderReply: "Actually, that's a good idea. Let's look at the paperwork together. I noticed some things I wasn't sure about too.",
    feedback: "Excellent! Your respectful approach made her feel safe to share her own doubts. This is the Respect & Honor framework working perfectly.",
    rating: "great",
  },
  {
    elderReply: "You're right, we should check the credentials. Maybe you can help me look up if this firm is registered?",
    feedback: "She's inviting you in. Your curiosity-based approach turned this into a collaborative investigation. Keep this tone.",
    rating: "great",
  },
  {
    elderReply: "Why are you asking about my finances? I can handle my own money.",
    feedback: "Try more respect, less control. Instead of asking about 'her finances,' ask her to teach you about gold investing. Position her as the expert.",
    rating: "needs-work",
  },
];

/**
 * Practice conversations with an elder family member (Grandma).
 * Uses Respect & Honor framework: coach the parent to show
 * deference and curiosity, not control or intervention.
 *
 * Falls back to offline replies when the AI API is unavailable.
 */
export async function practiceWithGrandma(
  nodeId: string,
  elderId: string,
  parentMessage: string,
  history: ElderPracticeTurn[],
  practiceIndex: number,
): Promise<PracticeResponse> {
  const node = mockData.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node "${nodeId}" not found`);

  const elder = mockData.nodes.find((n) => n.id === elderId);
  const elderName = elder?.label ?? "Grandma";
  const elderAge = elder && "age" in elder ? elder.age : "unknown";

  // Gather elder's memory context
  const memories = mockData.edges
    .filter((e) => e.source === elderId || e.target === elderId)
    .map((e) => {
      const otherId = e.source === elderId ? e.target : e.source;
      const other = mockData.nodes.find((n) => n.id === otherId);
      return other ? `${other.label} (${e.relation})` : null;
    })
    .filter(Boolean);

  // Format conversation history
  const historyText = history.length > 0
    ? history
        .map((t) =>
          t.role === "parent"
            ? `Parent: "${t.text}"`
            : `${elderName}: "${t.text}"`
        )
        .join("\n")
    : "(This is the opening message — no prior exchanges.)";

  try {
    const systemPrompt = `You are Livo, a Trendlife Curator using the Respect & Honor framework. You have TWO jobs:

JOB 1 — ROLE-PLAY as ${elderName} (age ${elderAge}).
Respond to the parent's message AS ${elderName} would realistically respond.
- ${elderName} is a proud, experienced elder. She has decades of life wisdom.
- If the message shows genuine respect and curiosity, she opens up and shares.
- If the message sounds controlling or patronizing, she gets defensive or dismissive.
- If the message positions her as the expert, she feels valued and becomes collaborative.
- 1-3 sentences, authentic elderly voice.

JOB 2 — COACH the parent on the Respect & Honor spectrum.
After generating ${elderName}'s reply, provide coaching feedback:
- Did the parent treat ${elderName} as an expert or as a problem?
- Did it show curiosity ("teach me") or control ("you shouldn't")?
- Key phrase: "Try more respect, less control" when needed.
- Suggest a specific improvement. Be honest but kind.
- 1-2 sentences.

Context from the Family Memory Graph:
- Topic: "${node.label}" (risk: ${node.riskLevel})
- Elder: ${elderName}, age ${elderAge}
- ${elderName}'s world: ${memories.join(", ") || "no additional context"}

Conversation so far:
${historyText}

The parent's new message: "${parentMessage}"`;

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: ElderPracticeResponseSchema,
      system: systemPrompt,
      prompt: `The parent says to ${elderName}: "${parentMessage}"`,
    });

    return {
      childReply: object.childReply,
      feedback: object.feedback,
      rating: object.rating,
    };
  } catch {
    // Offline fallback
    const fallback = GRANDMA_PRACTICE_REPLIES[practiceIndex % GRANDMA_PRACTICE_REPLIES.length];
    return {
      childReply: fallback.elderReply,
      feedback: fallback.feedback,
      rating: fallback.rating,
    };
  }
}

// ── Child practice server action ────────────────────────────

export async function practiceWithLivo(
  nodeId: string,
  userRole: UserRole,
  parentMessage: string,
  history: PracticeTurn[]
): Promise<PracticeResponse> {
  const node = mockData.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node "${nodeId}" not found`);

  // Find the child connected to this node
  const ownerEdge = mockData.edges.find(
    (e) =>
      (e.target === nodeId && e.source.startsWith("m-")) ||
      (e.source === nodeId && e.target.startsWith("m-"))
  );
  const ownerId = ownerEdge
    ? ownerEdge.source.startsWith("m-")
      ? ownerEdge.source
      : ownerEdge.target
    : null;
  const owner = ownerId
    ? mockData.nodes.find((n) => n.id === ownerId)
    : null;

  const childName = owner?.label ?? "the child";
  const childAge = owner && "age" in owner ? owner.age : "unknown";

  // Gather memory context
  const memories = mockData.edges
    .filter((e) => e.source === ownerId || e.target === ownerId)
    .map((e) => {
      const otherId = e.source === ownerId ? e.target : e.source;
      const other = mockData.nodes.find((n) => n.id === otherId);
      return other ? `${other.label} (${e.relation})` : null;
    })
    .filter(Boolean);

  // Format conversation history
  const historyText = history.length > 0
    ? history
        .map((t) =>
          t.role === "parent"
            ? `${userRole.charAt(0).toUpperCase() + userRole.slice(1)}: "${t.text}"`
            : `${childName}: "${t.text}"`
        )
        .join("\n")
    : "(This is the opening message — no prior exchanges.)";

  const systemPrompt = `You are Livo, a Trendlife Curator. You have TWO jobs in this interaction:

JOB 1 — ROLE-PLAY as ${childName} (age ${childAge}).
Respond to the ${userRole}'s message AS ${childName} would realistically respond.
- Use age-appropriate language and emotional reactions for a ${childAge}-year-old.
- Be authentic — not overly cooperative or unrealistically mature.
- If the message sounds like a lecture, the child might get defensive or shut down.
- If the message is warm and curious, the child might open up gradually.
- 1-3 sentences, natural voice.

JOB 2 — COACH the ${userRole}.
After generating ${childName}'s reply, provide brief coaching feedback on the ${userRole}'s message:
- Was it empathetic or did it sound like surveillance/lecturing?
- Did it focus on safety and concern or on rules and punishment?
- Suggest a specific improvement if needed. Be honest but kind.
- 1-2 sentences.

Context from the Family Memory Graph:
- Topic: "${node.label}" (risk: ${node.riskLevel})
- Child: ${childName}, age ${childAge}
- ${childName}'s world: ${memories.join(", ") || "no additional context"}

Conversation so far:
${historyText}

The ${userRole}'s new message: "${parentMessage}"`;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: PracticeResponseSchema,
    system: systemPrompt,
    prompt: `The ${userRole} says to ${childName}: "${parentMessage}"`,
  });

  return object;
}
