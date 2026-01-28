-- Supabase Schema for deepwork.ai Analytics
-- Run this in your Supabase SQL Editor

-- Focus Sessions Table
-- Stores each pomodoro session with summary data
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  planned_duration_seconds INTEGER NOT NULL DEFAULT 1500, -- 25 minutes
  actual_duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'break')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_distractions INTEGER DEFAULT 0,
  total_pauses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Events Table
-- Granular event log for detailed behavior analysis
CREATE TABLE IF NOT EXISTS session_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES focus_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}', -- Browser/device info
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Distractions Table
-- Dedicated table for distraction analysis
CREATE TABLE IF NOT EXISTS distractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES focus_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  distraction_type TEXT NOT NULL,
  time_into_session_seconds INTEGER NOT NULL,
  time_remaining_seconds INTEGER NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_status ON focus_sessions(status);

CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_user_id ON session_events(user_id);
CREATE INDEX IF NOT EXISTS idx_session_events_event_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_events_timestamp ON session_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_distractions_session_id ON distractions(session_id);
CREATE INDEX IF NOT EXISTS idx_distractions_user_id ON distractions(user_id);
CREATE INDEX IF NOT EXISTS idx_distractions_type ON distractions(distraction_type);
CREATE INDEX IF NOT EXISTS idx_distractions_logged_at ON distractions(logged_at);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE distractions ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment if needed)
-- CREATE POLICY "Users can view own sessions" ON focus_sessions FOR SELECT USING (true);
-- CREATE POLICY "Users can insert own sessions" ON focus_sessions FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Users can update own sessions" ON focus_sessions FOR UPDATE USING (true);

-- Useful Views for Analytics

-- Daily session summary
CREATE OR REPLACE VIEW daily_session_summary AS
SELECT 
  user_id,
  DATE(started_at) as session_date,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
  COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_sessions,
  SUM(actual_duration_seconds) / 60.0 as total_focus_minutes,
  AVG(actual_duration_seconds) / 60.0 as avg_session_minutes,
  SUM(total_distractions) as total_distractions
FROM focus_sessions
WHERE status IN ('completed', 'abandoned')
GROUP BY user_id, DATE(started_at);

-- Distraction patterns by type
CREATE OR REPLACE VIEW distraction_patterns AS
SELECT 
  user_id,
  distraction_type,
  COUNT(*) as occurrence_count,
  AVG(time_into_session_seconds) / 60.0 as avg_minutes_into_session,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_into_session_seconds) / 60.0 as median_minutes_into_session
FROM distractions
GROUP BY user_id, distraction_type;

-- Hourly focus patterns
CREATE OR REPLACE VIEW hourly_focus_patterns AS
SELECT 
  user_id,
  EXTRACT(HOUR FROM started_at) as hour_of_day,
  EXTRACT(DOW FROM started_at) as day_of_week,
  COUNT(*) as sessions_started,
  COUNT(*) FILTER (WHERE status = 'completed') as sessions_completed,
  AVG(CASE WHEN status = 'completed' THEN 100.0 
           WHEN status = 'abandoned' THEN (actual_duration_seconds::float / planned_duration_seconds * 100) 
      END) as avg_completion_pct
FROM focus_sessions
GROUP BY user_id, EXTRACT(HOUR FROM started_at), EXTRACT(DOW FROM started_at);
