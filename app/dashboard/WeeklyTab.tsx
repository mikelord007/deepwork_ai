"use client";

import { useState, useEffect } from "react";
import { Calendar, Check, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AgentCard from "@/app/components/AgentCard";
import { getAgentDisplayName } from "@/lib/agent";
import type { CoachPersonality } from "@/lib/coach-prompts";

type WeeklyReport = {
  learned: string[];
  plan: {
    default_focus_minutes: number;
    default_break_minutes: number;
    max_sessions_per_day: number;
    session_rules: string[];
  };
  summary?: string | null;
};

export default function WeeklyTab() {
  const { userId } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality | null>(null);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<WeeklyReport["plan"] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.coach_personality && ["strict", "data_focused", "encouraging"].includes(data.coach_personality)) {
          setCoachPersonality(data.coach_personality as CoachPersonality);
        }
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      fetch("/api/agent/weekly-report").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/agent/activity-log?page=1&limit=5").then((r) => (r.ok ? r.json() : { entries: [] })),
    ])
      .then(([data, logData]) => {
        if (data) {
          setReport(data);
          setPlan(data.plan);
        }
        const entries = logData?.entries ?? [];
        const alreadyAccepted = entries.some(
          (e: { action_type: string }) => e.action_type === "plan_accepted"
        );
        if (alreadyAccepted) setSaved(true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const acceptPlan = () => {
    const toSave = plan ?? report?.plan;
    if (!userId || !toSave) return;
    fetch("/api/user/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        default_focus_minutes: toSave.default_focus_minutes,
        default_break_minutes: toSave.default_break_minutes,
        max_sessions_per_day: toSave.max_sessions_per_day,
        session_rules: toSave.session_rules,
      }),
    }).then(() => {
      setSaved(true);
      setEditing(false);
      fetch("/api/agent/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "plan_accepted",
          description: "Accepted weekly plan",
          payload: {
            ...toSave,
            why: "Based on your weekly focus report and learned patterns.",
          },
        }),
      }).catch(() => {});
    }).catch(() => {});
  };

  if (loading || !report) {
    return (
      <div className="min-h-[calc(100vh-120px)] md:min-h-screen flex items-center justify-center max-w-2xl mx-auto px-4">
        <div className="agent-glow-border w-full max-w-md rounded-2xl">
          <div className="rounded-[calc(1rem-5px)] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full animate-pulse" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-5/6 animate-pulse" />
              <div className="pt-4 flex justify-center">
                <p className="text-sm text-muted">Loading weekly report…</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-screen max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Agent Report</h1>
          <p className="text-sm text-muted">
            {coachPersonality ? getAgentDisplayName(coachPersonality) : "Focus Agent"} learned from your week
          </p>
        </div>
      </div>

      <AgentCard personality={coachPersonality} className="mb-6">
        {report.summary && (
          <p className="text-sm text-foreground mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            {report.summary}
          </p>
        )}
        <h2 className="font-semibold text-foreground mb-3">Your Focus Agent learned this week</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted mb-6">
          {report.learned.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        <h2 className="font-semibold text-foreground mb-3">Next week&apos;s plan</h2>
        {editing && plan ? (
          <div className="space-y-4 mb-6">
            <label className="block text-sm text-muted">
              Default session length (min)
              <input
                type="number"
                min={5}
                max={120}
                value={plan.default_focus_minutes}
                onChange={(e) => setPlan({ ...plan, default_focus_minutes: Number(e.target.value) || 25 })}
                className="ml-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-foreground w-20"
              />
            </label>
            <label className="block text-sm text-muted">
              Max sessions per day
              <input
                type="number"
                min={1}
                max={20}
                value={plan.max_sessions_per_day}
                onChange={(e) => setPlan({ ...plan, max_sessions_per_day: Number(e.target.value) || 3 })}
                className="ml-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-foreground w-20"
              />
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setPlan({
                  ...plan,
                  session_rules: plan.session_rules.includes("phone_out_of_reach")
                    ? plan.session_rules.filter((r) => r !== "phone_out_of_reach")
                    : [...plan.session_rules, "phone_out_of_reach"],
                })}
                className={`text-sm py-2 px-3 rounded-xl border-2 ${
                  plan.session_rules.includes("phone_out_of_reach") ? "border-primary bg-primary/10" : "border-gray-200 dark:border-gray-700"
                }`}
              >
                Phone out of reach
              </button>
              <button
                type="button"
                onClick={() => setPlan({
                  ...plan,
                  session_rules: plan.session_rules.includes("single_task_only")
                    ? plan.session_rules.filter((r) => r !== "single_task_only")
                    : [...plan.session_rules, "single_task_only"],
                })}
                className={`text-sm py-2 px-3 rounded-xl border-2 ${
                  plan.session_rules.includes("single_task_only") ? "border-primary bg-primary/10" : "border-gray-200 dark:border-gray-700"
                }`}
              >
                Single task only
              </button>
            </div>
          </div>
        ) : (
          <ul className="list-disc list-inside space-y-1 text-sm text-muted mb-6">
            <li>Default sessions: {report.plan.default_focus_minutes} min</li>
            <li>Max {report.plan.max_sessions_per_day} sessions per day</li>
            {report.plan.session_rules?.length > 0 && (
              <li>Rules: {report.plan.session_rules.join(", ").replace(/_/g, " ")}</li>
            )}
          </ul>
        )}

        <div className="flex gap-3 items-center flex-wrap">
          {saved ? (
            <span className="inline-flex items-center gap-2 text-primary font-medium" aria-live="polite">
              <Check className="w-4 h-4 shrink-0" />
              Plan accepted
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={editing ? acceptPlan : () => setEditing(true)}
                className="btn-primary flex items-center gap-2"
              >
                {editing ? <Check className="w-4 h-4" /> : null}
                {editing ? "Save plan" : "Accept plan"}
              </button>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit plan
                </button>
              )}
            </>
          )}
        </div>
      </AgentCard>
    </div>
  );
}
