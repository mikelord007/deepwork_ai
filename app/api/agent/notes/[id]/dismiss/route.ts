import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = context.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Note id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("agent_notes")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[agent/notes dismiss]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agent/notes dismiss]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to dismiss" },
      { status: 500 }
    );
  }
}
