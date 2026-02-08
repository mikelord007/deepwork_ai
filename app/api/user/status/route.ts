import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const NEW_USER_DAYS = 3;

/**
 * Returns whether the user has "less than 3 days of usage" (new user).
 * True if: no focus sessions, or earliest session started within the last NEW_USER_DAYS days.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sessions } = await supabase
      .from("focus_sessions")
      .select("started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: true })
      .limit(1);

    const earliest = sessions?.[0]?.started_at;
    if (!earliest) {
      return NextResponse.json({ isNewUser: true });
    }

    const threeDaysAgo = new Date(Date.now() - NEW_USER_DAYS * 24 * 60 * 60 * 1000);
    const isNewUser = new Date(earliest) > threeDaysAgo;
    return NextResponse.json({ isNewUser });
  } catch (err) {
    console.error("[user status GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
