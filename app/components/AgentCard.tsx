"use client";

import { ReactNode, useState, useEffect } from "react";
import AgentBadge from "./AgentBadge";
import type { CoachPersonality } from "@/lib/coach-prompts";

interface AgentCardProps {
  children: ReactNode;
  /** Optional agent name for badge; uses generic "Focus Agent" if not set */
  personality?: CoachPersonality | null;
  /** If true, show compact badge (name only) in header. Default true */
  showBadge?: boolean;
  /** If true, show ambient glow for a few seconds when first seen. Default true */
  glowOnMount?: boolean;
  className?: string;
}

const GLOW_DURATION_MS = 8000;

export default function AgentCard({
  children,
  personality,
  showBadge = true,
  glowOnMount = true,
  className = "",
}: AgentCardProps) {
  const [showGlow, setShowGlow] = useState(glowOnMount);

  useEffect(() => {
    if (!glowOnMount) return;
    const t = setTimeout(() => setShowGlow(false), GLOW_DURATION_MS);
    return () => clearTimeout(t);
  }, [glowOnMount]);

  const cardInner = (
    <>
      {showBadge && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-primary/5 dark:bg-primary/10">
          <AgentBadge personality={personality} compact />
        </div>
      )}
      <div className="p-4">{children}</div>
    </>
  );

  if (!glowOnMount) {
    return (
      <div
        className={`rounded-2xl border-2 border-primary/20 bg-white dark:bg-gray-900 dark:border-primary/30 shadow-card overflow-hidden ${className}`}
        data-agent-card
      >
        {cardInner}
      </div>
    );
  }

  const innerClass = "rounded-[calc(1rem-5px)] border-2 border-primary/20 bg-white dark:bg-gray-900 dark:border-primary/30 overflow-hidden";

  return (
    <div
      className={showGlow ? `agent-glow-border ${className}` : `agent-glow-border-static shadow-card ${className}`}
      data-agent-card-wrapper
    >
      <div className={innerClass} data-agent-card>
        {cardInner}
      </div>
    </div>
  );
}
