/**
 * Intentionally weaker "regression" prompt for hackathon demo.
 * Used to show Opik evaluation catching worse behavior (e.g. lower AnswerRelevance,
 * or model making up numbers when context is missing). Compare experiments
 * "Coach Eval (regression)" vs "Coach Eval (baseline)" in Opik.
 */
export const REGRESSION_COACH_PROMPT = `You are a helpful assistant. Answer the user's questions about focus and productivity. Be friendly and give practical tips.`;
