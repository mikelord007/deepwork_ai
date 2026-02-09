# Opik evaluation scripts

Run evaluations for the **Focus Coach** and **Weekly Report summary** and log results to Opik.

## Prerequisites

- **OPENROUTER_API_KEY** – same as the app (OpenRouter is used to call the model).
- **OPIK_API_KEY** – from [comet.com/opik](https://www.comet.com/opik). Optional: **OPIK_PROJECT_NAME**, **OPIK_WORKSPACE_NAME**.
- **OPENAI_API_KEY** – required for evaluation: the AnswerRelevance metric uses an LLM-as-judge (default gpt-4o). Set this in `.env` to run the eval scripts.

Load from `.env` in project root (e.g. copy from `.env.local`).

## Commands

From project root:

```bash
# Coach: evaluate answers (baseline = real focus-agent prompt)
npm run eval:coach

# Coach regression: same eval with a weak generic prompt (for before/after demo)
npm run eval:coach:regression

# Weekly summary: evaluate 2–3 sentence takeaways for sample week payloads
npm run eval:weekly
```

Or with tsx directly:

```bash
npx tsx scripts/eval/run-coach-eval.ts
npx tsx scripts/eval/run-weekly-eval.ts
```

## Datasets

- **Coach** – `scripts/eval/datasets/coach.ts`  
  - **deepwork-coach-eval** in Opik: user messages (`input`) and optional mock "User focus data" (`context`). Categories: general advice, data-specific (e.g. "How did I do this week?"), and clarifying (no data).

- **Weekly summary** – `scripts/eval/datasets/weekly-summary.ts`  
  - **deepwork-weekly-summary-eval** in Opik: synthetic weeks (sessions, minutes, distractions, learned, plan) and task description (`input`) for the metric.

On first run, each script creates the dataset in Opik (if it doesn’t exist) and inserts the items from the TS files. Later runs reuse that dataset; re-insert is skipped if the dataset already has items.

## Where to see results

- **Opik dashboard** → **Evaluation** (or **Experiments**): each run creates an experiment (e.g. "Coach Eval 2025-02-09 12:00:00").
- **Observability** → **Traces**: individual LLM calls from the app (coach, weekly report) still appear there; eval runs add traces for each dataset item.

## Metrics

- **Coach** and **Weekly summary** both use **AnswerRelevance** (no reference context): “Does the model’s answer address the input?” Score 0–1; higher is better.
- You can add more metrics in the scripts (e.g. **Contains**, **Hallucination**) and extend the datasets in `scripts/eval/datasets/`.
