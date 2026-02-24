import { z } from "zod";

export const CommandAction = z.enum([
  "CLEAN",
  "COOK",
  "REMIND",
  "SCHEDULE",
  "BUY",
  "FIX",
  "FIND",
  "OTHER",
]);

export const CommandLocation = z.enum([
  "kitchen",
  "living_room",
  "dining_room",
  "bedroom",
  "bathroom",
  "garage",
  "garden",
  "office",
  "laundry_room",
  "unknown",
]);

export const CommandPriority = z.enum(["low", "medium", "high", "urgent"]);

export const RelevantContextType = z.enum([
  "dietary_preferences",
  "devices",
  "documents",
  "activities",
  "schedules",
  "members",
]);

export const CommandSchema = z.object({
  action: CommandAction,
  location: CommandLocation,
  priority: CommandPriority,
  target_member: z.string().nullable().describe("Family member ID if relevant, e.g. 'm-son'"),
  summary: z.string().describe("One-line human-readable summary of the command"),
  relevant_context: z.array(RelevantContextType).describe(
    "Which types of family graph data are relevant to this command. " +
    "E.g. COOK/BUY → dietary_preferences; CLEAN/FIX → devices; SCHEDULE → members, activities"
  ),
});

export type Command = z.infer<typeof CommandSchema>;
export type RelevantContext = z.infer<typeof RelevantContextType>;
