import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { FocusContextBaseline } from "@/lib/agent";

const RECENT_SESSIONS_LIMIT = 7;
const MIN_SESSIONS_FOR_SUGGESTION = 3;
const ABANDONMENT_RATE_THRESHOLD = 0.25; // "low" = at most 25% abandoned
const UPWARD_CAP_PERCENT = 0.1; // +10% max at a time
const UPWARD_STEP_MINUTES = 5;

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function trimmedMean(arr: number[], trimRatio: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const drop = Math.max(0, Math.floor(sorted.length * trimRatio));
  const start = drop;
  const end = sorted.length - drop;
  if (start >= end) return median(sorted);
  const slice = sorted.slice(start, end);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Weights: most recent = 3, next = 2, next = 1, then 1 for the rest (last 3 > last 7). */
function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const weights = values.map((_, i) => (i < 3 ? 3 - i : 1));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const sumV = values.reduce((s, v, i) => s + v * weights[i]!, 0);
  return sumW > 0 ? sumV / sumW : values[0] ?? 0;
}

function roundTo5(n: number): number {
  return Math.max(5, Math.min(120, Math.round(n / 5) * 5));
}

export type SessionSuggestionsResponse = {
  suggestedDurationMinutes: number;
  suggestedBreakMinutes: number;
  reason: string | null;
  /** User's default focus (for "Stick to my default" and comparison). */
  defaultFocusMinutes: number;
  /** Number of sessions used to compute the suggestion (for copy "last N sessions"). */
  sessionCountUsed: number;
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Phase 3: optional segment (e.g. ?segment=deep_work). When focus_sessions have
    // task_type, energy_level, time_of_day, filter by segment and run same rules per baseline.
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get("segment") as FocusContextBaseline | null;

    let query = supabase
      .from("focus_sessions")
      .select("planned_duration_seconds, actual_duration_seconds, status")
      .eq("user_id", user.id)
      .in("status", ["completed", "abandoned"])
      .order("started_at", { ascending: false })
      .limit(RECENT_SESSIONS_LIMIT);
    // TODO Phase 3: when columns exist, e.g. .eq("task_type", segment) or filter by energy_level/time_of_day
    if (segment) {
      // Placeholder: no filter until task_type, energy_level, time_of_day exist on focus_sessions
    }

    const [sessionsRes, prefsRes] = await Promise.all([
      query,
      supabase.from("user_preferences").select("default_focus_minutes, default_break_minutes").eq("user_id", user.id).maybeSingle(),
    ]);

    const sessions = sessionsRes.data ?? [];
    const prefs = prefsRes.data;
    const defaultFocus = prefs?.default_focus_minutes ?? 25;
    const defaultBreak = prefs?.default_break_minutes ?? 5;

    let suggestedDuration = defaultFocus;
    let reason: string | null = null;
    const sessionCountUsed = sessions.length;

    if (sessions.length >= MIN_SESSIONS_FOR_SUGGESTION) {
      const actualMinutes = sessions.map((s) => (s.actual_duration_seconds ?? 0) / 60);
      const plannedMinutes = sessions.map((s) => (s.planned_duration_seconds ?? 0) / 60);

      const medianActual = median(actualMinutes);
      const medianPlanned = median(plannedMinutes);
      const weightedActual = weightedAverage(actualMinutes);
      const effectiveActual = weightedActual; // weighted recent; median used for upward check

      const abandonedCount = sessions.filter((s) => s.status === "abandoned").length;
      const abandonmentRate = sessions.length > 0 ? abandonedCount / sessions.length : 0;
      const lowAbandonment = abandonmentRate <= ABANDONMENT_RATE_THRESHOLD;

      if (medianPlanned > 0) {
        // Downward: median/weighted actual consistently below planned → suggest shorter
        if (effectiveActual < medianPlanned * 0.95) {
          suggestedDuration = roundTo5(effectiveActual);
          if (suggestedDuration < defaultFocus) {
            reason = `Your last ${sessions.length} sessions lost focus after ~${Math.round(effectiveActual)} minutes on average.`;
          }
        }
        // Upward: actual ≥ 100–105% of planned, low abandonment → suggest +5 min, cap +10%
        else if (
          lowAbandonment &&
          medianActual >= medianPlanned * 1.0 &&
          medianActual <= medianPlanned * 1.05
        ) {
          const capped = Math.min(defaultFocus + UPWARD_STEP_MINUTES, Math.round(defaultFocus * (1 + UPWARD_CAP_PERCENT)));
          const rounded = roundTo5(capped);
          if (rounded > defaultFocus) {
            suggestedDuration = rounded;
            reason = `Your last ${sessions.length} sessions completed strongly; try ${suggestedDuration} minutes.`;
          }
        }
      }
    }

    const response: SessionSuggestionsResponse = {
      suggestedDurationMinutes: suggestedDuration,
      suggestedBreakMinutes: defaultBreak,
      reason,
      defaultFocusMinutes: defaultFocus,
      sessionCountUsed,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[agent/session-suggestions]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get suggestions" },
      { status: 500 }
    );
  }
}
