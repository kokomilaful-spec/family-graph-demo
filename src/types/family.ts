// ─── Shared Fields ──────────────────────────────────────────

export type NodeType = "member" | "preference" | "device" | "document" | "house_rule" | "health";
export type RiskLevel = "low" | "medium" | "high";
export type Visibility = "private" | "family" | "guarded" | "health_only";

export interface BaseNode {
  id: string;
  type: NodeType;
  label: string;
  riskLevel?: RiskLevel;
  visibility?: Visibility;
  isAchievement?: boolean;
}

// ─── Node Types ─────────────────────────────────────────────

export interface MemberNode extends BaseNode {
  type: "member";
  role: "parent" | "child" | "grandparent" | "sibling" | "caregiver" | "other";
  gender?: "male" | "female";
  age?: number;
  healthTags?: string[];
  adminLevel?: "primary" | "secondary";
}

export interface PreferenceNode extends BaseNode {
  type: "preference";
  category: "food" | "activity" | "other";
  sentiment: "likes" | "dislikes" | "avoids" | "loves";
}

export interface DeviceNode extends BaseNode {
  type: "device";
  platform: string;
  os?: string;
}

export interface DocumentNode extends BaseNode {
  type: "document";
  docType: "recipe" | "schedule" | "note" | "list" | "project" | "financial";
  url?: string;
}

export interface HealthNode extends BaseNode {
  type: "health";
  condition: string;
  severity?: "low" | "moderate" | "critical";
}

export interface HouseRuleNode extends BaseNode {
  type: "house_rule";
  trigger: string;
  condition: string;
  action: string;
}

export type FamilyNode =
  | MemberNode
  | PreferenceNode
  | DeviceNode
  | DocumentNode
  | HealthNode
  | HouseRuleNode;

// ─── Edge Types ─────────────────────────────────────────────

export type EdgeRelation =
  | "parent_of"
  | "child_of"
  | "spouse_of"
  | "sibling_of"
  | "grandparent_of"
  | "has_preference"
  | "has_health_condition"
  | "caregiver_of"
  | "owns_device"
  | "authored"
  | "related_to"
  | "installed_on"
  | "created_by"
  | "applies_to";

export interface Edge {
  id: string;
  source: string; // Node id
  target: string; // Node id
  relation: EdgeRelation;
  label?: string;
  weight?: number; // interaction frequency 1-5 (higher = more frequent)
}

// ─── Synapse Events ─────────────────────────────────────────

export type SynapseImpact = "Positive" | "Negative" | "Neutral";

export interface SynapseEvent {
  id: string;
  description: string;
  impact: SynapseImpact;
  intensity: 1 | 2 | 3 | 4 | 5;
  involvedMembers: string[]; // Member node ids
  timestamp?: string;
}

// ─── Graph ──────────────────────────────────────────────────

export interface FamilyGraph {
  nodes: FamilyNode[];
  edges: Edge[];
  synapseEvents?: SynapseEvent[];
}
