-- Weekly report cache: one row per user per week; summary and plan are stable for the week.
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  summary TEXT,
  learned JSONB NOT NULL DEFAULT '[]',
  plan JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_week ON weekly_reports(user_id, week_start DESC);

COMMENT ON TABLE weekly_reports IS 'Cached weekly agent report per user per week; avoids regenerating summary.';

-- RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reports_select_own" ON weekly_reports FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "weekly_reports_insert_own" ON weekly_reports FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "weekly_reports_update_own" ON weekly_reports FOR UPDATE USING (auth.uid()::text = user_id);
