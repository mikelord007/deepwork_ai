import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOpik, flushOpik } from "@/lib/opik";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function getWeeklySummary(params: {
  learned: string[];
  plan: { default_focus_minutes: number; max_sessions_per_day: number; session_rules: string[] };
  totalSessions: number;
  totalMinutes: number;
  totalDistractions: number;
}): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const { learned, plan, totalSessions, totalMinutes, totalDistractions } = params;
  const prompt = `You are a brief, supportive focus coach. Based on this user's weekly data, write 2–3 short sentences as a personalized takeaway. Be specific and actionable. No bullet points, no greeting.

Data:
- Last 7 days: ${totalSessions} sessions, ${Math.round(totalMinutes)} min focus, ${totalDistractions} distractions.
- Insights: ${learned.join(" ")}
- Next week's plan: ${plan.default_focus_minutes} min sessions, max ${plan.max_sessions_per_day} per day${plan.session_rules?.length ? `, rules: ${plan.session_rules.join(", ")}` : ""}.

Reply with only the 2–3 sentences, nothing else.`;

  const opik = getOpik();
  const trace = opik?.trace({ name: "Weekly report summary", input: { prompt: prompt.slice(0, 500) } });

  try {
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
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? null;
    const summary = text && text.length > 0 ? text : null;

    if (trace) {
      const span = trace.span({
        name: "OpenRouter",
        type: "llm",
        input: { model: MODEL, promptLength: prompt.length },
        output: summary ? { summary } : undefined,
      });
      span.end();
    }
    if (summary) trace?.update({ output: { summary } });
    trace?.end();
    await flushOpik();

    return summary;
  } catch {
    trace?.end();
    await flushOpik();
    return null;
  }
}

function getWeekStartUTC(d: Date): string {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weekStart = getWeekStartUTC(new Date());
    const { data: cached } = await supabase
      .from("weekly_reports")
      .select("summary, learned, plan")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        learned: (cached.learned as string[]) ?? [],
        plan: (cached.plan as { default_focus_minutes: number; default_break_minutes: number; max_sessions_per_day: number; session_rules: string[] }) ?? {},
        summary: cached.summary ?? undefined,
      });
    }

    const [trendsRes, windowsRes, patternsRes, prefsRes] = await Promise.all([
      supabase.rpc("get_focus_trends", { p_user_id: user.id, p_days: 7 }),
      supabase.rpc("get_best_focus_windows", { p_user_id: user.id }),
      supabase.rpc("get_distraction_patterns", { p_user_id: user.id }),
      supabase.from("user_preferences").select("default_focus_minutes, default_break_minutes, session_rules, max_sessions_per_day").eq("user_id", user.id).maybeSingle(),
    ]);

    const daily = (trendsRes.data?.daily as { total_sessions: number; total_focus_minutes: number; avg_session_minutes: number; total_distractions: number }[]) ?? [];
    const windows = (windowsRes.data?.windows as { hour_of_day: number; sessions_started: number; sessions_completed: number; completion_rate: number }[]) ?? [];
    const byType = (patternsRes.data?.by_type as { type: string; count: number }[]) ?? [];
    const prefs = (prefsRes.data ?? {}) as {
      default_focus_minutes?: number;
      default_break_minutes?: number;
      max_sessions_per_day?: number;
      session_rules?: string[];
    };

    const totalSessions = daily.reduce((s, d) => s + (d.total_sessions ?? 0), 0);
    const totalMinutes = daily.reduce((s, d) => s + (d.total_focus_minutes ?? 0), 0);
    const avgSessionMin = totalSessions > 0 ? totalMinutes / totalSessions : 0;
    const totalDistractions = daily.reduce((s, d) => s + (d.total_distractions ?? 0), 0);
    const topWindow = windows[0];
    const bestHour = topWindow ? Number(topWindow.hour_of_day) : null;
    const topDistraction = byType[0];
    const maxSessionsInDay = daily.length ? Math.max(...daily.map((d) => d.total_sessions ?? 0)) : 0;

    const learned: string[] = [];
    if (bestHour != null && windows.length > 0) {
      const hourStr = bestHour === 0 ? "12am" : bestHour < 12 ? `${bestHour}am` : bestHour === 12 ? "12pm" : `${bestHour - 12}pm`;
      learned.push(`Try scheduling your hardest task around ${hourStr} — that’s when you focus best.`);
    }
    if (maxSessionsInDay >= 2 && totalSessions >= 5) {
      learned.push(`Focus tends to drop after ${maxSessionsInDay} sessions in a day; consider capping at ${Math.min(maxSessionsInDay, 5)} sessions per day next week.`);
    }
    if (topDistraction) {
      const typeLower = topDistraction.type.toLowerCase();
      const isPhone = ["social media", "phone", "phone / social media", "phone_social"].some((t) => typeLower.includes(t));
      if (isPhone) {
        learned.push(`Your top distraction was ${topDistraction.type}. Consider turning on “Phone out of reach” in your plan for next week.`);
      } else {
        learned.push(`Your top distraction was ${topDistraction.type}. Try reducing those triggers before your next session.`);
      }
    }
    if (learned.length === 0) {
      learned.push("Complete more sessions this week to get personalized insights and next steps.");
    }

    const suggestedSessionsPerDay = maxSessionsInDay >= 2 ? Math.min(maxSessionsInDay, 5) : 3;
    const plan = {
      default_focus_minutes: prefs.default_focus_minutes ?? 25,
      default_break_minutes: prefs.default_break_minutes ?? 5,
      max_sessions_per_day: prefs.max_sessions_per_day ?? suggestedSessionsPerDay,
      session_rules: prefs.session_rules ?? [],
    };

    const summary = await getWeeklySummary({
      learned,
      plan,
      totalSessions,
      totalMinutes,
      totalDistractions,
    });

    await supabase.from("weekly_reports").upsert(
      {
        user_id: user.id,
        week_start: weekStart,
        summary: summary ?? null,
        learned,
        plan,
      },
      { onConflict: "user_id,week_start" }
    );

    return NextResponse.json({
      learned,
      plan,
      summary: summary ?? undefined,
    });
  } catch (err) {
    console.error("[agent/weekly-report]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load report" },
      { status: 500 }
    );
  }
}
