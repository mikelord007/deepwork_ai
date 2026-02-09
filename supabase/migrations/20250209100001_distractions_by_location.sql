-- Coach tool: distractions by place (Home, Office, Cafe, Other) for questions like "at home what distractions do I face?"

CREATE OR REPLACE FUNCTION get_distractions_by_location(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'location_label', loc.location_label,
      'by_type', loc.by_type
    ) ORDER BY loc.location_label
  )
  INTO result
  FROM (
    SELECT
      COALESCE(fs.location_label, 'Other') AS location_label,
      (
        SELECT jsonb_agg(
          jsonb_build_object('type', typ.distraction_type, 'count', typ.cnt)
          ORDER BY typ.cnt DESC
        )
        FROM (
          SELECT d2.distraction_type, COUNT(*)::int AS cnt
          FROM distractions d2
          INNER JOIN focus_sessions fs2 ON fs2.id = d2.session_id AND fs2.user_id = d2.user_id
          WHERE d2.user_id = p_user_id
            AND COALESCE(fs2.location_label, 'Other') = COALESCE(fs.location_label, 'Other')
          GROUP BY d2.distraction_type
        ) typ
      ) AS by_type
    FROM (
      SELECT DISTINCT COALESCE(fs.location_label, 'Other') AS location_label
      FROM distractions d
      INNER JOIN focus_sessions fs ON fs.id = d.session_id AND fs.user_id = d.user_id
      WHERE d.user_id = p_user_id
    ) fs
  ) loc;

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('by_location', result);
END;
$$;

COMMENT ON FUNCTION get_distractions_by_location IS 'Returns distraction counts by type per place (Home, Office, Cafe, Other); for coach when user asks about distractions at a specific location.';
