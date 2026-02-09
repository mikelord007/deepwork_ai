/**
 * Wipe all focus data and seed with realistic mock data.
 * Run with: npm run seed
 *
 * Order: delete child tables and derived tables, then focus_sessions;
 * insert sessions → distractions → session_events; optionally refresh derived analytics.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use service role so seed can insert with RLS enabled; fallback to anon for legacy/local
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and key)!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
// For RLS: use a real auth user UUID from Supabase (e.g. sign in once, copy from Auth). For local dev without RLS, default-user still works.
const USER_ID = process.env.SEED_USER_ID ?? "default-user";

const DISTRACTION_TYPES = [
  "Social Media",
  "Email/Slack",
  "Coworker",
  "Phone Call",
  "Hunger/Thirst",
  "Random Thought",
  "News/Articles",
  "Other",
];

// Weights for more realistic distribution (Email/Slack and Random Thought more common)
const DISTRACTION_WEIGHTS = [12, 22, 8, 5, 10, 25, 10, 8];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedDistraction(): string {
  const total = DISTRACTION_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = randomInt(0, total - 1);
  for (let i = 0; i < DISTRACTION_TYPES.length; i++) {
    r -= DISTRACTION_WEIGHTS[i];
    if (r < 0) return DISTRACTION_TYPES[i];
  }
  return DISTRACTION_TYPES[DISTRACTION_TYPES.length - 1];
}

function randomDateInDay(daysAgo: number, hourMin: number, hourMax: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(randomInt(hourMin, hourMax), randomInt(0, 59), 0, 0);
  return date;
}

async function wipe() {
  console.log("Wiping all focus data...");

  // Child tables first (FKs to focus_sessions)
  await supabase.from("distractions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("session_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("focus_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Derived tables
  await supabase.from("coach_memory").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("focus_anomalies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("location_focus_stats").delete().like("user_id", "%");
  await supabase.from("weekly_focus_patterns").delete().like("user_id", "%");
  await supabase.from("daily_focus_stats").delete().like("user_id", "%");

  console.log("Wipe complete.\n");
}

async function seed() {
  console.log("Seeding realistic mock data...\n");

  const LOCATIONS: { label: string; lat: number; lon: number }[] = [
    { label: "Office", lat: 37.784, lon: -122.409 },
    { label: "Cafe", lat: 37.787, lon: -122.398 },
    { label: "Home", lat: 37.771, lon: -122.421 },
    { label: "Other", lat: 37.798, lon: -122.392 },
  ];

  const sessions: Array<{
    user_id: string;
    planned_duration_seconds: number;
    actual_duration_seconds: number;
    status: string;
    started_at: string;
    ended_at: string;
    total_distractions: number;
    total_pauses: number;
    latitude?: number;
    longitude?: number;
    location_label?: string;
  }> = [];

  // Last 50 days; more sessions in recent weeks (habit building)
  const days = 50;
  for (let d = 0; d < days; d++) {
    const isRecent = d < 14;
    const isWeekend = (new Date(Date.now() - d * 86400000).getDay() % 6) < 1;
    let n = isWeekend ? randomInt(0, 2) : randomInt(0, 4);
    if (isRecent && !isWeekend) n = Math.max(n, randomInt(1, 3));

    for (let i = 0; i < n; i++) {
      const plannedDuration = randomChoice([25 * 60, 25 * 60, 25 * 60, 50 * 60]); // mostly 25 min
      const completionChance = isRecent ? 0.8 : 0.7;
      const completed = Math.random() < completionChance;
      const actualDuration = completed
        ? plannedDuration
        : randomInt(4 * 60, Math.floor(plannedDuration * 0.85));
      const startedAt = isWeekend
        ? randomDateInDay(d, 9, 18)
        : randomChoice([
            randomDateInDay(d, 6, 10),
            randomDateInDay(d, 10, 14),
            randomDateInDay(d, 14, 18),
            randomDateInDay(d, 18, 21),
          ]);
      const endedAt = new Date(startedAt.getTime() + actualDuration * 1000);
      const numDistractions = completed ? randomInt(0, 3) : randomInt(0, 5);
      const numPauses = randomInt(0, 2);

      const loc = Math.random() < 0.6 ? randomChoice(LOCATIONS) : null;
      const jitter = () => (Math.random() - 0.5) * 0.01;

      sessions.push({
        user_id: USER_ID,
        planned_duration_seconds: plannedDuration,
        actual_duration_seconds: actualDuration,
        status: completed ? "completed" : "abandoned",
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        total_distractions: numDistractions,
        total_pauses: numPauses,
        ...(loc && {
          latitude: loc.lat + jitter(),
          longitude: loc.lon + jitter(),
          location_label: loc.label,
        }),
      });
    }
  }

  const { data: insertedSessions, error: sessionsError } = await supabase
    .from("focus_sessions")
    .insert(sessions)
    .select();

  if (sessionsError) {
    console.error("Failed to insert sessions:", sessionsError);
    process.exit(1);
  }
  console.log(`Created ${insertedSessions!.length} focus sessions`);

  const distractions: Array<{
    session_id: string;
    user_id: string;
    distraction_type: string;
    time_into_session_seconds: number;
    time_remaining_seconds: number;
    logged_at: string;
  }> = [];

  for (const session of insertedSessions!) {
    for (let i = 0; i < session.total_distractions; i++) {
      const timeInto = randomInt(90, Math.max(90, session.actual_duration_seconds - 120));
      const loggedAt = new Date(new Date(session.started_at).getTime() + timeInto * 1000);
      distractions.push({
        session_id: session.id,
        user_id: USER_ID,
        distraction_type: weightedDistraction(),
        time_into_session_seconds: timeInto,
        time_remaining_seconds: session.actual_duration_seconds - timeInto,
        logged_at: loggedAt.toISOString(),
      });
    }
  }

  if (distractions.length > 0) {
    const { error: distError } = await supabase.from("distractions").insert(distractions);
    if (distError) {
      console.error("Failed to insert distractions:", distError);
      process.exit(1);
    }
    console.log(`Created ${distractions.length} distractions`);
  }

  const events: Array<{
    session_id: string;
    user_id: string;
    event_type: string;
    event_data: object;
    timestamp: string;
    context: object;
  }> = [];

  for (const session of insertedSessions!) {
    events.push({
      session_id: session.id,
      user_id: USER_ID,
      event_type: "session_started",
      event_data: { planned_duration_seconds: session.planned_duration_seconds },
      timestamp: session.started_at,
      context: {},
    });
    events.push({
      session_id: session.id,
      user_id: USER_ID,
      event_type: session.status === "completed" ? "session_completed" : "session_abandoned",
      event_data: {
        actual_duration_seconds: session.actual_duration_seconds,
        distractions_count: session.total_distractions,
      },
      timestamp: session.ended_at,
      context: {},
    });
  }

  const { error: eventsError } = await supabase.from("session_events").insert(events);
  if (eventsError) {
    console.error("Failed to insert session_events:", eventsError);
    process.exit(1);
  }
  console.log(`Created ${events.length} session events`);

  // A few coach_memory entries so get_recent_changes has something to show
  const { error: memoryError } = await supabase.from("coach_memory").insert([
    {
      user_id: USER_ID,
      type: "insight",
      content: "Morning sessions (before 11) have had higher completion rates in the last 2 weeks.",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      user_id: USER_ID,
      type: "experiment",
      content: "Try one 25-min block at 9am with phone in another room and note any distractions.",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ]);
  if (memoryError) console.warn("Coach memory insert (optional):", memoryError.message);
  else console.log("Created 2 coach_memory insights");

  // Refresh derived tables (daily_focus_stats, weekly_focus_patterns, focus_anomalies)
  const { error: refreshError } = await supabase.rpc("refresh_derived_analytics");
  if (refreshError) {
    console.warn("refresh_derived_analytics failed (run cron or run migration first):", refreshError.message);
  } else {
    console.log("Refreshed derived analytics (daily_focus_stats, weekly_focus_patterns, focus_anomalies)");
  }

  const completed = insertedSessions!.filter((s) => s.status === "completed").length;
  console.log("\nSummary:");
  console.log(`  Sessions: ${insertedSessions!.length} (${completed} completed)`);
  console.log(`  Distractions: ${distractions.length}`);
  console.log(`  Events: ${events.length}`);
  console.log("\nDone.");
}

wipe()
  .then(() => seed())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
