-- Add optional location to focus_sessions (captured when user starts a session with geolocation allowed)
ALTER TABLE focus_sessions
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_label TEXT;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_location ON focus_sessions(user_id, location_label)
  WHERE location_label IS NOT NULL;

COMMENT ON COLUMN focus_sessions.latitude IS 'Latitude when session started (browser geolocation).';
COMMENT ON COLUMN focus_sessions.longitude IS 'Longitude when session started (browser geolocation).';
COMMENT ON COLUMN focus_sessions.location_label IS 'Place label derived from reverse geocode (e.g. Office, Cafe, Home, Other).';
