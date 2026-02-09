/**
 * Evaluation dataset for the Focus Coach.
 * Each item: user message (input) + optional mock "User focus data" (context).
 * The task will send system = COACH_SYSTEM_PROMPT + context, user = input.
 */

export type CoachDatasetItem = {
  input: string;
  /** Mock "User focus data" block so the coach can answer from data without calling tools. */
  context?: string;
  metadata?: {
    category: "general" | "data_specific" | "clarifying";
    description?: string;
  };
};

export const COACH_EVAL_ITEMS: CoachDatasetItem[] = [
  {
    input: "How can I improve my focus?",
    context: undefined,
    metadata: { category: "general", description: "General advice, no user data" },
  },
  {
    input: "What helps with deep work?",
    context: undefined,
    metadata: { category: "general" },
  },
  {
    input: "How did I do this week?",
    context: `Last 7 days: 12 sessions, 312 min focus, 4 distractions.
Completion rate: 82%. Best hour: 9am (4 sessions, 95% completion).`,
    metadata: { category: "data_specific", description: "Asks about their week; context has numbers" },
  },
  {
    input: "When do I focus best?",
    context: `Last 7 days: 8 sessions. By hour: 9am 3 sessions 100% completion, 2pm 2 sessions 50%, 4pm 3 sessions 67%.`,
    metadata: { category: "data_specific" },
  },
  {
    input: "What's my completion rate?",
    context: `Last 7 days: 5 sessions started, 4 completed. Completion rate: 80%.`,
    metadata: { category: "data_specific" },
  },
  {
    input: "Suggest a schedule for me.",
    context: `Last 7 days: 6 sessions, 150 min. Best hour: 10am (2 sessions, 100%). Completion rate: 83%.`,
    metadata: { category: "data_specific" },
  },
  {
    input: "Why am I so distracted?",
    context: `Last 7 days: 3 sessions, 8 distractions. Top type: Phone / social media (4), then Notifications (2).`,
    metadata: { category: "data_specific" },
  },
  {
    input: "Give me my stats for last week.",
    context: undefined,
    metadata: { category: "clarifying", description: "No data in context; coach should ask to clarify or say no data" },
  },
];
