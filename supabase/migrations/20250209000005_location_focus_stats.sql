-- Derived stats by location (Office, Cafe, Home, Other). Refreshed by refresh_derived_analytics.
-- Used for "where do I focus best/worst" and coach tool get_focus_by_location.

CREATE TABLE IF NOT EXISTS location_focus_stats (
  user_id TEXT NOT NULL,
  location_label TEXT NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  completion_rate_pct NUMERIC(5,2),
  total_focus_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, location_label)
);

CREATE INDEX IF NOT EXISTS idx_location_focus_stats_user ON location_focus_stats(user_id);

COMMENT ON TABLE location_focus_stats IS 'Per-place focus aggregates; populated by refresh_derived_analytics from focus_sessions with location.';

-- RLS (same pattern as daily_focus_stats; refresh runs as SECURITY DEFINER)
ALTER TABLE location_focus_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_focus_stats_select_own" ON location_focus_stats
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "location_focus_stats_insert_own" ON location_focus_stats
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "location_focus_stats_update_own" ON location_focus_stats
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "location_focus_stats_delete_own" ON location_focus_stats
  FOR DELETE USING (auth.uid()::text = user_id);

-- Coach tool: best/worst places by completion rate
CREATE OR REPLACE FUNCTION get_focus_by_location(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'location_label', location_label,
      'total_sessions', total_sessions,
      'completed_sessions', completed_sessions,
      'completion_rate_pct', completion_rate_pct,
      'total_focus_minutes', total_focus_minutes
    ) ORDER BY completion_rate_pct DESC NULLS LAST, total_sessions DESC
  ) INTO result
  FROM location_focus_stats
  WHERE user_id = p_user_id;

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('by_location', result);
END;
$$;

COMMENT ON FUNCTION get_focus_by_location IS 'Returns focus stats by place (best to worst by completion rate); for coach tool.';

-- Extend refresh_derived_analytics to refresh location_focus_stats
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

  -- location_focus_stats: full refresh from focus_sessions with location (last 90 days)
  DELETE FROM location_focus_stats;

  INSERT INTO location_focus_stats (
    user_id, location_label, total_sessions, completed_sessions,
    completion_rate_pct, total_focus_minutes
  )
  SELECT
    user_id,
    COALESCE(location_label, 'Other') AS location_label,
    COUNT(*)::int AS total_sessions,
    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_sessions,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100)::numeric,
      2
    ) AS completion_rate_pct,
    COALESCE(SUM(actual_duration_seconds) / 60.0, 0)::numeric(12,2) AS total_focus_minutes
  FROM focus_sessions
  WHERE status IN ('completed', 'abandoned')
    AND latitude IS NOT NULL
    AND started_at >= (min_date::timestamp)
    AND started_at < (max_date + 1)::timestamp
  GROUP BY user_id, COALESCE(location_label, 'Other');

  -- focus_anomalies: clear last 90 days then re-detect (idempotent)
  DELETE FROM focus_anomalies
  WHERE reference_date >= min_date OR (reference_date IS NULL AND detected_at >= (min_date::timestamp));

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

COMMENT ON FUNCTION refresh_derived_analytics IS 'Idempotent refresh of daily_focus_stats, weekly_focus_patterns, location_focus_stats, focus_anomalies; call from cron.';
