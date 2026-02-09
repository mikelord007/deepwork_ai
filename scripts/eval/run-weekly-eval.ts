/**
 * Run Opik evaluation for the Weekly Report summary.
 * Requires: OPENROUTER_API_KEY, OPIK_API_KEY in env (or .env).
 *
 * Usage: npx tsx scripts/eval/run-weekly-eval.ts
 */
import "dotenv/config";
import { evaluate, Opik, AnswerRelevance, type EvaluationTask } from "opik";
import {
  WEEKLY_SUMMARY_EVAL_ITEMS,
  type WeeklySummaryDatasetItem,
} from "./datasets/weekly-summary";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const DATASET_NAME = "deepwork-weekly-summary-eval";

function buildPrompt(params: WeeklySummaryDatasetItem): string {
  const { learned, plan, totalSessions, totalMinutes, totalDistractions } = params;
  return `You are a brief, supportive focus coach. Based on this user's weekly data, write 2–3 short sentences as a personalized takeaway. Be specific and actionable. No bullet points, no greeting.

Data:
- Last 7 days: ${totalSessions} sessions, ${Math.round(totalMinutes)} min focus, ${totalDistractions} distractions.
- Insights: ${learned.join(" ")}
- Next week's plan: ${plan.default_focus_minutes} min sessions, max ${plan.max_sessions_per_day} per day${plan.session_rules?.length ? `, rules: ${plan.session_rules.join(", ")}` : ""}.

Reply with only the 2–3 sentences, nothing else.`;
}

async function callOpenRouter(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text ?? "";
}

const weeklyTask: EvaluationTask<WeeklySummaryDatasetItem> = async (item) => {
  const prompt = buildPrompt(item);
  const output = await callOpenRouter(prompt);
  return { output };
};

async function main() {
  const opik = new Opik();
  const dataset = await opik.getOrCreateDataset<WeeklySummaryDatasetItem>(
    DATASET_NAME,
    "Weekly report summary evaluation"
  );

  const items = await dataset.getItems(1);
  if (!items.length) {
    await dataset.insert(WEEKLY_SUMMARY_EVAL_ITEMS);
    console.log(`Inserted ${WEEKLY_SUMMARY_EVAL_ITEMS.length} items into dataset "${DATASET_NAME}".`);
  }

  console.log("Running weekly summary evaluation (AnswerRelevance)...");
  const result = await evaluate({
    dataset,
    task: weeklyTask,
    scoringMetrics: [new AnswerRelevance({ requireContext: false })],
    experimentName: "Weekly Summary Eval " + new Date().toISOString().slice(0, 19).replace("T", " "),
    projectName: process.env.OPIK_PROJECT_NAME ?? "deepwork-ai",
    scoringKeyMapping: { input: "input", output: "output" },
  });

  // AnswerRelevance with input from "learned" uses the insights as the "question" the summary should address
  console.log("Experiment ID:", result.experimentId);
  console.log("Experiment Name:", result.experimentName);
  console.log("Result URL:", result.resultUrl ?? "(check Opik dashboard)");
  console.log("Test results:", result.testResults.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
