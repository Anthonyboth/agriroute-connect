
-- Harden get_my_profile_id_for_pii with search_path and explicit auth.uid() check
CREATE OR REPLACE FUNCTION public.get_my_profile_id_for_pii()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_uid uuid;
BEGIN
  -- Explicit auth check: reject unauthenticated callers
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Permission denied: not authenticated';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_uid
  LIMIT 1;

  RETURN v_profile_id;
END;
$$;

-- Lock down execute permissions
REVOKE EXECUTE ON FUNCTION public.get_my_profile_id_for_pii() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_profile_id_for_pii() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id_for_pii() TO authenticated;
