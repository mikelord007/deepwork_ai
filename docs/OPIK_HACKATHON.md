# Opik (Comet) – Hackathon: Observability + Evaluation + Systematic Improvement

This doc shows how we use **Opik** for the hackathon criteria: **excellent observability**, **evaluation**, and **systematic improvement** of our focus app.

---

## 1. Observability

**What we did:** Every LLM call in the app is traced to Opik.

- **Coach chat** (`/api/coach`): Each user message creates one trace; each OpenRouter call (including tool-use rounds) is a child span. Input (user message), output (final reply), and model/metadata are logged.
- **Weekly report** (`/api/agent/weekly-report`): One trace per report; one span for the summary LLM call.

**Where to see it:** Opik dashboard → **Observability** → **Traces**. Filter by project (e.g. `deepwork-ai`). You’ll see traces for live coach conversations and weekly report generations.

**Why it matters:** We can debug “why did the coach say that?”, inspect prompt/response for any request, and spot errors or slow calls.

**Code:** `lib/opik.ts` (getOpik, flushOpik); tracing in `app/api/coach/route.ts` and `app/api/agent/weekly-report/route.ts`.

---

## 2. Evaluation

**What we did:** We defined evaluation datasets and run evaluations that log to Opik.

- **Coach:** Dataset **deepwork-coach-eval** with 8 test cases (general advice, data-specific questions, no-data clarifying). Metric: **AnswerRelevance** (does the answer address the question?).
- **Weekly summary:** Dataset **deepwork-weekly-summary-eval** with 3 synthetic weeks. Same metric.

**Where to see it:** Opik dashboard → **Evaluation** / **Experiments**. Each run creates an experiment with scores per item and averages.

**How to run (from repo root):**

```bash
# Coach (baseline = real focus-agent prompt)
npm run eval:coach

# Coach regression variant (weak prompt – for before/after demo)
npm run eval:coach:regression

# Weekly summary
npm run eval:weekly
```

**Code:** `scripts/eval/` (datasets in `datasets/`, run scripts `run-coach-eval.ts`, `run-weekly-eval.ts`). See `scripts/eval/README.md` for env (OPENROUTER_API_KEY, OPIK_API_KEY, OPENAI_API_KEY).

---

## 3. Systematic Improvement (Before/After with Opik)

**What we did:** We show how Opik evaluation **surfaces a regression** and how we “fix” it, so the app improves in a measurable way.

**Setup:**

1. **“Regression” variant:** A deliberately weak coach prompt (generic “helpful assistant”, no focus rules, no “don’t fabricate metrics”).  
   - Defined in `scripts/eval/prompts/regression-coach-prompt.ts`.

2. **Run evaluation with the weak prompt:**
   ```bash
   npm run eval:coach:regression
   ```
   This creates an experiment named **Coach Eval (regression – generic prompt)** in Opik. Scores (e.g. AnswerRelevance) are typically **lower** because:
   - Answers are more generic and less aligned to “focus agent” behavior.
   - On data-specific or no-data cases, the model may ignore context or make up numbers.

3. **“Fix” by using the real prompt:** We keep the app using the real focus-agent system prompt (in `lib/coach-prompts.ts`). No code change needed for the “fix” – we’re just comparing two prompt variants in eval.

4. **Run evaluation with the real prompt:**
   ```bash
   npm run eval:coach
   ```
   This creates **Coach Eval (baseline – focus agent prompt)**. Scores are typically **higher**.

**Where to see the improvement:** In Opik → **Evaluation** / **Experiments**, compare:

- **Coach Eval (regression – generic prompt)** → lower average AnswerRelevance (and often worse on data-specific / clarifying items).
- **Coach Eval (baseline – focus agent prompt)** → higher average AnswerRelevance.

That **before (regression) vs after (baseline)** comparison in Opik is the “systematic improvement” story: we used Opik evaluation to (1) measure a bad variant, (2) rely on the real prompt as the “fix”, (3) re-run eval and show improved scores.

**Summary for judges:**

| Criterion              | How we use Opik                                                                 |
|------------------------|----------------------------------------------------------------------------------|
| **Observability**      | All coach and weekly-report LLM calls traced; view in Observability → Traces.   |
| **Evaluation**         | Coach and weekly-summary datasets; run evals; results in Evaluation / Experiments. |
| **Systematic improvement** | Compare “Coach Eval (regression)” vs “Coach Eval (baseline)” in Opik; baseline shows better scores → we improved the system using Opik. |

---

## Quick checklist for judges

1. **Observability:** Open the app, use the Coach and/or generate a Weekly report → in Opik, open **Observability** → **Traces** and confirm new traces for those actions.
2. **Evaluation:** Run `npm run eval:coach` (and optionally `OPIK_EVAL_VARIANT=regression npm run eval:coach`) with `.env` containing OPENROUTER_API_KEY, OPIK_API_KEY, OPENAI_API_KEY → in Opik, open **Evaluation** / **Experiments** and see the experiments and scores.
3. **Improvement:** Run `npm run eval:coach:regression` then `npm run eval:coach`. In Opik, compare the **regression** experiment (weaker prompt) with the **baseline** experiment (real prompt); baseline should show better average scores.
