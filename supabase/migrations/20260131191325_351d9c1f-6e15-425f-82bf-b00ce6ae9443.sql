-- Fix get_own_profile_id to be deterministic and not error when multiple profiles exist
-- Keeps the same signature to avoid breaking existing clients.
CREATE OR REPLACE FUNCTION public.get_own_profile_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Only allow the caller to query their own profile(s)
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: você só pode consultar seu próprio perfil';
  END IF;

  -- Pick the most recently created profile deterministically
  SELECT id
    INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  RETURN v_profile_id;
END;
$$;

-- Ensure authenticated users can call it (Supabase default is PUBLIC, but keep explicit grant)
GRANT EXECUTE ON FUNCTION public.get_own_profile_id(uuid) TO authenticated;