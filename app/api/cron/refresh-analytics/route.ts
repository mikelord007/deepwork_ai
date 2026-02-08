import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron-triggered route to refresh derived analytics tables.
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 * Idempotent; safe to re-run.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role so cron can run refresh_derived_analytics (bypasses RLS)
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.rpc("refresh_derived_analytics");

  if (error) {
    console.error("[Cron refresh-analytics]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
