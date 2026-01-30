import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Fetches focus data for a user and returns a text summary for the coach LLM.
 * Used server-side only (API route).
 */
export async function getCoachContext(userId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return "No focus data available (Supabase not configured).";

  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [sessionsRes, distractionsRes] = await Promise.all([
    supabase
      .from("focus_sessions")
      .select("id, status, started_at, actual_duration_seconds, total_distractions, planned_duration_seconds")
      .eq("user_id", userId)
      .gte("started_at", startDate)
      .in("status", ["completed", "abandoned"]),
    supabase
      .from("distractions")
      .select("distraction_type")
      .eq("user_id", userId),
  ]);

  const sessions = sessionsRes.data ?? [];
  const distractions = distractionsRes.data ?? [];

  const completed = sessions.filter((s) => s.status === "completed");
  const abandoned = sessions.filter((s) => s.status === "abandoned");
  const totalFocusMinutes = Math.round(
    sessions.reduce((sum, s) => sum + (s.actual_duration_seconds ?? 0), 0) / 60
  );
  const totalDistractions = sessions.reduce((sum, s) => sum + (s.total_distractions ?? 0), 0);
  const completionRate =
    sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0;

  const distractionCounts: Record<string, number> = {};
  distractions.forEach((d) => {
    distractionCounts[d.distraction_type] = (distractionCounts[d.distraction_type] ?? 0) + 1;
  });
  const distractionBreakdown = Object.entries(distractionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const recentSessions = sessions
    .slice(0, 10)
    .map(
      (s) =>
        `${new Date(s.started_at).toISOString().split("T")[0]} ${s.status} ${Math.round((s.actual_duration_seconds ?? 0) / 60)}min, ${s.total_distractions ?? 0} distractions`
    )
    .join("\n");

  return [
    "## User focus data (last 30 days)",
    `- Total sessions (completed or abandoned): ${sessions.length}`,
    `- Completed: ${completed.length}, Abandoned: ${abandoned.length}`,
    `- Completion rate: ${completionRate}%`,
    `- Total focus time: ${totalFocusMinutes} minutes`,
    `- Total distractions logged: ${totalDistractions}`,
    distractionBreakdown ? `- Distractions by type: ${distractionBreakdown}` : "",
    recentSessions ? `- Recent sessions:\n${recentSessions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
