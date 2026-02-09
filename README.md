# deepwork.ai – data-driven focus coach

Landing page for **deepwork.ai**, an AI focus coach that understands how your mind works, finds what builds or destroys your focus, and coaches you with data over time.

## Tech stack

- **Next.js 15** (App Router, TypeScript)
- **React 18**
- **Tailwind CSS 3**
- **lucide-react** for icons

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn
   ```

2. **Run the dev server**

   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

## Project structure

- `app/layout.tsx` – root layout and metadata
- `app/page.tsx` – main marketing / landing page for deepwork.ai
- `app/globals.css` – Tailwind and global styles
- `tailwind.config.ts` – Tailwind theming (colors, shadows, etc.)

## Opik (Comet) – Hackathon

We use **Opik** for observability (LLM traces), evaluation (coach + weekly summary datasets), and systematic improvement (before/after eval with a regression prompt). See **[docs/OPIK_HACKATHON.md](docs/OPIK_HACKATHON.md)** for the full narrative and judge checklist.

## AI Coach architecture

The Focus Coach is a **tool-calling agent** (OpenRouter + Gemini 2.5 Flash). It does not receive raw DB dumps: it gets data only by calling Supabase RPCs when the model selects a tool.

- **Derived analytics** (`daily_focus_stats`, `weekly_focus_patterns`, `focus_anomalies`, `coach_memory`) are populated from existing tables; a **cron-triggered** API route (`/api/cron/refresh-analytics`) calls `refresh_derived_analytics()` so derived tables stay up to date.
- **Tools**: `get_focus_trends`, `get_best_focus_windows`, `get_distraction_patterns`, `get_recent_changes` (read), and `log_coach_insight` (write to `coach_memory`). The route runs the tool loop: LLM chooses tools → server executes them → results are fed back → final reply is streamed/returned.

Run the SQL in `supabase/migrations/` (or `supabase-schema.sql`) in your Supabase project so the tables and RPCs exist. Set `CRON_SECRET` in Vercel if you use the cron job.

## Future improvements (TODOs)

- **Auth** — Replace `USER_ID` fallback with real auth; add per-user RLS on focus/coach tables.
- **Coach memory** — Pruning or retention policy for `coach_memory` (e.g. cap per user or TTL).
- **Evals** — Quality checks or evals for coach responses (groundedness, tone).
- **Streaming** — Optionally stream the final assistant reply for better perceived latency.

## Customization

- Update copy in `app/page.tsx` to match your exact positioning, pricing, and CTAs.
- Wire the primary buttons (e.g. “Get early access”, “Join waitlist”) to your preferred form tool or backend.
- Adjust theme colors in `tailwind.config.ts` if you want a different visual identity.


