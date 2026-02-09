-- Agent experiments (e.g. session length A/B)
CREATE TABLE IF NOT EXISTS agent_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('running', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluded_at TIMESTAMPTZ,
  result_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_experiments_user_status ON agent_experiments(user_id, status);

-- Agent activity log (decisions for transparency)
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_log_user_created ON agent_activity_log(user_id, created_at DESC);

-- RLS
ALTER TABLE agent_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_experiments_select_own" ON agent_experiments FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "agent_experiments_insert_own" ON agent_experiments FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "agent_experiments_update_own" ON agent_experiments FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "agent_activity_log_select_own" ON agent_activity_log FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "agent_activity_log_insert_own" ON agent_activity_log FOR INSERT WITH CHECK (auth.uid()::text = user_id);
