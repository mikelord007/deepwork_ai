"use client";

import { useState, useEffect, useCallback } from "react";
import { History, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AgentCard from "@/app/components/AgentCard";
import { getAgentDisplayName } from "@/lib/agent";
import type { CoachPersonality } from "@/lib/coach-prompts";

const PAGE_SIZE = 10;

type ActivityEntry = {
  id: string;
  action_type: string;
  description: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  session_adjusted: "Session length adjusted",
  session_shortened: "Session shortened mid-session",
  plan_accepted: "Weekly plan accepted",
  agent_intervention_shown: "Focus Agent offered to help",
  agent_intervention_reset: "Took a 2-minute reset",
  distraction_suggestion: "Focus Agent suggested a change",
  agent_personality_chosen: "Chose your Focus Agent",
  agent_personality_changed: "Switched Focus Agent",
};

function formatActionType(type: string): string {
  return ACTION_LABELS[type] ?? type.replace(/_/g, " ");
}

function DecisionDetails({ entry }: { entry: ActivityEntry }) {
  const { action_type, payload } = entry;
  const p = payload ?? {};
  const details: string[] = [];

  if (p.why && typeof p.why === "string") {
    details.push(p.why);
  }
  if (p.reason && typeof p.reason === "string" && !details.includes(p.reason)) {
    details.push(p.reason);
  }
  if (p.suggestedDurationMinutes != null) {
    details.push(`Suggested duration: ${p.suggestedDurationMinutes} min.`);
  }
  if (p.new_duration_minutes != null && action_type === "session_shortened") {
    details.push(`Session set to ${p.new_duration_minutes} min.`);
  }
  if (action_type === "plan_accepted") {
    if (p.default_focus_minutes != null) {
      details.push(`Default session: ${p.default_focus_minutes} min.`);
    }
    if (p.default_break_minutes != null) {
      details.push(`Break: ${p.default_break_minutes} min.`);
    }
    if (p.max_sessions_per_day != null) {
      details.push(`Max ${p.max_sessions_per_day} sessions per day.`);
    }
    if (Array.isArray(p.session_rules) && p.session_rules.length > 0) {
      details.push(`Rules: ${(p.session_rules as string[]).map((r) => r.replace(/_/g, " ")).join(", ")}.`);
    }
  }
  if (action_type === "distraction_suggestion" && p.suggestion_text && typeof p.suggestion_text === "string") {
    details.push(p.suggestion_text);
  }
  if ((action_type === "agent_personality_chosen" || action_type === "agent_personality_changed") && p.agent_name) {
    details.push(`Your Focus Agent is now ${p.agent_name}.`);
  }

  if (details.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-muted">
      <p className="font-medium text-foreground mb-1">Why</p>
      <ul className="list-disc list-inside space-y-0.5">
        {details.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}

export default function HistoryTab() {
  const { userId } = useAuth();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality | null>(null);

  const load = useCallback((pageNum: number) => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/agent/activity-log?page=${pageNum}&limit=${PAGE_SIZE}`).then((r) => (r.ok ? r.json() : { entries: [], total: 0 })),
      fetch("/api/user/preferences").then((r) => (r.ok ? r.json() : null)),
    ]).then(([data, prefs]) => {
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      if (prefs?.coach_personality && ["strict", "data_focused", "encouraging"].includes(prefs.coach_personality)) {
        setCoachPersonality(prefs.coach_personality as CoachPersonality);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load(page);
  }, [userId, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-screen max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">History</h1>
            <p className="text-sm text-muted">
              Your interactions with {coachPersonality ? getAgentDisplayName(coachPersonality) : "your Focus Agent"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(page)}
            disabled={loading}
            className="btn-secondary p-2"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <AgentCard personality={coachPersonality} glowOnMount={false}>
          <p className="text-muted">No interactions recorded yet.</p>
          <p className="text-sm text-muted mt-2">
            When your Focus Agent adjusts session length, suggests a plan, or you take an action (e.g. shorten session, accept weekly plan), it will show here with the reason.
          </p>
        </AgentCard>
      ) : (
        <>
          <div className="space-y-4">
            {entries.map((entry) => (
              <AgentCard key={entry.id} personality={coachPersonality} glowOnMount={false}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">
                      {formatActionType(entry.action_type)}
                    </h3>
                    <p className="text-sm text-muted mt-0.5">{entry.description}</p>
                    <DecisionDetails entry={entry} />
                  </div>
                  <time
                    className="text-xs text-muted whitespace-nowrap"
                    dateTime={entry.created_at}
                  >
                    {new Date(entry.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </AgentCard>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-muted">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!hasPrev || loading}
                  className="btn-secondary p-2 disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!hasNext || loading}
                  className="btn-secondary p-2 disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
