-- Agent-related preferences: break length, relaxed focus range, session rules.
-- Keeps existing user_preferences; adds default_break_minutes and session_rules,
-- relaxes default_focus_minutes to 5–120.

ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_default_focus_minutes_check;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_default_focus_minutes_check
  CHECK (default_focus_minutes >= 5 AND default_focus_minutes <= 120);

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS default_break_minutes INTEGER NOT NULL DEFAULT 5;

ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_default_break_minutes_check;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_default_break_minutes_check
  CHECK (default_break_minutes >= 1 AND default_break_minutes <= 30);

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS session_rules JSONB NOT NULL DEFAULT '[]';

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS max_sessions_per_day INTEGER;

COMMENT ON COLUMN user_preferences.default_break_minutes IS 'Default break length in minutes; used after a focus session.';
COMMENT ON COLUMN user_preferences.session_rules IS 'Optional session rules, e.g. ["phone_out_of_reach", "single_task_only"].';
COMMENT ON COLUMN user_preferences.max_sessions_per_day IS 'Suggested max focus sessions per day (weekly report).';
