"use client";

import { useState, useCallback } from "react";
import { parseHouseRule } from "@/lib/agent/rules";
import type { HouseRuleNode, Edge } from "@/types/family";
import mockData from "@/data/family-mock.json";

// Static rule IDs from mock data (cannot be deleted by user)
const STATIC_RULE_IDS = new Set(
  mockData.nodes.filter((n) => n.type === "house_rule").map((n) => n.id)
);

interface RuleEditorProps {
  rules: HouseRuleNode[];
  onAddRule: (node: HouseRuleNode, edges: Edge[]) => void;
  onRemoveRule: (nodeId: string) => void;
}

export default function RuleEditor({ rules, onAddRule, onRemoveRule }: RuleEditorProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || loading) return;

      setLoading(true);
      setError(null);
      try {
        const parsed = await parseHouseRule(trimmed);
        const nodeId = `r-${Date.now()}`;

        const node: HouseRuleNode = {
          id: nodeId,
          type: "house_rule",
          label: parsed.label,
          trigger: parsed.trigger,
          condition: parsed.condition,
          action: parsed.action,
          riskLevel: "low",
          visibility: "family",
        };

        // Link to all device nodes
        const deviceNodes = mockData.nodes.filter((n) => n.type === "device" && !n.id.includes("suspicious"));
        const edges: Edge[] = deviceNodes.map((d, i) => ({
          id: `${nodeId}-e${i}`,
          source: nodeId,
          target: d.id,
          relation: "applies_to" as const,
          label: `Rule applies to ${d.label}`,
        }));

        onAddRule(node, edges);
        setInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse rule");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, onAddRule],
  );

  return (
    <details open className="group border-b border-zinc-800">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] font-semibold uppercase tracking-widest text-zinc-500 select-none hover:text-zinc-300">
        House Rules
        <svg
          className="h-3 w-3 transition-transform group-open:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </summary>
      <div className="px-4 pb-4">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="mb-3 flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. No screens after 9pm"
              disabled={loading}
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-1.5 pl-7 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-amber-500/50 focus:bg-zinc-800/80 disabled:opacity-50"
            />
            {/* Clock icon */}
            <svg
              className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-400 transition-colors hover:bg-amber-500/25 disabled:opacity-30"
          >
            {loading ? (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
          </button>
        </form>

        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}

        {/* Rule list */}
        <div className="flex flex-col gap-1.5">
          {rules.map((rule) => {
            const isStatic = STATIC_RULE_IDS.has(rule.id);
            return (
              <div
                key={rule.id}
                className="group/card rounded-lg border border-amber-500/10 bg-amber-500/[0.03] px-2.5 py-2 transition-colors hover:border-amber-500/20"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <span className="text-[13px] font-medium text-zinc-200">{rule.label}</span>
                  </div>
                  {!isStatic && (
                    <button
                      onClick={() => onRemoveRule(rule.id)}
                      className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 transition-all hover:text-zinc-300 group-hover/card:opacity-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 pl-3.5">
                  <span className="text-xs text-zinc-500">
                    <span className="text-zinc-600">if</span> {rule.condition}
                  </span>
                  <span className="text-xs text-zinc-500">
                    <span className="text-zinc-600">then</span> {rule.action}
                  </span>
                </div>
              </div>
            );
          })}
          {rules.length === 0 && (
            <p className="text-center text-xs text-zinc-600">No rules yet</p>
          )}
        </div>
      </div>
    </details>
  );
}
