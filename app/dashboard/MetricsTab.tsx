"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Flame,
  RefreshCw,
  Target,
  TrendingUp,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  getFocusMetrics,
  getDistractionBreakdown,
  getDailyStats,
  getHourlyPatterns,
  getRecentSessions,
  type FocusMetrics,
  type DistractionBreakdown,
  type DailyStats,
  type HourlyPattern,
  type RecentSession,
} from "@/lib/metrics";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function MetricsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<FocusMetrics | null>(null);
  const [distractions, setDistractions] = useState<DistractionBreakdown[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [hourlyPatterns, setHourlyPatterns] = useState<HourlyPattern[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    const [metricsData, distractionsData, dailyData, hourlyData, recentData] =
      await Promise.all([
        getFocusMetrics(),
        getDistractionBreakdown(),
        getDailyStats(7),
        getHourlyPatterns(),
        getRecentSessions(5),
      ]);
    setMetrics(metricsData);
    setDistractions(distractionsData);
    setDailyStats(dailyData);
    setHourlyPatterns(hourlyData);
    setRecentSessions(recentData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12am";
    if (hour === 12) return "12pm";
    return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
  };

  const peakHours = hourlyPatterns
    .filter((h) => h.sessions > 0)
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 3);

  const maxDailyMinutes = Math.max(...dailyStats.map((d) => d.focusMinutes), 1);
  const maxHourlySessions = Math.max(...hourlyPatterns.map((h) => h.sessions), 1);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-[calc(100vh-120px)] md:min-h-screen flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Supabase Not Configured</h2>
        <p className="text-muted">
          Add your Supabase credentials to <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> to view metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-screen flex flex-col justify-center max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Focus Metrics</h2>
          <p className="text-muted mt-1">Track your deep work progress over time</p>
        </div>
        <button onClick={loadData} disabled={isLoading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted">Loading your metrics...</p>
          </div>
        </div>
      ) : metrics && metrics.totalSessions === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">No sessions yet</h3>
          <p className="text-muted">Complete your first focus session in the Focus tab to see metrics here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card !p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted">Total Sessions</span>
              </div>
              <p className="text-3xl font-bold">{metrics?.totalSessions || 0}</p>
            </div>
            <div className="card !p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm text-muted">Completion Rate</span>
              </div>
              <p className="text-3xl font-bold">{metrics?.completionRate.toFixed(0) || 0}%</p>
            </div>
            <div className="card !p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-muted">Total Focus</span>
              </div>
              <p className="text-3xl font-bold">
                {metrics && metrics.totalFocusMinutes >= 60
                  ? `${Math.floor(metrics.totalFocusMinutes / 60)}h ${metrics.totalFocusMinutes % 60}m`
                  : `${metrics?.totalFocusMinutes || 0}m`}
              </p>
            </div>
            <div className="card !p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-muted">Current Streak</span>
              </div>
              <p className="text-3xl font-bold">{metrics?.currentStreak || 0} days</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-muted mb-1">Completed</p>
              <p className="text-xl font-bold text-accent">{metrics?.completedSessions || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-muted mb-1">Abandoned</p>
              <p className="text-xl font-bold text-red-500">{metrics?.abandonedSessions || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-muted mb-1">Avg Session</p>
              <p className="text-xl font-bold">{metrics?.avgSessionMinutes || 0}m</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs text-muted mb-1">Longest Streak</p>
              <p className="text-xl font-bold">{metrics?.longestStreak || 0} days</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Last 7 Days</h3>
              </div>
              <div className="space-y-3">
                {dailyStats.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-muted w-16 flex-shrink-0">
                      {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full flex items-center justify-end px-2 transition-all duration-500"
                        style={{ width: `${Math.max((day.focusMinutes / maxDailyMinutes) * 100, day.focusMinutes > 0 ? 15 : 0)}%` }}
                      >
                        {day.focusMinutes > 0 && (
                          <span className="text-xs text-white font-medium">{day.focusMinutes}m</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted w-12 text-right">
                      {day.completedSessions}/{day.sessions}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold">Distraction Sources</h3>
              </div>
              {distractions.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <p>No distractions logged yet</p>
                  <p className="text-sm mt-1">Keep it up! 🎉</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {distractions.slice(0, 6).map((d) => (
                    <div key={d.type} className="flex items-center gap-3">
                      <span className="text-sm flex-1">{d.type}</span>
                      <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.percentage}%` }} />
                      </div>
                      <span className="text-xs text-muted w-12 text-right">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {metrics && metrics.totalDistractions > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-muted">
                    Avg <span className="font-semibold text-foreground">{metrics.avgDistractionsPerSession}</span> distractions per session
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Focus Patterns by Hour</h3>
              </div>
              {peakHours.length > 0 && (
                <div className="text-sm text-muted">
                  Peak hours: {peakHours.map((h) => formatHour(h.hour)).join(", ")}
                </div>
              )}
            </div>
            <div className="flex items-end gap-1 h-32">
              {hourlyPatterns.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${h.sessions > 0 ? "bg-primary" : "bg-gray-100"}`}
                    style={{
                      height: `${Math.max((h.sessions / maxHourlySessions) * 100, h.sessions > 0 ? 10 : 5)}%`,
                      opacity: h.sessions > 0 ? 0.3 + (h.completionRate / 100) * 0.7 : 0.3,
                    }}
                    title={`${formatHour(h.hour)}: ${h.sessions} sessions, ${h.completionRate}% completed`}
                  />
                  {h.hour % 3 === 0 && <span className="text-[10px] text-muted">{formatHour(h.hour)}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Recent Sessions</h3>
            </div>
            {recentSessions.length === 0 ? (
              <p className="text-muted text-center py-4">No sessions yet</p>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        session.status === "completed" ? "bg-accent-light" : "bg-red-100"
                      }`}
                    >
                      {session.status === "completed" ? (
                        <CheckCircle className="w-5 h-5 text-accent" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {session.status === "completed" ? "Completed" : "Abandoned"} · {session.durationMinutes}m
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
                      </p>
                    </div>
                    {session.distractions > 0 && (
                      <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        {session.distractions} distraction{session.distractions > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
