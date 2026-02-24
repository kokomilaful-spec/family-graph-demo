"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generateCoachingScripts,
  type CoachingScript,
  type UserRole,
} from "@/lib/livo/coaching";
import mockData from "@/data/family-mock.json";

interface LivoCoachProps {
  nodeId: string | null;
  viewerRole: UserRole;
  onClose: () => void;
}

// ── Glowing Sphere Canvas ────────────────────────────────────
function LivoSphere({ recalling }: { recalling: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 56;
    const H = 56;
    canvas.width = W * 2; // retina
    canvas.height = H * 2;
    ctx.scale(2, 2);

    const draw = () => {
      tickRef.current++;
      const t = tickRef.current;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const baseR = 14;

      // Pulse amplitude increases when "recalling"
      const pulseAmp = recalling ? 3.5 : 1.2;
      const pulseSpeed = recalling ? 0.08 : 0.03;
      const r = baseR + Math.sin(t * pulseSpeed) * pulseAmp;

      // Outer glow — larger when recalling
      const glowR = recalling ? r + 14 : r + 8;
      const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowR);
      if (recalling) {
        outerGlow.addColorStop(0, "rgba(129,140,248,0.35)");
        outerGlow.addColorStop(0.5, "rgba(99,102,241,0.15)");
        outerGlow.addColorStop(1, "rgba(99,102,241,0)");
      } else {
        outerGlow.addColorStop(0, "rgba(129,140,248,0.2)");
        outerGlow.addColorStop(0.5, "rgba(99,102,241,0.08)");
        outerGlow.addColorStop(1, "rgba(99,102,241,0)");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // Sphere body — gradient
      const bodyGrad = ctx.createRadialGradient(
        cx - r * 0.25, cy - r * 0.3, r * 0.1,
        cx, cy, r
      );
      bodyGrad.addColorStop(0, "rgba(165,180,252,0.95)");
      bodyGrad.addColorStop(0.4, "rgba(99,102,241,0.85)");
      bodyGrad.addColorStop(0.8, "rgba(67,56,202,0.75)");
      bodyGrad.addColorStop(1, "rgba(49,46,129,0.6)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Specular highlight
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.2, cy - r * 0.3, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
      const specGrad = ctx.createRadialGradient(
        cx - r * 0.2, cy - r * 0.3, 0,
        cx - r * 0.2, cy - r * 0.3, r * 0.35
      );
      specGrad.addColorStop(0, "rgba(255,255,255,0.5)");
      specGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = specGrad;
      ctx.fill();

      // Orbiting particles when recalling
      if (recalling) {
        for (let i = 0; i < 6; i++) {
          const angle = (t * 0.04) + (i * Math.PI * 2) / 6;
          const orbitR = r + 6 + Math.sin(t * 0.06 + i) * 2;
          const px = cx + Math.cos(angle) * orbitR;
          const py = cy + Math.sin(angle) * orbitR;
          const pSize = 1.2 + Math.sin(t * 0.1 + i * 1.5) * 0.5;
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(199,210,254,${0.5 + Math.sin(t * 0.08 + i) * 0.3})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [recalling]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[56px] w-[56px] shrink-0"
      style={{ imageRendering: "auto" }}
    />
  );
}

// ── Main Component ───────────────────────────────────────────

export default function LivoCoach({ nodeId, viewerRole, onClose }: LivoCoachProps) {
  const [scripts, setScripts] = useState<CoachingScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [nudgedIdx, setNudgedIdx] = useState<number | null>(null);

  const node = nodeId ? mockData.nodes.find((n) => n.id === nodeId) : null;

  // Find the child who owns this node
  const owner = (() => {
    if (!nodeId) return null;
    const edge = mockData.edges.find(
      (e) =>
        (e.target === nodeId && e.source.startsWith("m-")) ||
        (e.source === nodeId && e.target.startsWith("m-"))
    );
    const ownerId = edge
      ? edge.source.startsWith("m-")
        ? edge.source
        : edge.target
      : null;
    return ownerId ? mockData.nodes.find((n) => n.id === ownerId) : null;
  })();

  const fetchScripts = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setScripts([]);
    setCopiedIdx(null);
    setNudgedIdx(null);
    try {
      const result = await generateCoachingScripts(id, viewerRole);
      setScripts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scripts");
    } finally {
      setLoading(false);
    }
  }, [viewerRole]);

  useEffect(() => {
    if (nodeId) {
      fetchScripts(nodeId);
    } else {
      setScripts([]);
      setError(null);
    }
  }, [nodeId, fetchScripts]);

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  }, []);

  const handleNudge = useCallback((idx: number) => {
    setNudgedIdx(idx);
    setTimeout(() => setNudgedIdx(null), 2500);
  }, []);

  if (!nodeId) return null;

  // Sphere pulses ("recalls") while loading or when scripts are freshly loaded
  const isRecalling = loading;

  const toneColors: Record<string, string> = {
    Gentle: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Direct: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Curious: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Playful: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Warm: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    Calm: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 animate-[slideUp_0.3s_ease-out] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/50"
      style={{
        background: "rgba(15, 15, 22, 0.75)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Livo glowing sphere */}
          <LivoSphere recalling={isRecalling} />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Livo</h3>
            <p className="text-[10px] text-indigo-400/70">Trendlife Curator</p>
            {node && owner && (
              <p className="text-[10px] text-zinc-500">
                Recalling {owner.label}&apos;s memory:{" "}
                <span className="text-red-400">{node.label}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            High Risk
          </span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[420px] overflow-y-auto px-4 py-3">
        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="mb-2 h-4 w-16 rounded-full bg-white/[0.06]" />
                <div className="mb-1.5 h-3 w-full rounded bg-white/[0.04]" />
                <div className="mb-1.5 h-3 w-4/5 rounded bg-white/[0.04]" />
                <div className="h-3 w-3/5 rounded bg-white/[0.04]" />
              </div>
            ))}
            <p className="text-center text-[10px] text-zinc-600">Livo is recalling family memories...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="mb-2 text-xs text-red-400">{error}</p>
            <button
              onClick={() => nodeId && fetchScripts(nodeId)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Scripts */}
        {!loading && !error && scripts.length > 0 && (
          <div className="space-y-3">
            {scripts.map((script, idx) => {
              const colorClass = toneColors[script.tone] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                >
                  {/* Tone badge */}
                  <span className={`mb-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
                    {script.tone}
                  </span>

                  {/* Message */}
                  <p className="mb-2 text-xs leading-relaxed text-zinc-300">
                    &ldquo;{script.message}&rdquo;
                  </p>

                  {/* Follow-up */}
                  <p className="mb-3 text-[10px] italic text-zinc-500">
                    Follow-up: {script.followUp}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(script.message, idx)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleNudge(idx)}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-500/20 hover:text-indigo-300"
                    >
                      {nudgedIdx === idx ? (
                        <>
                          <svg className="h-3 w-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span className="text-indigo-300">Nudge sent!</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                          Send as Livo Nudge
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
