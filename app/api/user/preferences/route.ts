import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const COACH_PERSONALITIES = ["strict", "data_focused", "encouraging"] as const;
const FOCUS_DOMAINS = ["deep_work", "studying", "creative", "job_search", "admin", "habit", "other"] as const;
const DISTRACTION_TRIGGERS = ["phone_social", "notifications", "overthinking", "boredom", "fatigue", "stuck", "external", "tab_switching"] as const;
const FOCUS_MINUTES_MIN = 5;
const FOCUS_MINUTES_MAX = 120;
const BREAK_MINUTES_MIN = 1;
const BREAK_MINUTES_MAX = 30;
const SESSION_RULES_ALLOWED = ["phone_out_of_reach", "single_task_only"] as const;
const PREFERRED_FOCUS_TIMES = ["early_morning", "late_morning", "afternoon", "night", "no_fixed"] as const;
const SUCCESS_GOALS = ["procrastinate_less", "finish_what_start", "less_guilty", "more_consistent", "more_done", "feel_calmer"] as const;

const MAX_DISTRACTION_TRIGGERS = 3;

type CoachPersonality = (typeof COACH_PERSONALITIES)[number];
type FocusDomain = (typeof FOCUS_DOMAINS)[number];
type DistractionTrigger = (typeof DISTRACTION_TRIGGERS)[number];
type PreferredFocusTime = (typeof PREFERRED_FOCUS_TIMES)[number];
type SuccessGoal = (typeof SUCCESS_GOALS)[number];

export type SessionRule = (typeof SESSION_RULES_ALLOWED)[number];

export type UserPreferencesPayload = {
  coach_personality?: CoachPersonality;
  focus_domains?: FocusDomain[];
  distraction_triggers?: DistractionTrigger[];
  default_focus_minutes?: number;
  default_break_minutes?: number;
  session_rules?: SessionRule[];
  max_sessions_per_day?: number;
  preferred_focus_time?: PreferredFocusTime;
  success_goals?: SuccessGoal[];
  custom_focus_domain?: string | null;
};

function isStringArray(arr: unknown, allowed: readonly string[]): arr is string[] {
  return Array.isArray(arr) && arr.every((v) => typeof v === "string" && allowed.includes(v));
}

function validateFullPayload(body: unknown): { ok: true; data: UserPreferencesPayload } | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Body must be an object" };
  }
  const b = body as Record<string, unknown>;

  const coach_personality = b.coach_personality as string | undefined;
  if (!coach_personality || !COACH_PERSONALITIES.includes(coach_personality as CoachPersonality)) {
    return { ok: false, error: "coach_personality must be one of: strict, data_focused, encouraging" };
  }

  const focus_domains = b.focus_domains;
  if (!Array.isArray(focus_domains) || !focus_domains.every((v) => typeof v === "string" && FOCUS_DOMAINS.includes(v as FocusDomain))) {
    return { ok: false, error: "focus_domains must be an array of allowed focus domain codes" };
  }

  const distraction_triggers = b.distraction_triggers;
  if (!isStringArray(distraction_triggers, [...DISTRACTION_TRIGGERS])) {
    return { ok: false, error: "distraction_triggers must be an array of allowed trigger codes" };
  }
  if (distraction_triggers.length > MAX_DISTRACTION_TRIGGERS) {
    return { ok: false, error: `distraction_triggers must have at most ${MAX_DISTRACTION_TRIGGERS} items` };
  }

  const default_focus_minutes = b.default_focus_minutes as number | undefined;
  if (typeof default_focus_minutes !== "number" || default_focus_minutes < FOCUS_MINUTES_MIN || default_focus_minutes > FOCUS_MINUTES_MAX) {
    return { ok: false, error: `default_focus_minutes must be between ${FOCUS_MINUTES_MIN} and ${FOCUS_MINUTES_MAX}` };
  }

  const default_break_minutes = b.default_break_minutes as number | undefined;
  const default_break = default_break_minutes == null ? 5 : default_break_minutes;
  if (typeof default_break !== "number" || default_break < BREAK_MINUTES_MIN || default_break > BREAK_MINUTES_MAX) {
    return { ok: false, error: `default_break_minutes must be between ${BREAK_MINUTES_MIN} and ${BREAK_MINUTES_MAX}` };
  }

  const session_rules_raw = b.session_rules;
  const session_rules: SessionRule[] =
    session_rules_raw == null
      ? []
      : Array.isArray(session_rules_raw) && session_rules_raw.every((v) => typeof v === "string" && SESSION_RULES_ALLOWED.includes(v as SessionRule))
        ? (session_rules_raw as SessionRule[])
        : [];

  const preferred_focus_time = b.preferred_focus_time as string | undefined;
  if (!preferred_focus_time || !PREFERRED_FOCUS_TIMES.includes(preferred_focus_time as PreferredFocusTime)) {
    return { ok: false, error: "preferred_focus_time must be one of: early_morning, late_morning, afternoon, night, no_fixed" };
  }

  const success_goals = b.success_goals;
  if (!Array.isArray(success_goals) || !success_goals.every((v) => typeof v === "string" && SUCCESS_GOALS.includes(v as SuccessGoal))) {
    return { ok: false, error: "success_goals must be an array of allowed goal codes" };
  }

  const custom_focus_domain = b.custom_focus_domain;
  const custom_focus_domain_val =
    custom_focus_domain === undefined || custom_focus_domain === null
      ? null
      : typeof custom_focus_domain === "string"
        ? custom_focus_domain.trim() || null
        : null;

  return {
    ok: true,
    data: {
      coach_personality: coach_personality as CoachPersonality,
      focus_domains: focus_domains as FocusDomain[],
      distraction_triggers: distraction_triggers as DistractionTrigger[],
      default_focus_minutes,
      default_break_minutes: default_break,
      session_rules,
      preferred_focus_time: preferred_focus_time as PreferredFocusTime,
      success_goals: success_goals as SuccessGoal[],
      custom_focus_domain: custom_focus_domain_val,
    },
  };
}

/** Validate partial payload (e.g. only coach_personality for Settings). */
function validatePartialPayload(body: unknown): UserPreferencesPayload {
  if (body === null || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  const out: UserPreferencesPayload = {};
  if (b.coach_personality != null && COACH_PERSONALITIES.includes(b.coach_personality as CoachPersonality)) {
    out.coach_personality = b.coach_personality as CoachPersonality;
  }
  if (Array.isArray(b.focus_domains) && b.focus_domains.every((v) => typeof v === "string" && FOCUS_DOMAINS.includes(v as FocusDomain))) {
    out.focus_domains = b.focus_domains as FocusDomain[];
  }
  if (isStringArray(b.distraction_triggers, [...DISTRACTION_TRIGGERS]) && (b.distraction_triggers as string[]).length <= MAX_DISTRACTION_TRIGGERS) {
    out.distraction_triggers = b.distraction_triggers as DistractionTrigger[];
  }
  if (typeof b.default_focus_minutes === "number" && b.default_focus_minutes >= FOCUS_MINUTES_MIN && b.default_focus_minutes <= FOCUS_MINUTES_MAX) {
    out.default_focus_minutes = b.default_focus_minutes;
  }
  if (typeof b.default_break_minutes === "number" && b.default_break_minutes >= BREAK_MINUTES_MIN && b.default_break_minutes <= BREAK_MINUTES_MAX) {
    out.default_break_minutes = b.default_break_minutes;
  }
  if (Array.isArray(b.session_rules) && b.session_rules.every((v) => typeof v === "string" && SESSION_RULES_ALLOWED.includes(v as SessionRule))) {
    out.session_rules = b.session_rules as SessionRule[];
  }
  if (typeof b.max_sessions_per_day === "number" && b.max_sessions_per_day >= 1 && b.max_sessions_per_day <= 20) {
    out.max_sessions_per_day = b.max_sessions_per_day;
  }
  if (b.preferred_focus_time != null && PREFERRED_FOCUS_TIMES.includes(b.preferred_focus_time as PreferredFocusTime)) {
    out.preferred_focus_time = b.preferred_focus_time as PreferredFocusTime;
  }
  if (Array.isArray(b.success_goals) && b.success_goals.every((v) => typeof v === "string" && SUCCESS_GOALS.includes(v as SuccessGoal))) {
    out.success_goals = b.success_goals as SuccessGoal[];
  }
  if (b.custom_focus_domain !== undefined) {
    out.custom_focus_domain = typeof b.custom_focus_domain === "string" ? (b.custom_focus_domain.trim() || null) : null;
  }
  return out;
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

    const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();

    if (error) {
      console.error("[preferences GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[preferences GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch preferences" },
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

    const body = await request.json().catch(() => null);
    const fullValidation = validateFullPayload(body);

    if (fullValidation.ok) {
      const { data: payload } = fullValidation;
      const row = {
        user_id: user.id,
        coach_personality: payload.coach_personality!,
        focus_domains: payload.focus_domains!,
        distraction_triggers: payload.distraction_triggers! as DistractionTrigger[],
        default_focus_minutes: payload.default_focus_minutes!,
        default_break_minutes: payload.default_break_minutes ?? 5,
        session_rules: payload.session_rules ?? [],
        preferred_focus_time: payload.preferred_focus_time!,
        success_goals: payload.success_goals!,
        custom_focus_domain: payload.custom_focus_domain ?? null,
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("user_preferences").upsert(row, {
        onConflict: "user_id",
      });

      if (error) {
        console.error("[preferences POST upsert]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const partial = validatePartialPayload(body);
    if (Object.keys(partial).length === 0) {
      return NextResponse.json(
        { error: fullValidation.ok ? undefined : fullValidation.error ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "No existing preferences; send full onboarding payload first." },
        { status: 400 }
      );
    }

    const merged = {
      ...existing,
      ...partial,
      user_id: user.id,
    };
    const { completed_at, user_id: _uid, ...toUpdate } = merged;
    const { error } = await supabase
      .from("user_preferences")
      .update(toUpdate)
      .eq("user_id", user.id);

    if (error) {
      console.error("[preferences POST update]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[preferences POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save preferences" },
      { status: 500 }
    );
  }
}
