"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "family-graph-onboarding-done";

interface TourStep {
  target: string; // CSS selector or position description
  title: string;
  message: string;
  position: { top: string; left: string };
  arrowDir: "left" | "right" | "down" | "up";
}

const STEPS: TourStep[] = [
  {
    target: "graph",
    title: "Family Knowledge Graph",
    message:
      "This is your family's connected world — members, preferences, devices, and rules visualized as nodes.",
    position: { top: "40%", left: "38%" },
    arrowDir: "left",
  },
  {
    target: "viewer",
    title: "Switch Family Members",
    message:
      "Change who you're viewing as. This controls which private nodes are visible based on family privacy settings.",
    position: { top: "80px", left: "200px" },
    arrowDir: "left",
  },
  {
    target: "insights",
    title: "Safety Alerts & Insights",
    message:
      "Safety alerts, celebrations, and AI coaching appear here. Click any alert to open TrendLife Companion's coaching chat.",
    position: { top: "45%", left: "calc(100% - 340px)" },
    arrowDir: "right",
  },
  {
    target: "command",
    title: "Ask TrendLife Anything",
    message:
      'Use the command bar to run family commands — try "What should we cook tonight?" or "Plan a family outing".',
    position: { top: "calc(100% - 140px)", left: "calc(100% - 340px)" },
    arrowDir: "right",
  },
];

export default function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      // Delay to let the app render first
      const t = setTimeout(() => setStep(0), 1200);
      return () => clearTimeout(t);
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (step === null) return null;

  const current = STEPS[step];
  if (!current) return null;

  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setStep(null);
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    setStep(null);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const arrowClass = {
    left: "before:absolute before:top-1/2 before:-left-1.5 before:-translate-y-1/2 before:border-y-[6px] before:border-r-[6px] before:border-y-transparent before:border-r-[rgba(30,30,45,0.95)]",
    right:
      "before:absolute before:top-1/2 before:-right-1.5 before:-translate-y-1/2 before:border-y-[6px] before:border-l-[6px] before:border-y-transparent before:border-l-[rgba(30,30,45,0.95)]",
    down: "before:absolute before:-bottom-1.5 before:left-1/2 before:-translate-x-1/2 before:border-x-[6px] before:border-t-[6px] before:border-x-transparent before:border-t-[rgba(30,30,45,0.95)]",
    up: "before:absolute before:-top-1.5 before:left-1/2 before:-translate-x-1/2 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-[rgba(30,30,45,0.95)]",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <div
        className={`fixed z-[101] w-72 rounded-xl border border-indigo-500/20 bg-[rgba(30,30,45,0.95)] px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl ${arrowClass[current.arrowDir]}`}
        style={{
          top: current.position.top,
          left: current.position.left,
          animation: "slideUp 0.25s ease-out",
        }}
      >
        {/* Step indicator */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400/70">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-3 rounded-full transition-colors ${
                  i === step
                    ? "bg-indigo-400"
                    : i < step
                      ? "bg-indigo-400/30"
                      : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>

        <h4 className="mb-1 text-base font-semibold text-zinc-100">
          {current.title}
        </h4>
        <p className="mb-3 text-[13px] leading-relaxed text-zinc-400">
          {current.message}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-[13px] font-medium text-indigo-400 transition-colors hover:bg-indigo-500/25"
          >
            {isLast ? "Got it!" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
