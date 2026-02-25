"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import mockData from "@/data/family-mock.json";

const HouseRuleSchema = z.object({
  label: z.string().describe("Short, human-readable name for the rule (5 words max)"),
  trigger: z.string().describe("What initiates this rule, e.g. 'time', 'location', 'event', 'behavior'"),
  condition: z.string().describe("When the rule applies, e.g. 'after 9:00 PM', 'on weekdays', 'during meals'"),
  action: z.string().describe("What should happen, e.g. 'disable device access', 'send reminder', 'lock apps'"),
});

export type ParsedHouseRule = z.infer<typeof HouseRuleSchema>;

const devices = mockData.nodes
  .filter((n) => n.type === "device")
  .map((n) => `- ${n.label} (id: ${n.id})`)
  .join("\n");

const members = mockData.nodes
  .filter((n) => n.type === "member")
  .map((n) => `- ${n.label} (id: ${n.id})`)
  .join("\n");

const SYSTEM_PROMPT = `You are TrendLife Companion, a Family Curator who manages family "Quality of Life" and "Emotional Harmony".
You receive a natural-language description of a household rule and output a structured JSON object.

The household has these members:
${members}

Available devices:
${devices}

Parse the input into:
1. "label" — a short name for the rule (5 words max, title case)
2. "trigger" — what initiates this rule. Pick one: time, location, event, behavior, schedule
3. "condition" — a concise description of WHEN the rule applies (e.g. "after 9:00 PM", "on school nights", "during dinner")
4. "action" — what should happen when the rule is triggered (e.g. "disable device access", "send reminder notification", "lock entertainment apps")

Examples:
- "No screens after bedtime" → { label: "Screen-Free Bedtime", trigger: "time", condition: "after 9:00 PM", action: "disable device access" }
- "Homework before gaming" → { label: "Homework First", trigger: "behavior", condition: "before gaming starts", action: "require homework completion" }`;

export async function parseHouseRule(input: string): Promise<ParsedHouseRule> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: HouseRuleSchema,
    system: SYSTEM_PROMPT,
    prompt: input,
  });

  return object;
}
