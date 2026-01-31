-- Fix login failure caused by recursive RLS policy on public.profiles
-- Symptom in client: 500 + "42P17 infinite recursion detected in policy for relation \"profiles\""
-- Root cause: profiles_select_affiliated_drivers queried transport_companies (which is protected by RLS via can_view_company/can_manage_company), creating a recursion loop.

BEGIN;

-- 1) Helper: get current user's owned transport company ids.
-- SECURITY DEFINER is used to avoid RLS recursion when called inside other RLS policies.
CREATE OR REPLACE FUNCTION public.get_my_transport_company_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(tc.id), '{}'::uuid[])
  FROM public.transport_companies tc
  JOIN public.profiles p ON p.id = tc.profile_id
  WHERE p.user_id = auth.uid();
$$;

-- 2) Replace the recursive policy with a non-recursive version.
DROP POLICY IF EXISTS "profiles_select_affiliated_drivers" ON public.profiles;

CREATE POLICY "profiles_select_affiliated_drivers"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT cd.driver_profile_id
    FROM public.company_drivers cd
    WHERE cd.company_id = ANY(public.get_my_transport_company_ids())
      AND cd.status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'PENDING'::text])
  )
);

COMMIT;