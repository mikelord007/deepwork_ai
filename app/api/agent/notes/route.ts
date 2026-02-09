import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("agent_notes")
      .select("id, type, title, body, suggestion_text, created_at")
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[agent/notes GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[agent/notes GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch notes" },
      { status: 500 }
    );
  }
}
