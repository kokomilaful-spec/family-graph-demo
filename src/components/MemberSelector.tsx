"use client";

import type { FamilyGraph as FamilyGraphData, MemberNode } from "@/types/family";
import mockData from "@/data/family-mock.json";

const data = mockData as FamilyGraphData;
const members = data.nodes.filter((n): n is MemberNode => n.type === "member");

interface MemberSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function MemberSelector({ selectedId, onSelect }: MemberSelectorProps) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="px-2 pb-1 text-[13px] font-medium uppercase tracking-widest text-zinc-500">
        Members
      </p>

      {/* "Show All" option */}
      <button
        onClick={() => onSelect(null)}
        className={`rounded-md px-3 py-2 text-left text-basetransition-colors ${
          selectedId === null
            ? "bg-zinc-700/60 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        }`}
      >
        Show All
      </button>

      {members.map((member) => {
        const isActive = selectedId === member.id;
        return (
          <button
            key={member.id}
            onClick={() => onSelect(member.id)}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-basetransition-colors ${
              isActive
                ? "bg-blue-600/20 text-blue-400"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isActive ? "bg-blue-400" : "bg-zinc-600"
              }`}
            />
            <span>{member.label}</span>
            <span className="ml-auto text-sm text-zinc-600">{member.role}</span>
          </button>
        );
      })}
    </div>
  );
}
