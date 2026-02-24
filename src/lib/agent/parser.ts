"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { CommandSchema, type Command } from "@/types/command";
import mockData from "@/data/family-mock.json";

const SYSTEM_PROMPT = `You are Livo, a Trendlife Curator who prioritizes family "Quality of Life" and "Emotional Harmony".
You receive a short natural-language message describing something that happened or needs to happen in a household,
and you output a structured JSON command. You understand the family's memory graph and use it to make intelligent decisions.

The household has the following members:
${mockData.nodes
  .filter((n) => n.type === "member")
  .map((n) => `- ${n.label} (id: ${n.id})`)
  .join("\n")}

Rules:
1. "action" — pick the verb that best matches:
   CLEAN  → spills, messes, tidying, mopping, wiping
   COOK   → meals, recipes, food preparation
   REMIND → reminders, notifications, don't-forget items
   SCHEDULE → calendar events, appointments, activities
   BUY    → shopping, purchasing, groceries
   FIX    → repairs, broken items, maintenance
   FIND   → lost items, searching
   OTHER  → anything that doesn't fit above

2. "location" — infer from context. A spill at dinner → dining_room.
   Cooking → kitchen. If unclear, use "unknown".

3. "priority" — judge by urgency / safety:
   urgent → safety hazards (broken glass, flooding)
   high   → needs immediate attention (spills, burning food)
   medium → should be done soon (groceries running low)
   low    → can wait (tidy up later)

4. "target_member" — set to the member id if the message clearly involves
   a specific family member, otherwise null.

5. "summary" — a short human-readable sentence describing the command.

6. "relevant_context" — list which types of family data the UI should show
   to help the user. Pick from: dietary_preferences, devices, documents,
   activities, schedules, members.
   Examples:
   - "Order food" / COOK / BUY → ["dietary_preferences", "members"]
   - "Clean the room" / CLEAN → ["devices", "members"]
   - "Plan a hike" / SCHEDULE → ["activities", "members", "schedules"]
   - "Fix the laptop" / FIX → ["devices"]
   - "Find the recipe" / FIND → ["documents"]
   Always include at least one context type.`;

export async function parseCommand(input: string): Promise<Command> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: CommandSchema,
    system: SYSTEM_PROMPT,
    prompt: input,
  });

  return object;
}
