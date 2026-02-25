"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import mockData from "@/data/family-mock.json";

// ── Schema ───────────────────────────────────────────────────

const CoachingScriptSchema = z.object({
  scripts: z
    .array(
      z.object({
        tone: z
          .string()
          .describe("One-word label for the tone, e.g. Gentle, Direct, Curious"),
        message: z
          .string()
          .describe(
            "A ready-to-use message the caller can send or say to the family member"
          ),
        followUp: z
          .string()
          .describe(
            "A follow-up question to keep the conversation going"
          ),
      })
    )
    .length(3),
});

export type CoachingScript = z.infer<
  typeof CoachingScriptSchema
>["scripts"][number];

// ── Exported types ───────────────────────────────────────────

export type UserRole = "parent" | "child" | "grandparent" | "sibling" | "other";

// ── Server action ────────────────────────────────────────────

export async function generateCoachingScripts(
  nodeId: string,
  userRole: UserRole
): Promise<CoachingScript[]> {
  const node = mockData.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node "${nodeId}" not found`);

  // Only generate coaching scripts for high-risk nodes
  if (node.riskLevel !== "high") {
    throw new Error(
      `Node "${nodeId}" is not high risk — coaching scripts are only generated for high-risk items`
    );
  }

  // Find the family member connected to this node
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

  // Gather connected memory context from the graph
  const connectedMemories = mockData.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const otherId = e.source === nodeId ? e.target : e.source;
      const other = mockData.nodes.find((n) => n.id === otherId);
      return other ? `${other.label} (${e.relation})` : null;
    })
    .filter(Boolean);

  // Tailor the prompt voice based on who is viewing
  const roleContext =
    userRole === "parent"
      ? `The viewer is a parent. Frame scripts as parent-to-child conversations.
         Emphasize safety, trust-building, and open dialogue. Avoid surveillance language.`
      : userRole === "grandparent"
        ? `The viewer is a grandparent. Frame scripts with warmth and generational wisdom.
           Suggest the grandparent facilitate a gentle conversation or loop in the parent.`
        : `The viewer is a ${userRole}. Frame scripts as peer-level conversations.
           Emphasize empathy, shared experience, and mutual respect.`;

  const systemPrompt = `You are TrendLife Companion, a Family Curator dedicated to family "Quality of Life" and "Emotional Harmony".

Your philosophy:
- Safety over surveillance — families protect through understanding, not monitoring.
- Emotional Harmony first — every conversation should strengthen the relationship, not fracture it.
- Memory-informed empathy — use what you know about each person to tailor your tone.

${roleContext}

Context from the Family Memory Graph:
- Concerning item: "${node.label}" (type: ${node.type}, risk: high)
- Family member involved: ${owner ? `${owner.label}, age ${"age" in owner ? owner.age : "unknown"}` : "unknown"}
- Connected memories: ${connectedMemories.join(", ") || "none"}

Generate exactly 3 conversation scripts with DIFFERENT tones.
Each script should be:
- Caring and non-confrontational
- Focused on safety and understanding — never punitive or accusatory
- Age-appropriate for the family member
- 2-4 sentences, written as direct speech the viewer can use
- Informed by the family memory context above

Choose 3 distinctly different approaches (e.g. Gentle, Curious, Warm).`;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: CoachingScriptSchema,
    system: systemPrompt,
    prompt: `Generate 3 empathetic coaching scripts for a ${userRole} to discuss "${node.label}" with ${owner?.label ?? "the family member"}.`,
  });

  return object.scripts;
}
