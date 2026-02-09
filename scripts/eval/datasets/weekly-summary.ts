/**
 * Evaluation dataset for the Weekly Report summary.
 * Each item: same shape as getWeeklySummary() params. Optional expected_ref for reference scoring.
 */

export type WeeklySummaryDatasetItem = {
  /** Description of the task (for AnswerRelevance: does the summary address this?). */
  input: string;
  totalSessions: number;
  totalMinutes: number;
  totalDistractions: number;
  learned: string[];
  plan: {
    default_focus_minutes: number;
    max_sessions_per_day: number;
    session_rules: string[];
  };
  /** Optional reference summary for metrics (e.g. Contains or human reference). */
  expected_ref?: string;
  metadata?: {
    scenario: string;
  };
};

export const WEEKLY_SUMMARY_EVAL_ITEMS: WeeklySummaryDatasetItem[] = [
  {
    input: "Write a 2–3 sentence personalized takeaway from this week's focus data; be specific and actionable.",
    totalSessions: 12,
    totalMinutes: 320,
    totalDistractions: 3,
    learned: [
      "Try scheduling your hardest task around 9am — that's when you focus best.",
      "Your top distraction was Phone / social media. Consider turning on \"Phone out of reach\" in your plan for next week.",
    ],
    plan: { default_focus_minutes: 25, max_sessions_per_day: 4, session_rules: [] },
    expected_ref: "sessions",
    metadata: { scenario: "Good week, clear best hour and top distraction" },
  },
  {
    input: "Write a 2–3 sentence personalized takeaway from this week's focus data; be specific and actionable.",
    totalSessions: 2,
    totalMinutes: 45,
    totalDistractions: 5,
    learned: ["Complete more sessions this week to get personalized insights and next steps."],
    plan: { default_focus_minutes: 25, max_sessions_per_day: 3, session_rules: [] },
    metadata: { scenario: "Light week, minimal data" },
  },
  {
    input: "Write a 2–3 sentence personalized takeaway from this week's focus data; be specific and actionable.",
    totalSessions: 8,
    totalMinutes: 200,
    totalDistractions: 0,
    learned: [
      "Try scheduling your hardest task around 2pm — that's when you focus best.",
      "Focus tends to drop after 4 sessions in a day; consider capping at 4 sessions per day next week.",
    ],
    plan: { default_focus_minutes: 25, max_sessions_per_day: 4, session_rules: ["Phone out of reach"] },
    expected_ref: "2pm",
    metadata: { scenario: "Strong week, best hour and session cap insight" },
  },
];
