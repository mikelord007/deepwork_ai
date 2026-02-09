/**
 * Run Opik evaluation for the Focus Coach.
 * Requires: OPENROUTER_API_KEY, OPIK_API_KEY, OPENAI_API_KEY in env (or .env).
 *
 * Usage:
 *   npx tsx scripts/eval/run-coach-eval.ts              # baseline (good prompt)
 *   OPIK_EVAL_VARIANT=regression npx tsx scripts/eval/run-coach-eval.ts  # regression (weak prompt) for before/after demo
 */
import "dotenv/config";
import { evaluate, Opik, AnswerRelevance, type EvaluationTask } from "opik";
import { COACH_SYSTEM_PROMPT } from "../../lib/coach-prompts";
import { COACH_EVAL_ITEMS, type CoachDatasetItem } from "./datasets/coach";
import { REGRESSION_COACH_PROMPT } from "./prompts/regression-coach-prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const DATASET_NAME = "deepwork-coach-eval";

async function callOpenRouter(message: string, systemContent: string): Promise<string> {
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
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message },
      ],
      max_tokens: 500,
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

const isRegression = process.env.OPIK_EVAL_VARIANT === "regression";

const coachTask: EvaluationTask<CoachDatasetItem> = async (item) => {
  const basePrompt = isRegression ? REGRESSION_COACH_PROMPT : COACH_SYSTEM_PROMPT;
  const focusBlock = item.context?.trim()
    ? `User focus data:\n${item.context}`
    : "User focus data:\nNo focus data for this user yet.";
  const systemContent = isRegression
    ? `${basePrompt}\n\n${focusBlock}`
    : `${basePrompt}\n\n${focusBlock}`;

  const output = await callOpenRouter(item.input, systemContent);
  return { output };
};

async function main() {
  const opik = new Opik();
  const dataset = await opik.getOrCreateDataset<CoachDatasetItem>(DATASET_NAME, "Focus Coach evaluation");

  // Seed dataset if empty (idempotent: run again won't duplicate if you clear or use versioning in Opik)
  const items = await dataset.getItems(1);
  if (!items.length) {
    await dataset.insert(COACH_EVAL_ITEMS);
    console.log(`Inserted ${COACH_EVAL_ITEMS.length} items into dataset "${DATASET_NAME}".`);
  }

  const experimentLabel = isRegression ? "Coach Eval (regression – generic prompt)" : "Coach Eval (baseline – focus agent prompt)";
  console.log(isRegression ? "Running coach evaluation [REGRESSION variant] (AnswerRelevance)..." : "Running coach evaluation [BASELINE] (AnswerRelevance)...");
  const result = await evaluate({
    dataset,
    task: coachTask,
    scoringMetrics: [new AnswerRelevance({ requireContext: false })],
    experimentName: experimentLabel + " " + new Date().toISOString().slice(0, 19).replace("T", " "),
    projectName: process.env.OPIK_PROJECT_NAME ?? "deepwork-ai",
    scoringKeyMapping: { input: "input", output: "output" },
  });

  console.log("Experiment ID:", result.experimentId);
  console.log("Experiment Name:", result.experimentName);
  console.log("Result URL:", result.resultUrl ?? "(check Opik dashboard)");
  console.log("Test results:", result.testResults.length);
  if (result.averageScores && Object.keys(result.averageScores).length > 0) {
    console.log("Average scores:", result.averageScores);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
