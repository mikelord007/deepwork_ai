-- Agent notes (inbox): distraction patterns and suggestions, dismissible.
CREATE TABLE IF NOT EXISTS agent_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  suggestion_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_notes_user_dismissed ON agent_notes(user_id, dismissed_at);
CREATE INDEX IF NOT EXISTS idx_agent_notes_user_created ON agent_notes(user_id, created_at DESC);

COMMENT ON TABLE agent_notes IS 'Focus Agent notes (e.g. distraction patterns); shown in inbox until dismissed.';

-- RLS
ALTER TABLE agent_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_notes_select_own" ON agent_notes
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "agent_notes_insert_own" ON agent_notes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "agent_notes_update_own" ON agent_notes
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "agent_notes_delete_own" ON agent_notes
  FOR DELETE USING (auth.uid()::text = user_id);
