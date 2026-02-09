"use client";

import { Bot } from "lucide-react";
import { getAgentDisplayName } from "@/lib/agent";
import type { CoachPersonality } from "@/lib/coach-prompts";

interface AgentBadgeProps {
  /** If provided, shows the agent name (e.g. "Alex"). Otherwise "Focus Agent". */
  personality?: CoachPersonality | null;
  /** Compact: icon + name only. Default false adds "your Focus Agent" style. */
  compact?: boolean;
  className?: string;
}

export default function AgentBadge({ personality, compact = false, className = "" }: AgentBadgeProps) {
  const name = getAgentDisplayName(personality ?? undefined);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm text-muted ${className}`}
      aria-label={compact ? `${name} (Focus Agent)` : `From your Focus Agent ${name}`}
    >
      <span
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        aria-hidden
      >
        <Bot className="h-3.5 w-3.5" />
      </span>
      {compact ? (
        <span className="font-medium text-foreground">{name}</span>
      ) : (
        <span>Your Focus Agent{personality ? ` (${name})` : ""}</span>
      )}
    </span>
  );
}
