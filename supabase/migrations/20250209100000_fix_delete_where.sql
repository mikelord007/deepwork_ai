-- Supabase requires DELETE to have a WHERE clause. Fix refresh_derived_analytics.
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

  -- location_focus_stats: full refresh (WHERE true satisfies Supabase DELETE safety)
  DELETE FROM location_focus_stats WHERE true;

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
