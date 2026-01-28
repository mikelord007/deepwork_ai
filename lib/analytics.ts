import { supabase, USER_ID, isSupabaseConfigured } from "./supabase";

// Event types for comprehensive tracking
export type SessionEventType =
  | "session_started"
  | "session_paused"
  | "session_resumed"
  | "session_completed"
  | "session_abandoned"
  | "break_started"
  | "break_completed"
  | "distraction_logged"
  | "distraction_modal_opened"
  | "distraction_modal_closed"
  | "abandon_modal_opened"
  | "abandon_modal_dismissed"
  | "timer_viewed"
  | "page_focused"
  | "page_blurred";

export interface SessionEventData {
  distraction_type?: string;
  time_remaining_seconds?: number;
  time_elapsed_seconds?: number;
  distractions_count?: number;
  planned_duration_seconds?: number;
  actual_duration_seconds?: number;
  completion_percentage?: number;
  [key: string]: unknown;
}

// Create a new focus session
export async function createSession(plannedDurationSeconds: number = 25 * 60) {
  if (!isSupabaseConfigured() || !supabase) {
    console.log("[Analytics] Supabase not configured, skipping session creation");
    return null;
  }

  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      user_id: USER_ID,
      planned_duration_seconds: plannedDurationSeconds,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create session:", error);
    return null;
  }

  // Log the session start event
  await logSessionEvent(data.id, "session_started", {
    planned_duration_seconds: plannedDurationSeconds,
  });

  return data;
}

// Update session status
export async function updateSession(
  sessionId: string,
  updates: {
    status?: "in_progress" | "completed" | "abandoned" | "break";
    ended_at?: string;
    actual_duration_seconds?: number;
    total_distractions?: number;
    total_pauses?: number;
  }
) {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from("focus_sessions")
    .update(updates)
    .eq("id", sessionId);

  if (error) {
    console.error("Failed to update session:", error);
  }
}

// Log a session event with rich metadata
export async function logSessionEvent(
  sessionId: string | null,
  eventType: SessionEventType,
  eventData: SessionEventData = {}
) {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from("session_events").insert({
    session_id: sessionId,
    user_id: USER_ID,
    event_type: eventType,
    event_data: eventData,
    timestamp: new Date().toISOString(),
    // Browser/device context for behavior analysis
    context: {
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      screen_width: typeof window !== "undefined" ? window.innerWidth : null,
      screen_height: typeof window !== "undefined" ? window.innerHeight : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: typeof navigator !== "undefined" ? navigator.language : null,
    },
  });

  if (error) {
    console.error("Failed to log event:", error);
  }
}

// Log a distraction with detailed timing
export async function logDistraction(
  sessionId: string,
  distractionType: string,
  timeElapsedSeconds: number,
  timeRemainingSeconds: number
) {
  if (!isSupabaseConfigured() || !supabase) return;

  // Insert into dedicated distractions table for easy querying
  const { error: distractionError } = await supabase.from("distractions").insert({
    session_id: sessionId,
    user_id: USER_ID,
    distraction_type: distractionType,
    time_into_session_seconds: timeElapsedSeconds,
    time_remaining_seconds: timeRemainingSeconds,
    logged_at: new Date().toISOString(),
  });

  if (distractionError) {
    console.error("Failed to log distraction:", distractionError);
  }

  // Also log as an event for the full event stream
  await logSessionEvent(sessionId, "distraction_logged", {
    distraction_type: distractionType,
    time_elapsed_seconds: timeElapsedSeconds,
    time_remaining_seconds: timeRemainingSeconds,
  });
}

// Track page visibility changes (user switching tabs)
export function trackPageVisibility(
  sessionId: string | null,
  timeElapsedSeconds: number
) {
  if (typeof document === "undefined") return;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      logSessionEvent(sessionId, "page_blurred", {
        time_elapsed_seconds: timeElapsedSeconds,
      });
    } else {
      logSessionEvent(sessionId, "page_focused", {
        time_elapsed_seconds: timeElapsedSeconds,
      });
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

// Log mouse idle time (user not interacting)
export async function logInteractionPattern(
  sessionId: string,
  pattern: {
    idle_periods: number[];
    total_interactions: number;
    avg_time_between_interactions: number;
  }
) {
  await logSessionEvent(sessionId, "timer_viewed", pattern);
}
