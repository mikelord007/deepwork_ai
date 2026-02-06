-- Derived analytics tables for Focus Coach Agent
-- Populated from focus_sessions / distractions / views; never by the LLM.
-- Migration-safe: CREATE IF NOT EXISTS, idempotent refresh.

-- ---------------------------------------------------------------------------
-- PART 1: Tables
-- ---------------------------------------------------------------------------

-- One row per (user_id, date): daily aggregates from focus_sessions
CREATE TABLE IF NOT EXISTS daily_focus_stats (
  user_id TEXT NOT NULL,
  session_date DATE NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  abandoned_sessions INTEGER NOT NULL DEFAULT 0,
  total_focus_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_session_minutes NUMERIC(10,2),
  total_distractions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_focus_stats_user_date ON daily_focus_stats(user_id, session_date);

COMMENT ON TABLE daily_focus_stats IS 'Daily focus aggregates per user; populated by refresh_derived_analytics from focus_sessions.';

-- One row per (user_id, week_start): weekly aggregates
CREATE TABLE IF NOT EXISTS weekly_focus_patterns (
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  completion_rate_pct NUMERIC(5,2),
  total_focus_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_distractions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_focus_patterns_user_week ON weekly_focus_patterns(user_id, week_start);

COMMENT ON TABLE weekly_focus_patterns IS 'Weekly focus aggregates; week_start = date_trunc week Monday. Populated by refresh.';

-- Anomalies: deterministic rules (e.g. zero sessions after streak, low completion rate day)
CREATE TABLE IF NOT EXISTS focus_anomalies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anomaly_type TEXT NOT NULL,
  reference_date DATE,
  payload JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_focus_anomalies_user_detected ON focus_anomalies(user_id, detected_at);

COMMENT ON TABLE focus_anomalies IS 'Deterministic anomalies from daily_focus_stats (e.g. zero-session day after streak).';

-- Coach-generated insights for get_recent_changes; written by agent via log_coach_insight
CREATE TABLE IF NOT EXISTS coach_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_memory_user_created ON coach_memory(user_id, created_at DESC);

COMMENT ON TABLE coach_memory IS 'Insights logged by the coach agent; read by get_recent_changes.';

-- ---------------------------------------------------------------------------
-- PART 2: Analytics RPCs (structured JSON only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_focus_trends(p_user_id TEXT, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  summary JSONB;
BEGIN
  IF p_days IS NULL OR p_days < 1 THEN
    p_days := 30;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'date', session_date,
      'total_sessions', total_sessions,
      'completed_sessions', completed_sessions,
      'abandoned_sessions', abandoned_sessions,
      'total_focus_minutes', total_focus_minutes,
      'avg_session_minutes', avg_session_minutes,
      'total_distractions', total_distractions
    ) ORDER BY session_date DESC
  ) INTO result
  FROM daily_focus_stats
  WHERE user_id = p_user_id
    AND session_date >= (CURRENT_DATE - (p_days - 1));

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'days_requested', p_days,
    'row_count', jsonb_array_length(result)
  ) INTO summary;

  RETURN jsonb_build_object('daily', result, 'summary', summary);
END;
$$;

COMMENT ON FUNCTION get_focus_trends IS 'Returns daily focus stats for the last p_days; for coach tool.';

CREATE OR REPLACE FUNCTION get_best_focus_windows(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour_of_day', hour_of_day,
      'day_of_week', day_of_week,
      'sessions_started', sessions_started,
      'sessions_completed', sessions_completed,
      'completion_rate', ROUND(
        (sessions_completed::numeric / NULLIF(sessions_started, 0) * 100)::numeric,
        1
      )
    ) ORDER BY sessions_started DESC, sessions_completed DESC
  ) INTO result
  FROM hourly_focus_patterns
  WHERE user_id = p_user_id;

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('windows', result);
END;
$$;

COMMENT ON FUNCTION get_best_focus_windows IS 'Returns hourly/dow focus windows from hourly_focus_patterns for coach tool.';

CREATE OR REPLACE FUNCTION get_distraction_patterns(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', distraction_type,
      'count', occurrence_count,
      'avg_minutes_into_session', ROUND(avg_minutes_into_session::numeric, 1)
    ) ORDER BY occurrence_count DESC
  ) INTO result
  FROM distraction_patterns
  WHERE user_id = p_user_id;

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('by_type', result);
END;
$$;

COMMENT ON FUNCTION get_distraction_patterns IS 'Returns distraction counts by type from distraction_patterns view for coach tool.';

CREATE OR REPLACE FUNCTION get_recent_changes(p_user_id TEXT, p_days INT DEFAULT 14)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  IF p_days IS NULL OR p_days < 1 THEN
    p_days := 14;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'type', type,
      'content', content,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ) INTO result
  FROM coach_memory
  WHERE user_id = p_user_id
    AND created_at >= (NOW() - (p_days || ' days')::interval);

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('insights', result);
END;
$$;

COMMENT ON FUNCTION get_recent_changes IS 'Returns recent coach_memory insights for the user; for coach tool.';

-- ---------------------------------------------------------------------------
-- PART 3: Idempotent refresh for derived tables (called by cron API route)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_derived_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  min_date DATE := CURRENT_DATE - 90;
  max_date DATE := CURRENT_DATE;
BEGIN
  -- daily_focus_stats: upsert from daily_session_summary for last 90 days
  INSERT INTO daily_focus_stats (
    user_id, session_date, total_sessions, completed_sessions, abandoned_sessions,
    total_focus_minutes, avg_session_minutes, total_distractions
  )
  SELECT
    user_id,
    session_date,
    total_sessions::int,
    completed_sessions::int,
    abandoned_sessions::int,
    COALESCE(total_focus_minutes, 0),
    avg_session_minutes,
    COALESCE(total_distractions::int, 0)
  FROM daily_session_summary
  WHERE session_date >= min_date AND session_date <= max_date
  ON CONFLICT (user_id, session_date)
  DO UPDATE SET
    total_sessions = EXCLUDED.total_sessions,
    completed_sessions = EXCLUDED.completed_sessions,
    abandoned_sessions = EXCLUDED.abandoned_sessions,
    total_focus_minutes = EXCLUDED.total_focus_minutes,
    avg_session_minutes = EXCLUDED.avg_session_minutes,
    total_distractions = EXCLUDED.total_distractions;

  -- weekly_focus_patterns: delete week range and re-insert (idempotent)
  DELETE FROM weekly_focus_patterns
  WHERE week_start >= date_trunc('week', min_date)::date
    AND week_start <= date_trunc('week', max_date)::date;

  INSERT INTO weekly_focus_patterns (
    user_id, week_start, total_sessions, completed_sessions,
    completion_rate_pct, total_focus_minutes, total_distractions
  )
  SELECT
    user_id,
    date_trunc('week', session_date)::date AS week_start,
    SUM(total_sessions)::int,
    SUM(completed_sessions)::int,
    ROUND(
      (SUM(completed_sessions)::numeric / NULLIF(SUM(total_sessions), 0) * 100)::numeric,
      2
    ),
    SUM(total_focus_minutes),
    SUM(total_distractions)::int
  FROM daily_focus_stats
  WHERE session_date >= min_date AND session_date <= max_date
  GROUP BY user_id, date_trunc('week', session_date)::date;

  -- focus_anomalies: clear last 90 days then re-detect (idempotent)
  DELETE FROM focus_anomalies
  WHERE reference_date >= min_date OR (reference_date IS NULL AND detected_at >= (min_date::timestamp));

  -- Anomaly: day with 0 sessions when previous day had sessions (streak break)
  INSERT INTO focus_anomalies (user_id, anomaly_type, reference_date, payload)
  SELECT
    d.user_id,
    'zero_sessions_after_activity',
    d.session_date,
    jsonb_build_object('prev_day_sessions', p.total_sessions)
  FROM daily_focus_stats d
  INNER JOIN daily_focus_stats p
    ON p.user_id = d.user_id AND p.session_date = d.session_date - 1 AND p.total_sessions > 0
  WHERE d.session_date >= min_date AND d.session_date <= max_date
    AND d.total_sessions = 0;

  -- Anomaly: day with completion rate < 30% and at least 3 sessions
  INSERT INTO focus_anomalies (user_id, anomaly_type, reference_date, payload)
  SELECT
    user_id,
    'low_completion_rate_day',
    session_date,
    jsonb_build_object(
      'total_sessions', total_sessions,
      'completed_sessions', completed_sessions,
      'completion_rate_pct', ROUND((completed_sessions::numeric / NULLIF(total_sessions, 0) * 100)::numeric, 1)
    )
  FROM daily_focus_stats
  WHERE session_date >= min_date AND session_date <= max_date
    AND total_sessions >= 3
    AND (completed_sessions::float / NULLIF(total_sessions, 0) * 100) < 30;
END;
$$;

COMMENT ON FUNCTION refresh_derived_analytics IS 'Idempotent refresh of daily_focus_stats, weekly_focus_patterns, focus_anomalies; call from cron.';
