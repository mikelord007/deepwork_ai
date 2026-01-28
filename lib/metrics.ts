import { supabase, USER_ID, isSupabaseConfigured } from "./supabase";

export interface FocusMetrics {
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  completionRate: number;
  totalFocusMinutes: number;
  avgSessionMinutes: number;
  totalDistractions: number;
  avgDistractionsPerSession: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DistractionBreakdown {
  type: string;
  count: number;
  percentage: number;
}

export interface DailyStats {
  date: string;
  sessions: number;
  completedSessions: number;
  focusMinutes: number;
  distractions: number;
}

export interface HourlyPattern {
  hour: number;
  sessions: number;
  completionRate: number;
}

export interface RecentSession {
  id: string;
  startedAt: string;
  status: string;
  durationMinutes: number;
  distractions: number;
}

// Fetch overall focus metrics
export async function getFocusMetrics(): Promise<FocusMetrics | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data: sessions, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", USER_ID)
    .in("status", ["completed", "abandoned"]);

  if (error) {
    console.error("Failed to fetch metrics:", error);
    return null;
  }

  if (!sessions || sessions.length === 0) {
    return {
      totalSessions: 0,
      completedSessions: 0,
      abandonedSessions: 0,
      completionRate: 0,
      totalFocusMinutes: 0,
      avgSessionMinutes: 0,
      totalDistractions: 0,
      avgDistractionsPerSession: 0,
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const abandonedSessions = sessions.filter((s) => s.status === "abandoned");
  
  const totalFocusSeconds = sessions.reduce(
    (sum, s) => sum + (s.actual_duration_seconds || 0),
    0
  );
  
  const totalDistractions = sessions.reduce(
    (sum, s) => sum + (s.total_distractions || 0),
    0
  );

  // Calculate streaks (consecutive days with completed sessions)
  const { currentStreak, longestStreak } = calculateStreaks(completedSessions);

  return {
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    abandonedSessions: abandonedSessions.length,
    completionRate: sessions.length > 0 
      ? (completedSessions.length / sessions.length) * 100 
      : 0,
    totalFocusMinutes: Math.round(totalFocusSeconds / 60),
    avgSessionMinutes: sessions.length > 0 
      ? Math.round(totalFocusSeconds / 60 / sessions.length) 
      : 0,
    totalDistractions,
    avgDistractionsPerSession: sessions.length > 0 
      ? Math.round((totalDistractions / sessions.length) * 10) / 10 
      : 0,
    currentStreak,
    longestStreak,
  };
}

// Calculate current and longest streaks
function calculateStreaks(completedSessions: Array<{ started_at: string }>) {
  if (completedSessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique dates with completed sessions
  const dates = [...new Set(
    completedSessions.map((s) => 
      new Date(s.started_at).toISOString().split("T")[0]
    )
  )].sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Check if streak is current (includes today or yesterday)
  const lastSessionDate = dates[dates.length - 1];
  const isStreakActive = lastSessionDate === today || lastSessionDate === yesterday;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);
  currentStreak = isStreakActive ? tempStreak : 0;

  return { currentStreak, longestStreak };
}

// Fetch distraction breakdown
export async function getDistractionBreakdown(): Promise<DistractionBreakdown[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from("distractions")
    .select("distraction_type")
    .eq("user_id", USER_ID);

  if (error || !data) {
    console.error("Failed to fetch distractions:", error);
    return [];
  }

  // Count by type
  const counts: Record<string, number> = {};
  data.forEach((d) => {
    counts[d.distraction_type] = (counts[d.distraction_type] || 0) + 1;
  });

  const total = data.length;
  return Object.entries(counts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// Fetch daily stats for the last N days
export async function getDailyStats(days: number = 7): Promise<DailyStats[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const startDate = new Date(Date.now() - days * 86400000).toISOString();

  const { data: sessions, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", USER_ID)
    .gte("started_at", startDate)
    .in("status", ["completed", "abandoned"]);

  if (error || !sessions) {
    console.error("Failed to fetch daily stats:", error);
    return [];
  }

  // Group by date
  const byDate: Record<string, DailyStats> = {};
  
  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    byDate[date] = {
      date,
      sessions: 0,
      completedSessions: 0,
      focusMinutes: 0,
      distractions: 0,
    };
  }

  sessions.forEach((s) => {
    const date = new Date(s.started_at).toISOString().split("T")[0];
    if (byDate[date]) {
      byDate[date].sessions++;
      if (s.status === "completed") byDate[date].completedSessions++;
      byDate[date].focusMinutes += Math.round((s.actual_duration_seconds || 0) / 60);
      byDate[date].distractions += s.total_distractions || 0;
    }
  });

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// Fetch hourly patterns
export async function getHourlyPatterns(): Promise<HourlyPattern[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data: sessions, error } = await supabase
    .from("focus_sessions")
    .select("started_at, status")
    .eq("user_id", USER_ID)
    .in("status", ["completed", "abandoned"]);

  if (error || !sessions) {
    console.error("Failed to fetch hourly patterns:", error);
    return [];
  }

  // Group by hour
  const byHour: Record<number, { total: number; completed: number }> = {};
  
  for (let h = 0; h < 24; h++) {
    byHour[h] = { total: 0, completed: 0 };
  }

  sessions.forEach((s) => {
    const hour = new Date(s.started_at).getHours();
    byHour[hour].total++;
    if (s.status === "completed") byHour[hour].completed++;
  });

  return Object.entries(byHour).map(([hour, stats]) => ({
    hour: parseInt(hour),
    sessions: stats.total,
    completionRate: stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100) 
      : 0,
  }));
}

// Fetch recent sessions
export async function getRecentSessions(limit: number = 10): Promise<RecentSession[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", USER_ID)
    .in("status", ["completed", "abandoned"])
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("Failed to fetch recent sessions:", error);
    return [];
  }

  return data.map((s) => ({
    id: s.id,
    startedAt: s.started_at,
    status: s.status,
    durationMinutes: Math.round((s.actual_duration_seconds || 0) / 60),
    distractions: s.total_distractions || 0,
  }));
}
