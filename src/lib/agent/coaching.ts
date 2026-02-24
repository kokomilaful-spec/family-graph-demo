"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import mockData from "@/data/family-mock.json";

const CoachingScriptSchema = z.object({
  scripts: z.array(
    z.object({
      tone: z.string().describe("One-word label for the tone, e.g. Gentle, Direct, Curious"),
      message: z.string().describe("A ready-to-use message template the parent can send or say to the child"),
      followUp: z.string().describe("A follow-up question the parent can ask to keep the conversation going"),
    })
  ).length(3),
});

export type CoachingScript = z.infer<typeof CoachingScriptSchema>["scripts"][number];

export async function generateCoachingScripts(nodeId: string): Promise<CoachingScript[]> {
  const node = mockData.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node "${nodeId}" not found`);

  // Find the child who owns this node
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

  // Gather context about connected nodes
  const connectedLabels = mockData.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const otherId = e.source === nodeId ? e.target : e.source;
      const other = mockData.nodes.find((n) => n.id === otherId);
      return other ? `${other.label} (${e.relation})` : null;
    })
    .filter(Boolean);

  const systemPrompt = `You are Livo, a Trendlife Curator who prioritizes family "Quality of Life" and "Emotional Harmony".
You help parents navigate sensitive conversations with their children by recalling context from the family's memory graph.
Your coaching scripts should feel warm, wise, and emotionally intelligent — like a trusted family counselor
who deeply understands each family member's personality, preferences, and history.

Context from Family Memory Graph:
- Concerning item: "${node.label}" (type: ${node.type}, risk: ${"riskLevel" in node ? node.riskLevel : "unknown"})
- Child: ${owner ? `${owner.label}, age ${"age" in owner ? owner.age : "unknown"}` : "unknown child"}
- Connected memories: ${connectedLabels.join(", ") || "nothing"}

Generate exactly 3 messaging templates with DIFFERENT tones. Each message should be:
- Age-appropriate for the child
- Non-confrontational and empathetic
- Focused on safety, understanding, and emotional harmony — not punishment
- Written as if the parent is speaking directly to the child
- 2-4 sentences long
- Informed by the family's memory graph context

The three tones should be distinctly different approaches (e.g. gentle/curious, direct/clear, playful/light).`;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: CoachingScriptSchema,
    system: systemPrompt,
    prompt: `Generate 3 coaching scripts for a parent to discuss "${node.label}" with their child.`,
  });

  return object.scripts;
}
