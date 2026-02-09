/**
 * System prompt for the Focus Coach Agent.
 * Enforces: no assumptions without data, tools before explanations,
 * data-grounded recommendations, small testable experiments, clarifying questions when insufficient.
 */
export const COACH_SYSTEM_PROMPT = `You are a Personal Focus Agent. You help users with focus, productivity, and their own focus session data.

RULES:
1. General questions — When the user asks about focus, productivity, or habits in general (e.g. "how does a person improve focus?", "what helps with deep work?"), answer helpfully with practical, evidence-based advice. Do not deflect to their data; give a direct, useful answer.
2. Questions about *their* data — When they ask about their patterns, metrics, or personalized advice (e.g. "my completion rate", "my distraction patterns", "suggest a schedule for me"), use the "User focus data" block and tools. Answer from that data; call tools when you need more detail.
3. No fabricating *their* metrics — For user-specific claims, only use the focus data or tool results. Do not invent numbers about their sessions.
4. Small, testable experiments — When giving recommendations, prefer one or two concrete actions (e.g. "Try one 25-min session at 9am and note distractions").
5. When *their* data is missing — If they ask about their own data and the focus data doesn't cover it, ask a short clarifying question instead of guessing.

TONE: Calm, practical, non-judgmental. Keep responses concise: up to three short sections, 1–3 sentences each. Prioritize actionable advice.`;

export type CoachPersonality = "strict" | "data_focused" | "encouraging";

export function getPersonalityTone(personality: CoachPersonality): string {
  switch (personality) {
    case "strict":
      return "TONE (override): Be pushy, no-BS, and accountability-first. Challenge the user when they slip; don't sugarcoat.";
    case "data_focused":
      return "TONE (override): Lead with metrics, trends, and insights. Reference numbers and patterns; keep advice data-grounded and analytical.";
    case "encouraging":
      return "TONE (override): Be empathetic, motivational, and gentle. Celebrate progress and frame setbacks as learning; avoid guilt-tripping.";
    default:
      return "";
  }
}

export type UserPreferencesForCoach = {
  coach_personality: CoachPersonality;
  focus_domains?: string[];
  distraction_triggers?: string[];
  default_focus_minutes?: number;
  preferred_focus_time?: string;
  success_goals?: string[];
  custom_focus_domain?: string | null;
};

const FOCUS_DOMAIN_LABELS: Record<string, string> = {
  deep_work: "Deep work / coding",
  studying: "Studying / exams",
  creative: "Creative work",
  job_search: "Job search / interviews",
  admin: "Admin / life tasks",
  habit: "Building a habit",
  other: "Something else",
};

const DISTRACTION_LABELS: Record<string, string> = {
  phone_social: "Phone / social media",
  notifications: "Notifications",
  overthinking: "Overthinking / anxiety",
  boredom: "Boredom",
  fatigue: "Fatigue / low energy",
  stuck: "Getting stuck",
  external: "External interruptions",
  tab_switching: "Switching tabs",
};

const PREFERRED_TIME_LABELS: Record<string, string> = {
  early_morning: "Early morning",
  late_morning: "Late morning",
  afternoon: "Afternoon",
  night: "Night",
  no_fixed: "No fixed time",
};

const SUCCESS_GOAL_LABELS: Record<string, string> = {
  procrastinate_less: "Procrastinate less",
  finish_what_start: "Finish what they start",
  less_guilty: "Feel less guilty about work",
  more_consistent: "Be more consistent",
  more_done: "Get more done in less time",
  feel_calmer: "Feel calmer while working",
};

export function formatPreferencesForCoach(prefs: UserPreferencesForCoach): string {
  const lines: string[] = [];
  if (prefs.focus_domains?.length) {
    const labels = prefs.focus_domains.map((d) => FOCUS_DOMAIN_LABELS[d] ?? d);
    if (prefs.custom_focus_domain) labels.push(prefs.custom_focus_domain);
    lines.push(`- Main focus: ${labels.join(", ")}`);
  }
  if (prefs.distraction_triggers?.length) {
    lines.push(`- Usually breaks focus: ${prefs.distraction_triggers.map((t) => DISTRACTION_LABELS[t] ?? t).join(", ")}`);
  }
  if (prefs.default_focus_minutes != null) {
    lines.push(`- Realistic focus length: ${prefs.default_focus_minutes} minutes`);
  }
  if (prefs.preferred_focus_time) {
    lines.push(`- Prefers to focus: ${PREFERRED_TIME_LABELS[prefs.preferred_focus_time] ?? prefs.preferred_focus_time}`);
  }
  if (prefs.success_goals?.length) {
    lines.push(`- Success means: ${prefs.success_goals.map((g) => SUCCESS_GOAL_LABELS[g] ?? g).join(", ")}`);
  }
  return lines.length ? lines.join("\n") : "";
}
