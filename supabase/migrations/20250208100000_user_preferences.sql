-- User onboarding and coach preferences (one row per user).
-- user_id = auth.uid()::text, same as other app tables.

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  coach_personality TEXT NOT NULL CHECK (coach_personality IN ('strict', 'data_focused', 'encouraging')),
  focus_domains TEXT[] NOT NULL DEFAULT '{}',
  distraction_triggers TEXT[] NOT NULL DEFAULT '{}',
  default_focus_minutes INTEGER NOT NULL CHECK (default_focus_minutes IN (15, 25, 45, 90)),
  preferred_focus_time TEXT NOT NULL CHECK (preferred_focus_time IN ('early_morning', 'late_morning', 'afternoon', 'night', 'no_fixed')),
  success_goals TEXT[] NOT NULL DEFAULT '{}',
  custom_focus_domain TEXT,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

COMMENT ON TABLE user_preferences IS 'Onboarding answers and coach personalization; one row per user.';

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "user_preferences_insert_own" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "user_preferences_update_own" ON user_preferences
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "user_preferences_delete_own" ON user_preferences
  FOR DELETE USING (auth.uid()::text = user_id);
