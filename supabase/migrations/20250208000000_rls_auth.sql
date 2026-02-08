-- Row Level Security: restrict all focus/coach data to the authenticated user.
-- user_id in tables stores auth.uid()::text (Supabase Auth user UUID).
-- Cron job that runs refresh_derived_analytics must use the service role key to bypass RLS.

-- focus_sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_sessions_select_own" ON focus_sessions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "focus_sessions_insert_own" ON focus_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "focus_sessions_update_own" ON focus_sessions
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "focus_sessions_delete_own" ON focus_sessions
  FOR DELETE USING (auth.uid()::text = user_id);

-- session_events
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_events_select_own" ON session_events
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "session_events_insert_own" ON session_events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "session_events_update_own" ON session_events
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "session_events_delete_own" ON session_events
  FOR DELETE USING (auth.uid()::text = user_id);

-- distractions
ALTER TABLE distractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distractions_select_own" ON distractions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "distractions_insert_own" ON distractions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "distractions_update_own" ON distractions
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "distractions_delete_own" ON distractions
  FOR DELETE USING (auth.uid()::text = user_id);

-- daily_focus_stats (derived; written by refresh_derived_analytics with service role)
ALTER TABLE daily_focus_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_focus_stats_select_own" ON daily_focus_stats
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "daily_focus_stats_insert_own" ON daily_focus_stats
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "daily_focus_stats_update_own" ON daily_focus_stats
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "daily_focus_stats_delete_own" ON daily_focus_stats
  FOR DELETE USING (auth.uid()::text = user_id);

-- weekly_focus_patterns
ALTER TABLE weekly_focus_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_focus_patterns_select_own" ON weekly_focus_patterns
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "weekly_focus_patterns_insert_own" ON weekly_focus_patterns
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "weekly_focus_patterns_update_own" ON weekly_focus_patterns
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "weekly_focus_patterns_delete_own" ON weekly_focus_patterns
  FOR DELETE USING (auth.uid()::text = user_id);

-- focus_anomalies
ALTER TABLE focus_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_anomalies_select_own" ON focus_anomalies
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "focus_anomalies_insert_own" ON focus_anomalies
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "focus_anomalies_update_own" ON focus_anomalies
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "focus_anomalies_delete_own" ON focus_anomalies
  FOR DELETE USING (auth.uid()::text = user_id);

-- coach_memory
ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_memory_select_own" ON coach_memory
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "coach_memory_insert_own" ON coach_memory
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "coach_memory_update_own" ON coach_memory
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "coach_memory_delete_own" ON coach_memory
  FOR DELETE USING (auth.uid()::text = user_id);
