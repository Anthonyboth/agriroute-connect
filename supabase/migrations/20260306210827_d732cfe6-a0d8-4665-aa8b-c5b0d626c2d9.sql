-- RPC to get public profile data (no PII) for cross-user viewing
-- Uses SECURITY DEFINER + row_security=off to bypass RLS safely
CREATE OR REPLACE FUNCTION public.get_public_profile(p_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_result json;
BEGIN
  -- Require authenticated caller
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT json_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'profile_photo_url', p.profile_photo_url,
    'created_at', p.created_at,
    'rating', COALESCE(p.rating, 0),
    'total_ratings', COALESCE(p.total_ratings, 0),
    'status', p.status,
    'role', p.role,
    'base_city_name', p.base_city_name,
    'base_state', p.base_state
  ) INTO v_result
  FROM profiles p
  WHERE p.id = p_profile_id;

  IF v_result IS NULL THEN
    RETURN json_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated only
REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;