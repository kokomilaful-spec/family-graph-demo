"use client";

import type { FamilyGraph as FamilyGraphData, MemberNode, NodeType } from "@/types/family";
import mockData from "@/data/family-mock.json";

const data = mockData as FamilyGraphData;
const members = data.nodes.filter((n): n is MemberNode => n.type === "member");

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  member: "#3b82f6",
  preference: "#f59e0b",
  device: "#8b5cf6",
  document: "#10b981",
  health: "#ef4444",
  house_rule: "#06b6d4",
};

// ─── Collapsible Section ────────────────────────────────────

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-zinc-800">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500 select-none hover:text-zinc-300">
        {title}
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
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

// ─── Slider ─────────────────────────────────────────────────

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-[11px] tabular-nums text-zinc-600">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-blue-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
      />
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}

// ─── Main Component ─────────────────────────────────────────

export interface GraphSettingsState {
  selectedId: string | null;
  viewerId: string;
  showUnconnected: boolean;
  showLeafNodes: boolean;
  visibleTypes: Record<NodeType, boolean>;
  nodeSpacing: number;
  linkLength: number;
  linkForce: number;
  centerForce: number;
}

interface GraphSettingsProps {
  settings: GraphSettingsState;
  onChange: (s: GraphSettingsState) => void;
  onExport?: () => void;
  onImport?: (file: File) => void;
}

export const DEFAULT_SETTINGS: GraphSettingsState = {
  selectedId: null,
  viewerId: "m-dad",
  showUnconnected: true,
  showLeafNodes: true,
  visibleTypes: { member: true, preference: false, device: true, document: true, health: true, house_rule: true },
  nodeSpacing: 50,
  linkLength: 50,
  linkForce: 50,
  centerForce: 50,
};

export default function GraphSettings({ settings, onChange, onExport, onImport }: GraphSettingsProps) {
  const update = (patch: Partial<GraphSettingsState>) =>
    onChange({ ...settings, ...patch });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-semibold text-zinc-200">Graph Settings</span>
      </div>

      {/* Viewing As */}
      <Section title="Viewing As">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Current User</span>
          <select
            value={settings.viewerId}
            onChange={(e) => update({ viewerId: e.target.value })}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-600"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] leading-tight text-zinc-600">
            Controls which private/guarded nodes are visible based on family role
          </p>
        </div>
      </Section>

      {/* Filters */}
      <Section title="Filters">
        <div className="flex flex-col gap-2">
          {/* Member Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-500">Focus Member</span>
            <select
              value={settings.selectedId ?? ""}
              onChange={(e) => update({ selectedId: e.target.value || null })}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-600"
            >
              <option value="">All Members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-1 flex flex-col gap-0.5">
            <Toggle
              label="Show Unconnected"
              checked={settings.showUnconnected}
              onChange={(v) => update({ showUnconnected: v })}
            />
            <Toggle
              label="Show Leaf Nodes"
              checked={settings.showLeafNodes}
              onChange={(v) => update({ showLeafNodes: v })}
            />
          </div>
        </div>
      </Section>

      {/* Groups — node type visibility */}
      <Section title="Groups">
        <div className="flex flex-col gap-1.5">
          {(Object.keys(NODE_TYPE_COLORS) as NodeType[]).map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: NODE_TYPE_COLORS[type] }}
              />
              <span className="capitalize text-zinc-300">{type}</span>
              <input
                type="checkbox"
                checked={settings.visibleTypes[type]}
                onChange={() =>
                  update({
                    visibleTypes: {
                      ...settings.visibleTypes,
                      [type]: !settings.visibleTypes[type],
                    },
                  })
                }
                className="ml-auto accent-blue-500"
              />
            </label>
          ))}
        </div>
      </Section>

      {/* Layout */}
      <Section title="Layout">
        <div className="flex flex-col gap-3">
          <Slider
            label="Node Spacing"
            value={settings.nodeSpacing}
            onChange={(v) => update({ nodeSpacing: v })}
          />
          <Slider
            label="Link Length"
            value={settings.linkLength}
            onChange={(v) => update({ linkLength: v })}
          />
          <Slider
            label="Link Force"
            value={settings.linkForce}
            onChange={(v) => update({ linkForce: v })}
          />
          <Slider
            label="Center Force"
            value={settings.centerForce}
            onChange={(v) => update({ centerForce: v })}
          />
        </div>
      </Section>

      {/* Memory */}
      <Section title="Memory" defaultOpen={false}>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] leading-tight text-zinc-600">
            Export the full family graph as JSON, or import a previously saved snapshot.
          </p>
          <button
            onClick={onExport}
            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
            Export Family Memory
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4m0 0L8 6m4-4v13" />
            </svg>
            Import Family Memory
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onImport) onImport(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Section>
    </div>
  );
}
