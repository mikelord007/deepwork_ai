/**
 * Run coach evaluation with the regression (weak) prompt for before/after demo.
 * Spawns run-coach-eval.ts with OPIK_EVAL_VARIANT=regression so it works on all platforms.
 *
 * Usage: npm run eval:coach:regression
 */
import "dotenv/config";
import { spawnSync } from "child_process";
import path from "path";

process.env.OPIK_EVAL_VARIANT = "regression";

const scriptPath = path.resolve(process.cwd(), "scripts/eval/run-coach-eval.ts");
const result = spawnSync("npx", ["tsx", scriptPath], {
  env: process.env,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
