import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/** Creates agent notes from distraction patterns (e.g. >50% one type). Call after session or on load. */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: patterns } = await supabase.rpc("get_distraction_patterns", {
      p_user_id: user.id,
    });
    const byType = (patterns?.by_type as { type: string; count: number }[]) ?? [];
    const total = byType.reduce((s, t) => s + t.count, 0);
    if (total < 3 || byType.length === 0) {
      return NextResponse.json({ ok: true, created: 0 });
    }

    const top = byType[0];
    const pct = Math.round((top.count / total) * 100);
    if (pct < 50) {
      return NextResponse.json({ ok: true, created: 0 });
    }

    const phoneLabels = ["Social Media", "Phone / social media", "phone_social", "Phone"];
    const isPhone = phoneLabels.some((l) => top.type.toLowerCase().includes(l.toLowerCase()));
    const title = "Distraction pattern detected";
    const body = `${pct}% of your distractions this week were ${top.type.toLowerCase()}-related.`;
    const suggestion = isPhone
      ? "Put your phone in another room for upcoming sessions."
      : `Try reducing ${top.type} triggers before your next session.`;

    const { data: existing } = await supabase
      .from("agent_notes")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "distraction_pattern")
      .is("dismissed_at", null)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, created: 0 });
    }

    const { error: noteError } = await supabase.from("agent_notes").insert({
      user_id: user.id,
      type: "distraction_pattern",
      title,
      body,
      suggestion_text: suggestion,
    });

    if (noteError) {
      console.error("[agent/notes refresh]", noteError);
      return NextResponse.json({ error: noteError.message }, { status: 500 });
    }

    await supabase.from("agent_activity_log").insert({
      user_id: user.id,
      action_type: "distraction_suggestion",
      description: "Focus Agent suggested a change based on your distractions",
      payload: {
        why: body,
        suggestion_text: suggestion,
      },
    });

    return NextResponse.json({ ok: true, created: 1 });
  } catch (err) {
    console.error("[agent/notes refresh]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh notes" },
      { status: 500 }
    );
  }
}
