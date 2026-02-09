import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    const [countRes, dataRes] = await Promise.all([
      supabase.from("agent_activity_log").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("agent_activity_log")
        .select("id, action_type, description, payload, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    if (dataRes.error) {
      console.error("[agent/activity-log GET]", dataRes.error);
      return NextResponse.json({ error: dataRes.error.message }, { status: 500 });
    }

    const total = countRes.count ?? 0;
    return NextResponse.json({ entries: dataRes.data ?? [], total });
  } catch (err) {
    console.error("[agent/activity-log GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action_type = body.action_type as string | undefined;
    const description = body.description as string | undefined;
    const payload = body.payload as Record<string, unknown> | undefined;

    if (!action_type || !description) {
      return NextResponse.json(
        { error: "action_type and description required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("agent_activity_log").insert({
      user_id: user.id,
      action_type,
      description,
      payload: payload ?? {},
    });

    if (error) {
      console.error("[agent/activity-log POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agent/activity-log POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to log" },
      { status: 500 }
    );
  }
}
