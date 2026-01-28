/**
 * Seed script to populate the database with sample focus session data
 * Run with: npm run seed
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env file
config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables!");
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const USER_ID = "default-user";

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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  // Random hour between 6am and 10pm
  date.setHours(randomInt(6, 22), randomInt(0, 59), randomInt(0, 59));
  return date;
}

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data for this user
  console.log("Clearing existing data...");
  await supabase.from("distractions").delete().eq("user_id", USER_ID);
  await supabase.from("session_events").delete().eq("user_id", USER_ID);
  await supabase.from("focus_sessions").delete().eq("user_id", USER_ID);

  const sessions: Array<{
    id?: string;
    user_id: string;
    planned_duration_seconds: number;
    actual_duration_seconds: number;
    status: string;
    started_at: string;
    ended_at: string;
    total_distractions: number;
    total_pauses: number;
  }> = [];

  const distractions: Array<{
    session_id: string;
    user_id: string;
    distraction_type: string;
    time_into_session_seconds: number;
    time_remaining_seconds: number;
    logged_at: string;
  }> = [];

  // Generate sessions for the last 30 days
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    // Some days have 0-4 sessions
    const sessionsToday = randomInt(0, 4);
    
    // Make recent days more likely to have sessions (building a habit)
    const adjustedSessions = daysAgo < 7 ? Math.max(sessionsToday, randomInt(1, 3)) : sessionsToday;

    for (let i = 0; i < adjustedSessions; i++) {
      const plannedDuration = 25 * 60; // 25 minutes
      const isCompleted = Math.random() > 0.25; // 75% completion rate
      
      let actualDuration: number;
      let status: string;
      
      if (isCompleted) {
        actualDuration = plannedDuration;
        status = "completed";
      } else {
        // Abandoned somewhere between 3-20 minutes
        actualDuration = randomInt(3 * 60, 20 * 60);
        status = "abandoned";
      }

      const startedAt = randomDate(daysAgo);
      const endedAt = new Date(startedAt.getTime() + actualDuration * 1000);
      
      // 0-4 distractions per session
      const numDistractions = randomInt(0, 4);
      const numPauses = randomInt(0, 2);

      sessions.push({
        user_id: USER_ID,
        planned_duration_seconds: plannedDuration,
        actual_duration_seconds: actualDuration,
        status,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        total_distractions: numDistractions,
        total_pauses: numPauses,
      });
    }
  }

  console.log(`Creating ${sessions.length} focus sessions...`);

  // Insert sessions and get their IDs
  const { data: insertedSessions, error: sessionsError } = await supabase
    .from("focus_sessions")
    .insert(sessions)
    .select();

  if (sessionsError) {
    console.error("Failed to insert sessions:", sessionsError);
    process.exit(1);
  }

  console.log(`✅ Created ${insertedSessions.length} sessions`);

  // Generate distractions for each session
  for (const session of insertedSessions) {
    const numDistractions = session.total_distractions;
    
    for (let i = 0; i < numDistractions; i++) {
      // Distraction happens somewhere during the session
      const timeIntoSession = randomInt(60, session.actual_duration_seconds - 60);
      const timeRemaining = session.actual_duration_seconds - timeIntoSession;
      
      const loggedAt = new Date(
        new Date(session.started_at).getTime() + timeIntoSession * 1000
      );

      distractions.push({
        session_id: session.id,
        user_id: USER_ID,
        distraction_type: randomChoice(DISTRACTION_TYPES),
        time_into_session_seconds: timeIntoSession,
        time_remaining_seconds: timeRemaining,
        logged_at: loggedAt.toISOString(),
      });
    }
  }

  if (distractions.length > 0) {
    console.log(`Creating ${distractions.length} distractions...`);
    
    const { error: distractionsError } = await supabase
      .from("distractions")
      .insert(distractions);

    if (distractionsError) {
      console.error("Failed to insert distractions:", distractionsError);
      process.exit(1);
    }
    
    console.log(`✅ Created ${distractions.length} distractions`);
  }

  // Generate some session events
  const events: Array<{
    session_id: string;
    user_id: string;
    event_type: string;
    event_data: object;
    timestamp: string;
    context: object;
  }> = [];

  for (const session of insertedSessions) {
    // Session started event
    events.push({
      session_id: session.id,
      user_id: USER_ID,
      event_type: "session_started",
      event_data: { planned_duration_seconds: session.planned_duration_seconds },
      timestamp: session.started_at,
      context: {},
    });

    // Session ended event
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

    // Some page blur/focus events (simulating tab switches)
    if (Math.random() > 0.5) {
      const blurTime = randomInt(60, session.actual_duration_seconds - 120);
      const blurAt = new Date(
        new Date(session.started_at).getTime() + blurTime * 1000
      );
      
      events.push({
        session_id: session.id,
        user_id: USER_ID,
        event_type: "page_blurred",
        event_data: { time_elapsed_seconds: blurTime },
        timestamp: blurAt.toISOString(),
        context: {},
      });

      // Focus back after 5-30 seconds
      const focusDelay = randomInt(5, 30);
      events.push({
        session_id: session.id,
        user_id: USER_ID,
        event_type: "page_focused",
        event_data: { time_elapsed_seconds: blurTime + focusDelay },
        timestamp: new Date(blurAt.getTime() + focusDelay * 1000).toISOString(),
        context: {},
      });
    }
  }

  console.log(`Creating ${events.length} session events...`);

  const { error: eventsError } = await supabase
    .from("session_events")
    .insert(events);

  if (eventsError) {
    console.error("Failed to insert events:", eventsError);
    process.exit(1);
  }

  console.log(`✅ Created ${events.length} events`);

  // Summary
  const completed = insertedSessions.filter((s) => s.status === "completed").length;
  const abandoned = insertedSessions.filter((s) => s.status === "abandoned").length;
  
  console.log("\n📊 Seed Summary:");
  console.log(`   Total sessions: ${insertedSessions.length}`);
  console.log(`   Completed: ${completed} (${Math.round((completed / insertedSessions.length) * 100)}%)`);
  console.log(`   Abandoned: ${abandoned}`);
  console.log(`   Total distractions: ${distractions.length}`);
  console.log(`   Total events: ${events.length}`);
  console.log("\n✨ Done! Check your metrics page.");
}

seed().catch(console.error);
