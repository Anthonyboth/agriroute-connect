-- Fix: avoid infinite recursion in RLS policies that call get_my_transport_company_ids()
-- Root cause: profiles RLS policy references get_my_transport_company_ids(), and the function itself queries public.profiles.
-- By executing with row_security = off (as SECURITY DEFINER owner), the internal profiles lookup will not re-trigger RLS.

CREATE OR REPLACE FUNCTION public.get_my_transport_company_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(tc.id), '{}'::uuid[])
  INTO v_ids
  FROM public.transport_companies tc
  JOIN public.profiles p ON p.id = tc.profile_id
  WHERE p.user_id = auth.uid();

  RETURN COALESCE(v_ids, '{}'::uuid[]);
END;
$$;